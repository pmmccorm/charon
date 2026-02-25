from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from .models import User


@override_settings(JOB_POSTING_FEE_CENTS=0)
class CoreApiFlowTests(APITestCase):
    employer_password = "EmployerPass123!"
    seeker_password = "SeekerPass123!"

    def setUp(self):
        self.employer = User.objects.create_user(
            username="employer1",
            password=self.employer_password,
            role=User.EMPLOYER,
            email="employer@example.com",
        )
        self.job_seeker = User.objects.create_user(
            username="jobseeker1",
            password=self.seeker_password,
            role=User.JOB_SEEKER,
            email="jobseeker@example.com",
        )

    def authenticate(self, username, password):
        token_response = self.client.post(
            "/api/auth/token/",
            {"username": username, "password": password},
            format="json",
        )
        self.assertEqual(token_response.status_code, status.HTTP_200_OK)
        access = token_response.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

    def test_end_to_end_post_and_apply_flow(self):
        self.authenticate(self.employer.username, self.employer_password)

        create_job_response = self.client.post(
            "/api/jobs/",
            {
                "title": "Senior Backend Engineer",
                "description": "Build robust APIs.",
                "location": "Remote",
                "duration_days": 30,
            },
            format="json",
        )
        self.assertEqual(create_job_response.status_code, status.HTTP_201_CREATED)
        job_id = create_job_response.data["id"]
        self.assertEqual(create_job_response.data["status"], "active")

        self.authenticate(self.job_seeker.username, self.seeker_password)

        list_jobs_response = self.client.get("/api/jobs/")
        self.assertEqual(list_jobs_response.status_code, status.HTTP_200_OK)
        self.assertTrue(any(job["id"] == job_id for job in list_jobs_response.data))

        apply_response = self.client.post(
            f"/api/jobs/{job_id}/apply/",
            {
                "resume_text": "10 years in Python and Django.",
                "notes": "Happy to discuss architecture work.",
                "obol_amount": 0,
            },
            format="json",
        )
        self.assertEqual(apply_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(apply_response.data["obol_amount"], 0)

        metrics_response = self.client.get(f"/api/jobs/{job_id}/metrics/")
        self.assertEqual(metrics_response.status_code, status.HTTP_200_OK)
        self.assertEqual(metrics_response.data["application_count"], 1)

    def test_job_seeker_cannot_create_job_posting(self):
        self.authenticate(self.job_seeker.username, self.seeker_password)
        response = self.client.post(
            "/api/jobs/",
            {
                "title": "Unauthorized Job",
                "description": "Should not be created.",
                "location": "N/A",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


@override_settings(JOB_POSTING_FEE_CENTS=9900)
class PaperMoneyFlowTests(APITestCase):
    employer_password = "EmployerPass123!"
    paper_seeker_password = "PaperSeekerPass123!"
    regular_seeker_password = "RegularSeekerPass123!"

    def setUp(self):
        self.paper_employer = User.objects.create_user(
            username="paperemployer",
            password=self.employer_password,
            role=User.EMPLOYER,
            email="paperemployer@example.com",
            paper_money_enabled=True,
        )
        self.paper_job_seeker = User.objects.create_user(
            username="paperjobseeker",
            password=self.paper_seeker_password,
            role=User.JOB_SEEKER,
            email="paperjobseeker@example.com",
            paper_money_enabled=True,
        )
        self.regular_job_seeker = User.objects.create_user(
            username="regularjobseeker",
            password=self.regular_seeker_password,
            role=User.JOB_SEEKER,
            email="regularjobseeker@example.com",
            paper_money_enabled=False,
        )

    def authenticate(self, username, password):
        token_response = self.client.post(
            "/api/auth/token/",
            {"username": username, "password": password},
            format="json",
        )
        self.assertEqual(token_response.status_code, status.HTTP_200_OK)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token_response.data['access']}")

    def create_job_as_paper_employer(self):
        self.authenticate(self.paper_employer.username, self.employer_password)
        response = self.client.post(
            "/api/jobs/",
            {
                "title": "Paper Money Engineer",
                "description": "Payments are simulated for this posting.",
                "location": "Remote",
                "duration_days": 30,
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return response

    def test_paper_money_employer_can_skip_stripe_for_listing_fee(self):
        create_job_response = self.create_job_as_paper_employer()
        self.assertTrue(create_job_response.data["fee_paid"])
        self.assertEqual(create_job_response.data["status"], "active")
        self.assertEqual(create_job_response.data["fee_cents"], 9900)

    def test_paper_money_job_seeker_can_submit_paid_obol_without_payment_session(self):
        create_job_response = self.create_job_as_paper_employer()
        job_id = create_job_response.data["id"]

        self.authenticate(self.paper_job_seeker.username, self.paper_seeker_password)
        apply_response = self.client.post(
            f"/api/jobs/{job_id}/apply/",
            {
                "resume_text": "Paper money candidate resume.",
                "notes": "Applying with a simulated paid obol.",
                "obol_amount": 5,
            },
            format="json",
        )
        self.assertEqual(apply_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(apply_response.data["obol_amount"], 5)

    def test_non_paper_job_seeker_still_requires_paid_session_for_paid_obol(self):
        create_job_response = self.create_job_as_paper_employer()
        job_id = create_job_response.data["id"]

        self.authenticate(self.regular_job_seeker.username, self.regular_seeker_password)
        apply_response = self.client.post(
            f"/api/jobs/{job_id}/apply/",
            {
                "resume_text": "Regular candidate resume.",
                "notes": "Trying to pay without Stripe.",
                "obol_amount": 3,
            },
            format="json",
        )
        self.assertEqual(apply_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("payment_session_id", str(apply_response.data))
