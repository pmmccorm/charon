import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

const PENDING_PAYMENT_KEY = "charon_pending_payment";

const initialJobForm = {
  title: "",
  description: "",
  location: "",
  duration_days: 30,
};

function formatDollarsFromCents(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function EmployerDashboard() {
  const { user, authenticatedRequest } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [jobForm, setJobForm] = useState(initialJobForm);
  const [applicantsByJob, setApplicantsByJob] = useState({});
  const [expandedJobId, setExpandedJobId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const ownJobs = useMemo(
    () => jobs.filter((job) => job.employer?.id === user?.id),
    [jobs, user?.id],
  );

  const loadJobs = useCallback(async () => {
    setLoadingJobs(true);
    setError("");
    try {
      const payload = await authenticatedRequest("/jobs/");
      setJobs(payload);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoadingJobs(false);
    }
  }, [authenticatedRequest]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const handleCreateJob = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setStatusMessage("");

    try {
      const job = await authenticatedRequest("/jobs/", {
        method: "POST",
        data: {
          title: jobForm.title,
          description: jobForm.description,
          location: jobForm.location,
          duration_days: Number(jobForm.duration_days),
        },
      });

      setJobForm(initialJobForm);

      if (!job.fee_paid && job.fee_cents > 0 && !user?.paper_money_enabled) {
        const paymentResponse = await authenticatedRequest("/payments/job-session/", {
          method: "POST",
          data: { job_id: job.id },
        });
        if (!paymentResponse.payment_required) {
          setStatusMessage("Job created and activated with simulated paper money.");
          await loadJobs();
          return;
        }
        window.localStorage.setItem(
          PENDING_PAYMENT_KEY,
          JSON.stringify({
            type: "job_posting",
            jobId: job.id,
          }),
        );
        window.location.assign(paymentResponse.checkout_url);
        return;
      }

      setStatusMessage(
        user?.paper_money_enabled
          ? "Job created and activated with simulated paper money."
          : "Job created and activated.",
      );
      await loadJobs();
    } catch (createError) {
      setError(createError.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleApplicants = async (jobId) => {
    if (expandedJobId === jobId) {
      setExpandedJobId(null);
      return;
    }
    setExpandedJobId(jobId);

    if (applicantsByJob[jobId]) {
      return;
    }

    try {
      const applicants = await authenticatedRequest(`/jobs/${jobId}/applicants/`);
      setApplicantsByJob((current) => ({ ...current, [jobId]: applicants }));
    } catch (applicantsError) {
      setError(applicantsError.message);
    }
  };

  return (
    <section className="page-shell">
      <div className="page-header">
        <h1>Employer Dashboard</h1>
        <p className="muted">
          Post a role, pay the fixed listing fee, and review anonymized application demand.
        </p>
        {user?.paper_money_enabled && (
          <p className="muted">
            Paper money mode is enabled for your account. Posting fees are simulated without
            Stripe checkout.
          </p>
        )}
      </div>

      {error && <p className="error-banner">{error}</p>}
      {statusMessage && <p className="success-banner">{statusMessage}</p>}

      <article className="content-card">
        <h2>Create New Job Posting</h2>
        <form className="form-grid" onSubmit={handleCreateJob}>
          <label>
            Title
            <input
              required
              value={jobForm.title}
              onChange={(event) =>
                setJobForm((current) => ({ ...current, title: event.target.value }))
              }
            />
          </label>
          <label>
            Location
            <input
              value={jobForm.location}
              onChange={(event) =>
                setJobForm((current) => ({ ...current, location: event.target.value }))
              }
            />
          </label>
          <label>
            Duration (days)
            <input
              min={1}
              max={365}
              type="number"
              value={jobForm.duration_days}
              onChange={(event) =>
                setJobForm((current) => ({ ...current, duration_days: event.target.value }))
              }
            />
          </label>
          <label>
            Description
            <textarea
              required
              rows={6}
              value={jobForm.description}
              onChange={(event) =>
                setJobForm((current) => ({ ...current, description: event.target.value }))
              }
            />
          </label>
          <button type="submit" disabled={busy}>
            {busy ? "Creating..." : "Create posting"}
          </button>
        </form>
      </article>

      <article className="content-card">
        <h2>Your Job Postings</h2>
        {loadingJobs ? (
          <p>Loading your jobs...</p>
        ) : ownJobs.length === 0 ? (
          <p>You have not created any jobs yet.</p>
        ) : (
          <div className="stack-list">
            {ownJobs.map((job) => {
              const applicants = applicantsByJob[job.id] || [];
              const isExpanded = expandedJobId === job.id;
              return (
                <div key={job.id} className="nested-card">
                  <h3>{job.title}</h3>
                  <p className="muted">
                    {job.location || "Remote"} | Fee {formatDollarsFromCents(job.fee_cents)} |{" "}
                    {job.fee_paid ? "Paid" : "Awaiting payment"}
                  </p>
                  <div className="inline-actions">
                    <Link to={`/jobs/${job.id}`} className="link-button">
                      View metrics
                    </Link>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => toggleApplicants(job.id)}
                    >
                      {isExpanded ? "Hide applicants" : "View applicants"}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="applicant-list">
                      {applicants.length === 0 ? (
                        <p className="muted">No applicants yet.</p>
                      ) : (
                        applicants.map((application) => (
                          <article key={application.id} className="nested-card">
                            <p>
                              <strong>
                                {application.applicant.first_name}{" "}
                                {application.applicant.last_name}
                              </strong>{" "}
                              ({application.applicant.username}) - Obol ${application.obol_amount}
                            </p>
                            <p className="muted">{application.applicant.email}</p>
                            <p>{application.resume_text}</p>
                            {application.notes && (
                              <p>
                                <strong>Notes:</strong> {application.notes}
                              </p>
                            )}
                          </article>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </article>
    </section>
  );
}
