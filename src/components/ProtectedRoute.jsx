import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({
  children,
  allowedRoles,
}) {
  const {
    currentUser,
    userProfile,
    loading,
  } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="font-semibold text-slate-600">
          Loading...
        </p>
      </div>
    );
  }

  if (!currentUser || !userProfile) {
    return <Navigate to="/login" replace />;
  }

  if (
    allowedRoles?.length &&
    !allowedRoles.includes(userProfile.role)
  ) {
    if (userProfile.role === "user") {
      return <Navigate to="/create-ticket" replace />;
    }

    if (userProfile.role === "IT_STAFF") {
      return <Navigate to="/dashboard" replace />;
    }

    if (userProfile.role === "admin") {
      return <Navigate to="/dashboard" replace />;
    }

    return <Navigate to="/login" replace />;
  }

  return children;
}