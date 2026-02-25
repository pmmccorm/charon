from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .views import (
    ApplicationPaymentSessionCreateView,
    CurrentUserView,
    JobApplicantsView,
    JobApplyView,
    JobMetricsView,
    JobPostingDetailView,
    JobPostingListCreateView,
    JobPostingPaymentSessionCreateView,
    PaymentSessionConfirmView,
    RegisterView,
)

urlpatterns = [
    path("auth/register/", RegisterView.as_view(), name="register"),
    path("auth/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("auth/me/", CurrentUserView.as_view(), name="current_user"),
    path("jobs/", JobPostingListCreateView.as_view(), name="job_list_create"),
    path("jobs/<int:job_id>/", JobPostingDetailView.as_view(), name="job_detail"),
    path("jobs/<int:job_id>/apply/", JobApplyView.as_view(), name="job_apply"),
    path("jobs/<int:job_id>/applicants/", JobApplicantsView.as_view(), name="job_applicants"),
    path("jobs/<int:job_id>/metrics/", JobMetricsView.as_view(), name="job_metrics"),
    path(
        "payments/job-session/",
        JobPostingPaymentSessionCreateView.as_view(),
        name="job_payment_session_create",
    ),
    path(
        "payments/application-session/",
        ApplicationPaymentSessionCreateView.as_view(),
        name="application_payment_session_create",
    ),
    path(
        "payments/confirm-session/",
        PaymentSessionConfirmView.as_view(),
        name="payment_session_confirm",
    ),
]
