import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  TicketCheck,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();

  const {
    currentUser,
    userProfile,
    login,
  } = useAuth();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (currentUser && userProfile) {
    if (userProfile.role === "user") {
      return (
        <Navigate
          to="/create-ticket"
          replace
        />
      );
    }

    if (userProfile.role === "technician") {
      return (
        <Navigate
          to="/all-tickets"
          replace
        />
      );
    }

    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setMessage("");
    setSubmitting(true);

    try {
      const result = await login(
        form.email.trim().toLowerCase(),
        form.password
      );

      const role = result.profile?.role;

      if (role === "admin") {
        navigate("/dashboard", {
          replace: true,
        });
      } else if (role === "technician") {
        navigate("/all-tickets", {
          replace: true,
        });
      } else if (role === "user") {
        navigate("/create-ticket", {
          replace: true,
        });
      } else {
        throw new Error(
          "Your account role is invalid. Please contact the MIS administrator."
        );
      }
    } catch (error) {
      console.error("Firebase login error:", error);
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);

      if (error.code === "auth/invalid-credential") {
        setMessage("Invalid email address or password.");
      } else if (error.code === "auth/user-disabled") {
        setMessage("This account has been disabled.");
      } else if (error.code === "auth/too-many-requests") {
        setMessage(
          "Too many failed login attempts. Please try again later."
        );
      } else if (error.code === "auth/operation-not-allowed") {
        setMessage(
          "Email and password login is not enabled in Firebase."
        );
      } else if (error.code === "auth/network-request-failed") {
        setMessage(
          "Network error. Please check your internet connection."
        );
      } else if (error.code === "auth/api-key-not-valid") {
        setMessage(
          "Firebase configuration is invalid. Please check your .env file."
        );
      } else if (
        error.message?.includes("profile was not found")
      ) {
        setMessage(
          "Your account exists, but your Firestore user profile is missing."
        );
      } else if (
        error.message?.includes("currently inactive")
      ) {
        setMessage(
          "Your account is inactive. Please contact the MIS administrator."
        );
      } else if (
        error.message?.includes("account role is invalid")
      ) {
        setMessage(
          "Your account role is invalid. Please contact the MIS administrator."
        );
      } else {
        setMessage(
          error.message || "Unable to sign in."
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-slate-100 lg:grid-cols-2">
      <section className="hidden bg-linear-to-br from-blue-700 via-blue-800 to-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white/10 p-3">
            <TicketCheck size={30} />
          </div>

          <div>
            <p className="text-lg font-bold">
              MIS Helpdesk
            </p>

            <p className="text-sm text-blue-200">
              Ticketing and Support System
            </p>
          </div>
        </div>

        <div className="max-w-xl">
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.3em] text-blue-300">
            Organized MIS support
          </p>

          <h1 className="text-5xl font-bold leading-tight">
            Submit and track every department concern.
          </h1>

          <p className="mt-6 max-w-lg text-lg leading-8 text-blue-100">
            A centralized platform for submitting, assigning,
            monitoring, and resolving MIS support requests.
          </p>
        </div>

        <p className="text-sm text-blue-300">
          Management Information Systems Department
        </p>
      </section>

      <section className="flex items-center justify-center px-3 py-8 sm:px-6 sm:py-12">
        <div className="w-full max-w-md">
          <div className="mb-7 lg:hidden">
            <div className="mb-4 inline-flex rounded-2xl bg-blue-600 p-3 text-white">
              <TicketCheck size={28} />
            </div>

            <h1 className="text-2xl font-bold text-slate-900">
              MIS Helpdesk
            </h1>

            <p className="mt-1 text-slate-500">
              Ticketing and Support System
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/70 sm:rounded-3xl sm:p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                Welcome back
              </h2>

              <p className="mt-2 text-slate-500">
                Enter your account details to continue.
              </p>
            </div>

            {message && (
              <div
                role="alert"
                className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {message}
              </div>
            )}

            <form
              className="space-y-5"
              onSubmit={handleSubmit}
            >
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Email address
                </label>

                <div className="relative">
                  <Mail
                    size={19}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    required
                    autoComplete="email"
                    placeholder="name@organization.com"
                    disabled={submitting}
                    className="w-full rounded-xl border border-slate-300 py-3.5 pl-12 pr-4 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-semibold text-slate-700"
                >
                  Password
                </label>

                <div className="relative">
                  <LockKeyhole
                    size={19}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    id="password"
                    name="password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    value={form.password}
                    onChange={handleChange}
                    required
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    disabled={submitting}
                    className="w-full rounded-xl border border-slate-300 py-3.5 pl-12 pr-12 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (previous) => !previous
                      )
                    }
                    disabled={submitting}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 disabled:cursor-not-allowed"
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showPassword ? (
                      <EyeOff size={19} />
                    ) : (
                      <Eye size={19} />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-blue-600 px-4 py-3.5 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {submitting
                  ? "Signing in..."
                  : "Sign in"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              Contact the MIS administrator if you do not have an
              account.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
