import {
  Navigate,
  Outlet,
} from "react-router-dom";

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

  const hasAllowedRole =
    !allowedRoles?.length ||
    allowedRoles.includes(userProfile.role);

  if (!hasAllowedRole) {
    const roleHome = {
      admin: "/dashboard",
      IT_STAFF: "/dashboard",
      QA: "/events",
      user: "/create-ticket",
    };

    return (
      <Navigate
        to={roleHome[userProfile.role] || "/login"}
        replace
      />
    );
  }

  return children || <Outlet />;
}