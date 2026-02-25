from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework import serializers

from .models import Application, JobPosting, PaymentSession, User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "role",
        )


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = (
            "username",
            "password",
            "email",
            "first_name",
            "last_name",
            "role",
        )

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class JobPostingSerializer(serializers.ModelSerializer):
    employer = UserSerializer(read_only=True)
    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = JobPosting
        fields = (
            "id",
            "title",
            "description",
            "location",
            "fee_cents",
            "fee_paid",
            "status",
            "is_active",
            "created_at",
            "updated_at",
            "expires_at",
            "employer",
        )


class JobPostingCreateSerializer(serializers.ModelSerializer):
    duration_days = serializers.IntegerField(
        min_value=1, max_value=365, required=False, default=30, write_only=True
    )

    class Meta:
        model = JobPosting
        fields = ("title", "description", "location", "duration_days")

    def create(self, validated_data):
        duration_days = validated_data.pop("duration_days", 30)
        fee_cents = settings.JOB_POSTING_FEE_CENTS
        return JobPosting.objects.create(
            employer=self.context["request"].user,
            fee_cents=fee_cents,
            fee_paid=fee_cents == 0,
            status=JobPosting.ACTIVE if fee_cents == 0 else JobPosting.DRAFT,
            expires_at=timezone.now() + timedelta(days=duration_days),
            **validated_data,
        )


class PaymentSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentSession
        fields = (
            "id",
            "kind",
            "stripe_session_id",
            "amount_cents",
            "obol_amount",
            "is_paid",
            "paid_at",
            "created_at",
            "job",
        )


class ApplicationSerializer(serializers.ModelSerializer):
    applicant = UserSerializer(read_only=True)
    job = JobPostingSerializer(read_only=True)

    class Meta:
        model = Application
        fields = (
            "id",
            "job",
            "applicant",
            "resume_text",
            "notes",
            "obol_amount",
            "created_at",
        )


class ApplicationCreateSerializer(serializers.Serializer):
    resume_text = serializers.CharField()
    notes = serializers.CharField(required=False, allow_blank=True)
    obol_amount = serializers.ChoiceField(choices=[0, 1, 3, 5])
    payment_session_id = serializers.IntegerField(required=False)

    def validate(self, attrs):
        request = self.context["request"]
        job = self.context["job"]
        obol_amount = int(attrs.get("obol_amount", 0))

        if Application.objects.filter(job=job, applicant=request.user).exists():
            raise serializers.ValidationError("You have already applied to this job.")

        if obol_amount > 0:
            payment_session_id = attrs.get("payment_session_id")
            if not payment_session_id:
                raise serializers.ValidationError(
                    "payment_session_id is required for paid obol applications."
                )

            payment_session = PaymentSession.objects.filter(
                id=payment_session_id,
                user=request.user,
                job=job,
                kind=PaymentSession.KIND_APPLICATION,
                obol_amount=obol_amount,
                is_paid=True,
            ).first()
            if not payment_session:
                raise serializers.ValidationError(
                    "Valid paid payment session not found for this obol amount."
                )
            attrs["payment_session"] = payment_session
        else:
            attrs["payment_session"] = None

        return attrs

    def create(self, validated_data):
        request = self.context["request"]
        job = self.context["job"]
        return Application.objects.create(
            job=job,
            applicant=request.user,
            resume_text=validated_data["resume_text"],
            notes=validated_data.get("notes", ""),
            obol_amount=int(validated_data["obol_amount"]),
            payment_session=validated_data.get("payment_session"),
        )
