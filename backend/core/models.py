from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


OBOL_CHOICES = ((0, "$0"), (1, "$1"), (3, "$3"), (5, "$5"))


class User(AbstractUser):
    EMPLOYER = "employer"
    JOB_SEEKER = "job_seeker"
    ROLE_CHOICES = ((EMPLOYER, "Employer"), (JOB_SEEKER, "Job seeker"))

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=JOB_SEEKER)
    paper_money_enabled = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.username} ({self.role})"


class JobPosting(models.Model):
    DRAFT = "draft"
    ACTIVE = "active"
    CLOSED = "closed"
    STATUS_CHOICES = ((DRAFT, "Draft"), (ACTIVE, "Active"), (CLOSED, "Closed"))

    employer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="job_postings"
    )
    title = models.CharField(max_length=255)
    description = models.TextField()
    location = models.CharField(max_length=255, blank=True)
    fee_cents = models.PositiveIntegerField(default=0)
    fee_paid = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=DRAFT)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.title} ({self.status})"

    @property
    def is_active(self):
        if self.status != self.ACTIVE:
            return False
        if self.expires_at is None:
            return True
        return self.expires_at >= timezone.now()


class PaymentSession(models.Model):
    KIND_JOB_POSTING = "job_posting"
    KIND_APPLICATION = "application"
    KIND_CHOICES = (
        (KIND_JOB_POSTING, "Job posting"),
        (KIND_APPLICATION, "Application"),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="payment_sessions"
    )
    job = models.ForeignKey(
        JobPosting,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="payment_sessions",
    )
    kind = models.CharField(max_length=20, choices=KIND_CHOICES)
    stripe_session_id = models.CharField(max_length=255, unique=True)
    amount_cents = models.PositiveIntegerField()
    obol_amount = models.PositiveSmallIntegerField(
        choices=OBOL_CHOICES, null=True, blank=True
    )
    is_paid = models.BooleanField(default=False)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.kind}:{self.stripe_session_id}"


class Application(models.Model):
    job = models.ForeignKey(
        JobPosting, on_delete=models.CASCADE, related_name="applications"
    )
    applicant = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="applications"
    )
    resume_text = models.TextField()
    notes = models.TextField(blank=True)
    obol_amount = models.PositiveSmallIntegerField(choices=OBOL_CHOICES, default=0)
    payment_session = models.ForeignKey(
        PaymentSession,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="applications",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=("job", "applicant"), name="unique_application_per_user_and_job"
            )
        ]

    def __str__(self):
        return f"{self.applicant.username} -> {self.job.title}"
