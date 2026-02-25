from rest_framework.permissions import BasePermission

from .models import User


class IsEmployer(BasePermission):
    message = "This action is only available to employer accounts."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == User.EMPLOYER
        )


class IsJobSeeker(BasePermission):
    message = "This action is only available to job seeker accounts."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == User.JOB_SEEKER
        )
