import { useEffect, useState } from "react";
import {
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import {
  createUserWithEmailAndPassword,
  getAuth,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
} from "firebase/auth";

import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import {
  deleteApp,
  initializeApp,
} from "firebase/app";

import {
  db,
  firebaseConfig,
} from "../firebase/firebase";

const initialForm = {
  fullName: "",
  email: "",
  password: "",
  department: "",
  role: "user",
};

export default function UserManagement() {
  const [form, setForm] = useState(initialForm);
  const [users, setUsers] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [editingUserId, setEditingUserId] = useState(null);
  const [editForm, setEditForm] = useState({
    fullName: "",
    department: "",
    role: "user",
    status: "active",
  });
  const [savingUser, setSavingUser] = useState(false);
  const [resettingUserId, setResettingUserId] = useState(null);

  useEffect(() => {
    const usersQuery = query(
      collection(db, "users"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      usersQuery,
      (snapshot) => {
        const userList = snapshot.docs.map((userDocument) => ({
          id: userDocument.id,
          ...userDocument.data(),
        }));

        setUsers(userList);
        setLoadingUsers(false);
      },
      (error) => {
        console.error("Unable to load users:", error);
        setLoadingUsers(false);
      }
    );

    return unsubscribe;
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setSubmitting(true);
    setMessage("");
    setMessageType("");

    let secondaryApp = null;

    try {
      const email = form.email.trim().toLowerCase();
      const fullName = form.fullName.trim();
      const department = form.department.trim();

      if (!fullName) {
        throw new Error("Full name is required.");
      }

      if (!department) {
        throw new Error("Department is required.");
      }

      if (form.password.length < 8) {
        throw new Error(
          "Temporary password must contain at least 8 characters."
        );
      }

      const secondaryAppName = `user-creation-${Date.now()}`;

      secondaryApp = initializeApp(
        firebaseConfig,
        secondaryAppName
      );

      const secondaryAuth = getAuth(secondaryApp);

      const userCredential =
        await createUserWithEmailAndPassword(
          secondaryAuth,
          email,
          form.password
        );

      const newUser = userCredential.user;

      await updateProfile(newUser, {
        displayName: fullName,
      });

      await setDoc(doc(db, "users", newUser.uid), {
        uid: newUser.uid,
        fullName,
        email,
        department,
        role: form.role,
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await signOut(secondaryAuth);

      setForm(initialForm);
      setShowPassword(false);
      setMessage("User account created successfully.");
      setMessageType("success");
    } catch (error) {
      console.error("Create user error:", error);

      let readableMessage =
        error.message || "Unable to create the user account.";

      if (error.code === "auth/email-already-in-use") {
        readableMessage =
          "An account with this email address already exists.";
      } else if (error.code === "auth/invalid-email") {
        readableMessage = "Please enter a valid email address.";
      } else if (error.code === "auth/weak-password") {
        readableMessage =
          "The temporary password is too weak.";
      } else if (
        error.code === "permission-denied" ||
        error.code === "firestore/permission-denied"
      ) {
        readableMessage =
          "Your Firestore rules do not allow this action.";
      }

      setMessage(readableMessage);
      setMessageType("error");
    } finally {
      if (secondaryApp) {
        await deleteApp(secondaryApp).catch((error) => {
          console.error(
            "Unable to remove secondary Firebase app:",
            error
          );
        });
      }

      setSubmitting(false);
    }
  };

  const startEditing = (user) => {
    setEditingUserId(user.id);
    setEditForm({
      fullName: user.fullName || "",
      department: user.department || "",
      role: user.role || "user",
      status: user.status || "active",
    });
    setMessage("");
    setMessageType("");
  };

  const cancelEditing = () => {
    setEditingUserId(null);
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;

    setEditForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSaveUser = async (event) => {
    event.preventDefault();

    const fullName = editForm.fullName.trim();
    const department = editForm.department.trim();

    if (!fullName || !department) {
      setMessage("Full name and department are required.");
      setMessageType("error");
      return;
    }

    setSavingUser(true);
    setMessage("");

    try {
      await updateDoc(doc(db, "users", editingUserId), {
        fullName,
        department,
        role: editForm.role,
        status: editForm.status,
        updatedAt: serverTimestamp(),
      });

      setEditingUserId(null);
      setMessage("User account updated successfully.");
      setMessageType("success");
    } catch (error) {
      console.error("Update user error:", error);
      setMessage(
        error.code === "firestore/permission-denied"
          ? "Your Firestore rules do not allow this action."
          : error.message || "Unable to update the user account."
      );
      setMessageType("error");
    } finally {
      setSavingUser(false);
    }
  };

  const handlePasswordReset = async (user) => {
    setResettingUserId(user.id);
    setMessage("");

    try {
      await sendPasswordResetEmail(getAuth(), user.email);
      setMessage(`Password reset email sent to ${user.email}.`);
      setMessageType("success");
    } catch (error) {
      console.error("Password reset error:", error);
      setMessage(
        error.message || "Unable to send the password reset email."
      );
      setMessageType("error");
    } finally {
      setResettingUserId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-7">
        <p className="text-sm font-semibold uppercase tracking-[0.15em] text-blue-600">
          System settings
        </p>

        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          User Management
        </h1>

        <p className="mt-2 text-slate-500">
          Create login accounts for department users, MIS
          technicians, and administrators. Existing passwords are
          protected by Firebase and cannot be viewed.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-start gap-4">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
              <UserPlus size={24} />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Add New User
              </h2>

              <p className="mt-1 text-sm leading-6 text-slate-500">
                The administrator provides the login email and
                temporary password.
              </p>
            </div>
          </div>

          {message && (
            <div
              role="alert"
              className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
                messageType === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {message}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label
                htmlFor="fullName"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Full name
              </label>

              <input
                id="fullName"
                name="fullName"
                type="text"
                value={form.fullName}
                onChange={handleChange}
                required
                disabled={submitting}
                placeholder="Juan Dela Cruz"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Email address
              </label>

              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                required
                disabled={submitting}
                placeholder="employee@organization.com"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="department"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Department
              </label>

              <input
                id="department"
                name="department"
                type="text"
                value={form.department}
                onChange={handleChange}
                required
                disabled={submitting}
                placeholder="Accounting Department"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label
                htmlFor="role"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Account role
              </label>

              <select
                id="role"
                name="role"
                value={form.role}
                onChange={handleChange}
                disabled={submitting}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
              >
                <option value="user">Department User</option>
                <option value="IT_STAFF">IT STAFF</option>
                <option value="admin">Administrator</option>
                <option value="QA">QA STAFF</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Temporary password
              </label>

              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={handleChange}
                  required
                  minLength={8}
                  disabled={submitting}
                  placeholder="Minimum of 8 characters"
                  className="w-full rounded-xl border border-slate-300 py-3 pl-4 pr-12 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword((previous) => !previous)
                  }
                  disabled={submitting}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  aria-label={
                    showPassword
                      ? "Hide temporary password"
                      : "Show temporary password"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={19} />
                  ) : (
                    <Eye size={19} />
                  )}
                </button>
              </div>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                The password is stored securely by Firebase
                Authentication. It is not saved in Firestore.
              </p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3.5 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {submitting ? (
                <>
                  <LoaderCircle
                    size={19}
                    className="animate-spin"
                  />
                  Creating account...
                </>
              ) : (
                <>
                  <Plus size={19} />
                  Create User Account
                </>
              )}
            </button>
          </form>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
            <div>
              <h2 className="font-bold text-slate-900">
                System Users
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {users.length} registered account
                {users.length === 1 ? "" : "s"}
              </p>
            </div>

            <div className="rounded-xl bg-slate-100 p-3 text-slate-600">
              <Users size={22} />
            </div>
          </div>

          {loadingUsers ? (
            <div className="flex min-h-72 items-center justify-center">
              <LoaderCircle
                size={28}
                className="animate-spin text-blue-600"
              />
            </div>
          ) : users.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
              <div className="rounded-2xl bg-blue-50 p-4 text-blue-600">
                <Users size={35} />
              </div>

              <h3 className="mt-4 font-bold text-slate-900">
                No user records found
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                New accounts created by the administrator will
                appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-180 text-left">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-6 py-4 font-semibold">
                      User
                    </th>

                    <th className="px-6 py-4 font-semibold">
                      Department
                    </th>

                    <th className="px-6 py-4 font-semibold">
                      Role
                    </th>

                    <th className="px-6 py-4 font-semibold">
                      Status
                    </th>

                    <th className="px-6 py-4 font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {users.map((user) =>
                    editingUserId === user.id ? (
                      <tr key={user.id} className="bg-blue-50/50">
                        <td colSpan={5} className="px-6 py-5">
                          <form
                            className="grid gap-4 md:grid-cols-2"
                            onSubmit={handleSaveUser}
                          >
                            <div>
                              <label className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">
                                Full name
                              </label>
                              <input
                                name="fullName"
                                value={editForm.fullName}
                                onChange={handleEditChange}
                                disabled={savingUser}
                                required
                                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                              />
                            </div>

                            <div>
                              <label className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">
                                Department
                              </label>
                              <input
                                name="department"
                                value={editForm.department}
                                onChange={handleEditChange}
                                disabled={savingUser}
                                required
                                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                              />
                            </div>

                            <div>
                              <label className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">
                                Role
                              </label>
                              <select
                                name="role"
                                value={editForm.role}
                                onChange={handleEditChange}
                                disabled={savingUser}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                              >
                                <option value="user">Department User</option>
                                <option value="IT_STAFF">IT STAFF</option>
                                <option value="admin">Administrator</option>
                                <option value="QA">QA STAFF</option>
                              </select>
                            </div>

                            <div>
                              <label className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">
                                Status
                              </label>
                              <select
                                name="status"
                                value={editForm.status}
                                onChange={handleEditChange}
                                disabled={savingUser}
                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                              >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                              </select>
                            </div>

                            <div className="flex gap-2 md:col-span-2">
                              <button
                                type="submit"
                                disabled={savingUser}
                                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
                              >
                                {savingUser ? (
                                  <LoaderCircle size={17} className="animate-spin" />
                                ) : (
                                  <Save size={17} />
                                )}
                                Save changes
                              </button>
                              <button
                                type="button"
                                onClick={cancelEditing}
                                disabled={savingUser}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                              >
                                <X size={17} />
                                Cancel
                              </button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    ) : (
                      <tr key={user.id} className="hover:bg-slate-50/70">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-900">
                          {user.fullName || "Unnamed user"}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {user.email}
                        </p>
                      </td>

                      <td className="px-6 py-4 text-sm text-slate-600">
                        {user.department || "Not assigned"}
                      </td>

                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold capitalize text-blue-700">
                          {user.role === "admin" && (
                            <ShieldCheck size={14} />
                          )}

                          {user.role || "user"}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            user.status === "inactive"
                              ? "bg-slate-100 text-slate-600"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {user.status || "active"}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEditing(user)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            <Pencil size={14} />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePasswordReset(user)}
                            disabled={resettingUserId === user.id}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                          >
                            {resettingUserId === user.id ? (
                              <LoaderCircle size={14} className="animate-spin" />
                            ) : (
                              <KeyRound size={14} />
                            )}
                            Reset password
                          </button>
                        </div>
                      </td>
                    </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
