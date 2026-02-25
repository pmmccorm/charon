import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import NavBar from "./components/NavBar";
import { AuthProvider, useAuth } from "./context/AuthContext";
import "./App.css";
import AuthPage from "./pages/AuthPage";
import EmployerDashboard from "./pages/EmployerDashboard";
import JobDetailPage from "./pages/JobDetailPage";
import JobsPage from "./pages/JobsPage";
import PaymentResultPage from "./pages/PaymentResultPage";

function AuthenticatedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="page-shell">Loading session...</div>;
  }
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  return children;
}

function EmployerOnlyRoute({ children }) {
  const { user } = useAuth();
  if (!user || user.role !== "employer") {
    return <Navigate to="/jobs" replace />;
  }
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="page-shell">Loading session...</div>;
  }

  return (
    <BrowserRouter>
      <NavBar />
      <main className="main-content">
        <Routes>
          <Route
            path="/auth"
            element={user ? <Navigate to="/jobs" replace /> : <AuthPage />}
          />
          <Route
            path="/jobs"
            element={
              <AuthenticatedRoute>
                <JobsPage />
              </AuthenticatedRoute>
            }
          />
          <Route
            path="/jobs/:jobId"
            element={
              <AuthenticatedRoute>
                <JobDetailPage />
              </AuthenticatedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <AuthenticatedRoute>
                <EmployerOnlyRoute>
                  <EmployerDashboard />
                </EmployerOnlyRoute>
              </AuthenticatedRoute>
            }
          />
          <Route
            path="/payments/success"
            element={
              <AuthenticatedRoute>
                <PaymentResultPage success />
              </AuthenticatedRoute>
            }
          />
          <Route
            path="/payments/cancel"
            element={
              <AuthenticatedRoute>
                <PaymentResultPage success={false} />
              </AuthenticatedRoute>
            }
          />
          <Route
            path="*"
            element={<Navigate to={user ? "/jobs" : "/auth"} replace />}
          />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
