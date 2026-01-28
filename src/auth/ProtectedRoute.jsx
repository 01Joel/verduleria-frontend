import { Navigate, Outlet } from "react-router-dom";
import { useAppStore } from "../store/useAppStore";

export default function ProtectedRoute({ roles }) {
  const { token, user } = useAppStore();

  if (!token || !user) return <Navigate to="/login" replace />;

  if (Array.isArray(roles) && roles.length > 0) {
    if (!roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
