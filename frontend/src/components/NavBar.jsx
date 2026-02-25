import { NavLink } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

function activeClass({ isActive }) {
  return isActive ? "nav-link nav-link-active" : "nav-link";
}

export default function NavBar() {
  const { user, logout } = useAuth();

  return (
    <header className="nav-shell">
      <div className="brand">Resume Charon</div>
      {user ? (
        <nav className="nav-links">
          <NavLink to="/jobs" className={activeClass}>
            Jobs
          </NavLink>
          {user.role === "employer" && (
            <NavLink to="/dashboard" className={activeClass}>
              Employer Dashboard
            </NavLink>
          )}
          <span className="user-pill">
            {user.username} ({user.role})
          </span>
          <button type="button" className="secondary-button" onClick={logout}>
            Logout
          </button>
        </nav>
      ) : (
        <nav className="nav-links">
          <NavLink to="/auth" className={activeClass}>
            Sign In
          </NavLink>
        </nav>
      )}
    </header>
  );
}
