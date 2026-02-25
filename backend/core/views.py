from django.conf import settings
from django.db.models import Count, Q
from django.db.models.functions import TruncDate
from django.shortcuts import get_object_or_404
from django.utils import timezone
import stripe
from rest_framework import generics, serializers, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Application, JobPosting, PaymentSession, User
from .permissions import IsEmployer, IsJobSeeker
from .serializers import (
    ApplicationCreateSerializer,
    ApplicationSerializer,
    JobPostingCreateSerializer,
    JobPostingSerializer,
    PaymentSessionSerializer,
    RegisterSerializer,
    UserSerializer,
)


def _require_stripe_configuration():
    if not settings.STRIPE_SECRET_KEY:
        raise serializers.ValidationError(
            "Stripe is not configured. Set STRIPE_SECRET_KEY to enable payments."
        )
    stripe.api_key = settings.STRIPE_SECRET_KEY


def _success_url_with_session_id():
    success_url = settings.STRIPE_SUCCESS_URL
    if "{CHECKOUT_SESSION_ID}" in success_url:
        return success_url
    joiner = "&" if "?" in success_url else "?"
    return f"{success_url}{joiner}session_id={{CHECKOUT_SESSION_ID}}"


def _create_checkout_session(*, amount_cents, product_name, metadata):
    _require_stripe_configuration()
    try:
        return stripe.checkout.Session.create(
            mode="payment",
            success_url=_success_url_with_session_id(),
            cancel_url=settings.STRIPE_CANCEL_URL,
            payment_method_types=["card"],
            line_items=[
                {
                    "price_data": {
                        "currency": "usd",
                        "unit_amount": amount_cents,
                        "product_data": {"name": product_name},
                    },
                    "quantity": 1,
                }
            ],
            metadata={key: str(value) for key, value in metadata.items()},
        )
    except Exception as exc:
        raise serializers.ValidationError(f"Unable to create Stripe checkout session: {exc}")


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]


class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class JobPostingListCreateView(generics.ListCreateAPIView):
    queryset = JobPosting.objects.select_related("employer")

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsAuthenticated(), IsEmployer()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return JobPostingCreateSerializer
        return JobPostingSerializer

    def get_queryset(self):
        queryset = self.queryset
        current_time = timezone.now()
        active_filter = Q(status=JobPosting.ACTIVE) & (
            Q(expires_at__isnull=True) | Q(expires_at__gte=current_time)
        )

        if self.request.user.role == User.EMPLOYER:
            queryset = queryset.filter(active_filter | Q(employer=self.request.user))
        else:
            queryset = queryset.filter(active_filter)

        query_text = self.request.query_params.get("q", "").strip()
        if query_text:
            queryset = queryset.filter(
                Q(title__icontains=query_text)
                | Q(description__icontains=query_text)
                | Q(location__icontains=query_text)
            )

        return queryset

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        job = serializer.save()
        response_payload = JobPostingSerializer(job, context={"request": request}).data
        headers = self.get_success_headers(response_payload)
        return Response(response_payload, status=status.HTTP_201_CREATED, headers=headers)


class JobPostingDetailView(generics.RetrieveAPIView):
    serializer_class = JobPostingSerializer
    queryset = JobPosting.objects.select_related("employer")
    permission_classes = [IsAuthenticated]
    lookup_url_kwarg = "job_id"

    def get_object(self):
        job = super().get_object()
        if job.employer_id == self.request.user.id or job.is_active:
            return job
        raise PermissionDenied("This job posting is not available.")


class JobApplicantsView(generics.ListAPIView):
    serializer_class = ApplicationSerializer
    permission_classes = [IsAuthenticated, IsEmployer]

    def get_queryset(self):
        job = get_object_or_404(JobPosting, id=self.kwargs["job_id"])
        if job.employer_id != self.request.user.id:
            raise PermissionDenied("You can only view applicants for your own job postings.")
        return Application.objects.filter(job=job).select_related("job", "applicant")


class JobApplyView(APIView):
    permission_classes = [IsAuthenticated, IsJobSeeker]

    def post(self, request, job_id):
        job = get_object_or_404(JobPosting, id=job_id)
        if not job.is_active:
            raise serializers.ValidationError("This job is not currently accepting applications.")
        if job.employer_id == request.user.id:
            raise serializers.ValidationError("You cannot apply to your own job posting.")

        serializer = ApplicationCreateSerializer(
            data=request.data,
            context={"request": request, "job": job},
        )
        serializer.is_valid(raise_exception=True)
        application = serializer.save()
        return Response(ApplicationSerializer(application).data, status=status.HTTP_201_CREATED)


class JobMetricsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, job_id):
        job = get_object_or_404(JobPosting, id=job_id)
        if not (job.employer_id == request.user.id or job.is_active):
            raise PermissionDenied("This job posting is not available.")

        applications = Application.objects.filter(job=job)
        application_count = applications.count()

        obol_rows = applications.values("obol_amount").annotate(count=Count("id"))
        obol_map = {row["obol_amount"]: row["count"] for row in obol_rows}
        obol_distribution = [
            {"obol_amount": obol, "count": obol_map.get(obol, 0)} for obol in (0, 1, 3, 5)
        ]

        timeline_rows = (
            applications.annotate(day=TruncDate("created_at"))
            .values("day")
            .annotate(count=Count("id"))
            .order_by("day")
        )
        applications_over_time = [
            {"date": row["day"].isoformat(), "count": row["count"]} for row in timeline_rows
        ]

        return Response(
            {
                "job_id": job.id,
                "application_count": application_count,
                "obol_distribution": obol_distribution,
                "applications_over_time": applications_over_time,
            }
        )


class JobPostingPaymentSessionCreateView(APIView):
    permission_classes = [IsAuthenticated, IsEmployer]

    def post(self, request):
        job_id = request.data.get("job_id")
        if not job_id:
            raise serializers.ValidationError("job_id is required.")
        job = get_object_or_404(JobPosting, id=job_id)
        if job.employer_id != request.user.id:
            raise PermissionDenied("You can only pay for your own job postings.")

        if job.fee_paid or job.fee_cents == 0:
            if not job.fee_paid:
                job.fee_paid = True
                job.status = JobPosting.ACTIVE
                job.save(update_fields=["fee_paid", "status", "updated_at"])
            return Response(
                {
                    "message": "Job posting fee is already satisfied.",
                    "payment_required": False,
                    "job_id": job.id,
                }
            )

        stripe_session = _create_checkout_session(
            amount_cents=job.fee_cents,
            product_name=f"Charon job posting fee: {job.title}",
            metadata={
                "kind": PaymentSession.KIND_JOB_POSTING,
                "job_id": job.id,
                "user_id": request.user.id,
            },
        )
        payment = PaymentSession.objects.create(
            user=request.user,
            job=job,
            kind=PaymentSession.KIND_JOB_POSTING,
            stripe_session_id=stripe_session.id,
            amount_cents=job.fee_cents,
        )
        return Response(
            {
                "checkout_url": stripe_session.url,
                "stripe_session_id": stripe_session.id,
                "payment_session": PaymentSessionSerializer(payment).data,
            },
            status=status.HTTP_201_CREATED,
        )


class ApplicationPaymentSessionCreateView(APIView):
    permission_classes = [IsAuthenticated, IsJobSeeker]

    def post(self, request):
        job_id = request.data.get("job_id")
        obol_amount = int(request.data.get("obol_amount", 0))
        if not job_id:
            raise serializers.ValidationError("job_id is required.")
        if obol_amount not in (1, 3, 5):
            raise serializers.ValidationError(
                "obol_amount must be one of 1, 3, or 5 for paid sessions."
            )

        job = get_object_or_404(JobPosting, id=job_id)
        if not job.is_active:
            raise serializers.ValidationError("This job is not currently accepting applications.")
        if job.employer_id == request.user.id:
            raise serializers.ValidationError("You cannot apply to your own job posting.")

        amount_cents = obol_amount * 100
        stripe_session = _create_checkout_session(
            amount_cents=amount_cents,
            product_name=f"Charon obol for application: {job.title}",
            metadata={
                "kind": PaymentSession.KIND_APPLICATION,
                "job_id": job.id,
                "user_id": request.user.id,
                "obol_amount": obol_amount,
            },
        )
        payment = PaymentSession.objects.create(
            user=request.user,
            job=job,
            kind=PaymentSession.KIND_APPLICATION,
            stripe_session_id=stripe_session.id,
            amount_cents=amount_cents,
            obol_amount=obol_amount,
        )
        return Response(
            {
                "checkout_url": stripe_session.url,
                "stripe_session_id": stripe_session.id,
                "payment_session": PaymentSessionSerializer(payment).data,
            },
            status=status.HTTP_201_CREATED,
        )


class PaymentSessionConfirmView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        stripe_session_id = request.data.get("stripe_session_id")
        if not stripe_session_id:
            raise serializers.ValidationError("stripe_session_id is required.")

        payment = get_object_or_404(
            PaymentSession,
            stripe_session_id=stripe_session_id,
            user=request.user,
        )
        _require_stripe_configuration()
        try:
            stripe_session = stripe.checkout.Session.retrieve(stripe_session_id)
        except Exception as exc:
            raise serializers.ValidationError(
                f"Unable to verify Stripe checkout session: {exc}"
            )

        if stripe_session.payment_status != "paid":
            return Response(
                {
                    "verified": False,
                    "message": "Payment is not completed yet.",
                    "payment_status": stripe_session.payment_status,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not payment.is_paid:
            payment.is_paid = True
            payment.paid_at = timezone.now()
            payment.save(update_fields=["is_paid", "paid_at"])

            if payment.kind == PaymentSession.KIND_JOB_POSTING and payment.job:
                payment.job.fee_paid = True
                payment.job.status = JobPosting.ACTIVE
                payment.job.save(update_fields=["fee_paid", "status", "updated_at"])

        return Response(
            {
                "verified": True,
                "payment_session": PaymentSessionSerializer(payment).data,
            }
        )
