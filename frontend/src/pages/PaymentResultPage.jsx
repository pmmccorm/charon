import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

const PENDING_PAYMENT_KEY = "charon_pending_payment";

export default function PaymentResultPage({ success }) {
  const location = useLocation();
  const { authenticatedRequest } = useAuth();
  const [busy, setBusy] = useState(success);
  const [error, setError] = useState("");
  const [message, setMessage] = useState(
    success ? "Verifying payment..." : "Payment cancelled. No charge was captured.",
  );

  const stripeSessionId = useMemo(() => {
    const query = new URLSearchParams(location.search);
    return query.get("session_id");
  }, [location.search]);

  useEffect(() => {
    if (!success) {
      window.localStorage.removeItem(PENDING_PAYMENT_KEY);
      return;
    }

    let isCancelled = false;
    const run = async () => {
      setBusy(true);
      setError("");
      try {
        if (!stripeSessionId) {
          setMessage("Payment complete, but no session id was provided.");
          return;
        }

        await authenticatedRequest("/payments/confirm-session/", {
          method: "POST",
          data: { stripe_session_id: stripeSessionId },
        });

        const rawPending = window.localStorage.getItem(PENDING_PAYMENT_KEY);
        if (!rawPending) {
          setMessage("Payment confirmed.");
          return;
        }

        const pending = JSON.parse(rawPending);
        if (pending.type === "application") {
          await authenticatedRequest(`/jobs/${pending.jobId}/apply/`, {
            method: "POST",
            data: pending.applicationPayload,
          });
          setMessage("Payment confirmed and application submitted.");
        } else if (pending.type === "job_posting") {
          setMessage("Payment confirmed and the job posting is now active.");
        } else {
          setMessage("Payment confirmed.");
        }

        window.localStorage.removeItem(PENDING_PAYMENT_KEY);
      } catch (verificationError) {
        if (!isCancelled) {
          setError(verificationError.message);
          setMessage("Payment verification failed.");
        }
      } finally {
        if (!isCancelled) {
          setBusy(false);
        }
      }
    };

    run();
    return () => {
      isCancelled = true;
    };
  }, [authenticatedRequest, stripeSessionId, success]);

  return (
    <section className="page-shell">
      <article className="content-card">
        <h1>{success ? "Payment Success" : "Payment Cancelled"}</h1>
        {error && <p className="error-banner">{error}</p>}
        <p>{message}</p>
        {busy && <p className="muted">Please wait...</p>}
        <div className="inline-actions">
          <Link to="/jobs" className="link-button">
            Back to jobs
          </Link>
          <Link to="/dashboard" className="secondary-link">
            Employer dashboard
          </Link>
        </div>
      </article>
    </section>
  );
}
