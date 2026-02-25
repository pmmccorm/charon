import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

const initialRegisterState = {
  username: "",
  password: "",
  confirmPassword: "",
  email: "",
  first_name: "",
  last_name: "",
  role: "job_seeker",
  paper_money_enabled: false,
};

export default function AuthPage() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [registerForm, setRegisterForm] = useState(initialRegisterState);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(loginForm);
      navigate("/jobs", { replace: true });
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (event) => {
    event.preventDefault();
    setError("");
    if (registerForm.password !== registerForm.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await register({
        username: registerForm.username,
        password: registerForm.password,
        email: registerForm.email,
        first_name: registerForm.first_name,
        last_name: registerForm.last_name,
        role: registerForm.role,
        paper_money_enabled: registerForm.paper_money_enabled,
      });
      navigate("/jobs", { replace: true });
    } catch (registerError) {
      setError(registerError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="auth-page">
      <div className="auth-card">
        <h1>Resume Charon</h1>
        <p className="muted">
          Sign in as an employer to post jobs, or as a job seeker to apply with an obol.
        </p>
        <div className="tab-row">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={mode === "login" ? "tab-button active-tab" : "tab-button"}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={mode === "register" ? "tab-button active-tab" : "tab-button"}
          >
            Register
          </button>
        </div>

        {error && <p className="error-banner">{error}</p>}

        {mode === "login" ? (
          <form onSubmit={handleLogin} className="form-grid">
            <label>
              Username
              <input
                required
                value={loginForm.username}
                onChange={(event) =>
                  setLoginForm((current) => ({ ...current, username: event.target.value }))
                }
              />
            </label>
            <label>
              Password
              <input
                required
                type="password"
                value={loginForm.password}
                onChange={(event) =>
                  setLoginForm((current) => ({ ...current, password: event.target.value }))
                }
              />
            </label>
            <button disabled={busy} type="submit">
              {busy ? "Signing in..." : "Sign In"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="form-grid">
            <label>
              Username
              <input
                required
                value={registerForm.username}
                onChange={(event) =>
                  setRegisterForm((current) => ({ ...current, username: event.target.value }))
                }
              />
            </label>
            <label>
              Email
              <input
                required
                type="email"
                value={registerForm.email}
                onChange={(event) =>
                  setRegisterForm((current) => ({ ...current, email: event.target.value }))
                }
              />
            </label>
            <label>
              First name
              <input
                value={registerForm.first_name}
                onChange={(event) =>
                  setRegisterForm((current) => ({ ...current, first_name: event.target.value }))
                }
              />
            </label>
            <label>
              Last name
              <input
                value={registerForm.last_name}
                onChange={(event) =>
                  setRegisterForm((current) => ({ ...current, last_name: event.target.value }))
                }
              />
            </label>
            <label>
              Role
              <select
                value={registerForm.role}
                onChange={(event) =>
                  setRegisterForm((current) => ({ ...current, role: event.target.value }))
                }
              >
                <option value="job_seeker">Job seeker</option>
                <option value="employer">Employer</option>
              </select>
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={registerForm.paper_money_enabled}
                onChange={(event) =>
                  setRegisterForm((current) => ({
                    ...current,
                    paper_money_enabled: event.target.checked,
                  }))
                }
              />
              Use paper money (simulate fees and obols without Stripe)
            </label>
            <label>
              Password
              <input
                required
                minLength={8}
                type="password"
                value={registerForm.password}
                onChange={(event) =>
                  setRegisterForm((current) => ({ ...current, password: event.target.value }))
                }
              />
            </label>
            <label>
              Confirm password
              <input
                required
                minLength={8}
                type="password"
                value={registerForm.confirmPassword}
                onChange={(event) =>
                  setRegisterForm((current) => ({
                    ...current,
                    confirmPassword: event.target.value,
                  }))
                }
              />
            </label>
            <button disabled={busy} type="submit">
              {busy ? "Creating account..." : "Create Account"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
