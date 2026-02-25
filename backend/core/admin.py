from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Application, JobPosting, PaymentSession, User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ("Role", {"fields": ("role", "paper_money_enabled")}),
    )
    list_display = ("username", "email", "role", "paper_money_enabled", "is_staff")


@admin.register(JobPosting)
class JobPostingAdmin(admin.ModelAdmin):
    list_display = ("title", "employer", "status", "fee_paid", "created_at")
    search_fields = ("title", "description", "employer__username")
    list_filter = ("status", "fee_paid")


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ("job", "applicant", "obol_amount", "created_at")
    search_fields = ("job__title", "applicant__username")
    list_filter = ("obol_amount",)


@admin.register(PaymentSession)
class PaymentSessionAdmin(admin.ModelAdmin):
    list_display = ("kind", "user", "job", "amount_cents", "is_paid", "created_at")
    search_fields = ("stripe_session_id", "user__username", "job__title")
    list_filter = ("kind", "is_paid")
