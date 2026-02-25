import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

function formatMoneyFromCents(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

export default function JobsPage() {
  const { authenticatedRequest, user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadJobs = useCallback(
    async (searchQuery = "") => {
      setLoading(true);
      setError("");
      try {
        const encodedQuery = encodeURIComponent(searchQuery);
        const path = encodedQuery ? `/jobs/?q=${encodedQuery}` : "/jobs/";
        const payload = await authenticatedRequest(path);
        setJobs(payload);
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        setLoading(false);
      }
    },
    [authenticatedRequest],
  );

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const handleSearch = async (event) => {
    event.preventDefault();
    await loadJobs(query);
  };

  return (
    <section className="page-shell">
      <div className="page-header">
        <h1>Job Listings</h1>
        <p className="muted">Search and apply with an optional obol ($0 / $1 / $3 / $5).</p>
      </div>

      <form className="inline-form" onSubmit={handleSearch}>
        <input
          placeholder="Search title, location, or description"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="submit" disabled={loading}>
          Search
        </button>
      </form>

      {error && <p className="error-banner">{error}</p>}

      {loading ? (
        <p>Loading jobs...</p>
      ) : jobs.length === 0 ? (
        <p>No jobs found.</p>
      ) : (
        <div className="card-grid">
          {jobs.map((job) => (
            <article key={job.id} className="content-card">
              <h2>{job.title}</h2>
              <p className="muted">{job.location || "Remote / Unspecified location"}</p>
              <p className="job-snippet">{job.description.slice(0, 200)}</p>
              <div className="pill-row">
                <span className="pill">Status: {job.status}</span>
                <span className="pill">
                  Employer fee: {formatMoneyFromCents(job.fee_cents)}{" "}
                  {job.fee_paid ? "(paid)" : "(unpaid)"}
                </span>
              </div>
              {job.employer?.id === user?.id && <p className="muted">Your posting</p>}
              <Link to={`/jobs/${job.id}`} className="link-button">
                View details
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
