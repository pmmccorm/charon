import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useAuth } from "../context/AuthContext";

const PENDING_PAYMENT_KEY = "charon_pending_payment";

export default function JobDetailPage() {
  const { jobId } = useParams();
  const { user, authenticatedRequest } = useAuth();
  const [job, setJob] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [applicationForm, setApplicationForm] = useState({
    resume_text: "",
    notes: "",
    obol_amount: "0",
  });

  const canApply = useMemo(
    () => user?.role === "job_seeker" && job?.is_active,
    [job?.is_active, user?.role],
  );

  const loadDetails = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [jobPayload, metricsPayload] = await Promise.all([
        authenticatedRequest(`/jobs/${jobId}/`),
        authenticatedRequest(`/jobs/${jobId}/metrics/`),
      ]);
      setJob(jobPayload);
      setMetrics(metricsPayload);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [authenticatedRequest, jobId]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const handleApplicationSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setStatusMessage("");

    const obolAmount = Number(applicationForm.obol_amount);

    try {
      if (obolAmount > 0) {
        const paymentResponse = await authenticatedRequest("/payments/application-session/", {
          method: "POST",
          data: {
            job_id: job.id,
            obol_amount: obolAmount,
          },
        });

        window.localStorage.setItem(
          PENDING_PAYMENT_KEY,
          JSON.stringify({
            type: "application",
            jobId: job.id,
            applicationPayload: {
              resume_text: applicationForm.resume_text,
              notes: applicationForm.notes,
              obol_amount: obolAmount,
              payment_session_id: paymentResponse.payment_session.id,
            },
          }),
        );
        window.location.assign(paymentResponse.checkout_url);
        return;
      }

      await authenticatedRequest(`/jobs/${job.id}/apply/`, {
        method: "POST",
        data: {
          resume_text: applicationForm.resume_text,
          notes: applicationForm.notes,
          obol_amount: obolAmount,
        },
      });
      setStatusMessage("Application submitted successfully.");
      setApplicationForm({ resume_text: "", notes: "", obol_amount: "0" });
      await loadDetails();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <section className="page-shell">
        <p>Loading job details...</p>
      </section>
    );
  }

  if (error && !job) {
    return (
      <section className="page-shell">
        <p className="error-banner">{error}</p>
      </section>
    );
  }

  return (
    <section className="page-shell">
      {error && <p className="error-banner">{error}</p>}
      {statusMessage && <p className="success-banner">{statusMessage}</p>}

      {job && (
        <article className="content-card">
          <h1>{job.title}</h1>
          <p className="muted">
            {job.location || "Remote / Unspecified location"} | Posted by{" "}
            {job.employer?.username || "Employer"}
          </p>
          <p>{job.description}</p>
          <div className="pill-row">
            <span className="pill">Status: {job.status}</span>
            <span className="pill">Employer fee paid: {job.fee_paid ? "Yes" : "No"}</span>
            <span className="pill">
              Expires: {job.expires_at ? new Date(job.expires_at).toLocaleString() : "Never"}
            </span>
          </div>
        </article>
      )}

      {metrics && (
        <div className="chart-grid">
          <article className="content-card">
            <h2>Obol Distribution</h2>
            <p className="muted">How much applicants are willing to bid for visibility.</p>
            <div className="chart-box">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={metrics.obol_distribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="obol_amount" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2b7fff" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="content-card">
            <h2>Applications Over Time</h2>
            <p className="muted">An anonymized trend line of inbound application volume.</p>
            <div className="chart-box">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={metrics.applications_over_time}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#00a77a" strokeWidth={3} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="muted">Total applications: {metrics.application_count}</p>
          </article>
        </div>
      )}

      {user?.role === "job_seeker" && (
        <article className="content-card">
          <h2>Apply</h2>
          {canApply ? (
            <form className="form-grid" onSubmit={handleApplicationSubmit}>
              <label>
                Resume text
                <textarea
                  required
                  rows={8}
                  value={applicationForm.resume_text}
                  onChange={(event) =>
                    setApplicationForm((current) => ({
                      ...current,
                      resume_text: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Notes
                <textarea
                  rows={4}
                  value={applicationForm.notes}
                  onChange={(event) =>
                    setApplicationForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Obol amount
                <select
                  value={applicationForm.obol_amount}
                  onChange={(event) =>
                    setApplicationForm((current) => ({
                      ...current,
                      obol_amount: event.target.value,
                    }))
                  }
                >
                  <option value="0">$0</option>
                  <option value="1">$1</option>
                  <option value="3">$3</option>
                  <option value="5">$5</option>
                </select>
              </label>
              <button type="submit" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit application"}
              </button>
            </form>
          ) : (
            <p className="muted">This job is not currently accepting applications.</p>
          )}
        </article>
      )}
    </section>
  );
}
