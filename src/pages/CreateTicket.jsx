import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Send,
  TicketPlus,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";

import { db } from "../firebase/firebase";
import { useAuth } from "../context/AuthContext";

const categoryPriority = {
  Hardware: "High",
  Software: "medium",
  HIMS: "Medium",
  Billing_Concerns: "High",
  Network: "Critical",
  Printer: "Low",
  Item_Adjustment:"Low",
  PHILHEALTH: "Medium",
  Other: "Low",
};

const defaultCategories = Object.keys(categoryPriority);

const initialForm = {
  staffName: "",
  category: "",
  priority: "",
  subject: "",
  description: "",
};

export default function CreateTicket() {
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();

  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [configuredCategories, setConfiguredCategories] = useState([]);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categorySaving, setCategorySaving] = useState(false);
  const [message, setMessage] = useState({
    type: "",
    text: "",
  });

  const department =
    userProfile?.department?.trim() || "";

  const categories = [
    ...new Set([...defaultCategories, ...configuredCategories]),
  ].sort((first, second) => first.localeCompare(second));

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(
        collection(db, "concernCategories"),
        orderBy("name", "asc")
      ),
      (snapshot) => {
        setConfiguredCategories(
          snapshot.docs
            .map((document) => document.data())
            .filter((category) => category.isActive !== false)
            .map((category) => String(category.name || "").trim())
            .filter(Boolean)
        );
      },
      (error) => {
        console.error("Unable to load concern categories:", error);
      }
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!message.text) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setMessage({
        type: "",
        text: "",
      });
    }, 5000);

    return () => clearTimeout(timer);
  }, [message]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setMessage({
      type: "",
      text: "",
    });

    if (name === "category") {
      setForm((previous) => ({
        ...previous,
        category: value,
        priority: categoryPriority[value] || "Low",
      }));

      return;
    }

    

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const generateTicketNumber = () => {
    const date = new Date();

    const year = date.getFullYear();
    const month = String(
      date.getMonth() + 1
    ).padStart(2, "0");
    const day = String(
      date.getDate()
    ).padStart(2, "0");

    const randomNumber = Math.floor(
      Math.random() * 9000 + 1000
    );

    return `MIS-${year}${month}${day}-${randomNumber}`;
  };

  const addCategory = async (event) => {
    event.preventDefault();

    if (userProfile?.role !== "admin") {
      setMessage({
        type: "error",
        text: "Only the administrator can add categories.",
      });
      return;
    }

    const categoryName = newCategoryName.trim();

    if (!categoryName) return;

    if (
      categories.some(
        (category) =>
          category.toLowerCase() === categoryName.toLowerCase()
      )
    ) {
      setMessage({
        type: "error",
        text: "This category already exists.",
      });
      return;
    }

    try {
      setCategorySaving(true);

      await addDoc(collection(db, "concernCategories"), {
        name: categoryName,
        description: "",
        isActive: true,
        createdBy: currentUser?.uid || "",
        createdByEmail: currentUser?.email || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setForm((previous) => ({
        ...previous,
        category: categoryName,
        priority: "Low",
      }));
      setNewCategoryName("");
      setShowAddCategory(false);
      setMessage({
        type: "success",
        text: `Category "${categoryName}" added and selected.`,
      });
    } catch (error) {
      console.error("Unable to add category:", error);
      setMessage({
        type: "error",
        text: error.message || "Unable to add the category.",
      });
    } finally {
      setCategorySaving(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const staffName = form.staffName.trim();
    const subject = form.subject.trim();
    const description = form.description.trim();

    if (!currentUser) {
      setMessage({
        type: "error",
        text: "You must be logged in before creating a ticket.",
      });

      return;
    }

    if (!department) {
      setMessage({
        type: "error",
        text: "Your account does not have a department. Please contact the MIS administrator.",
      });

      return;
    }

    if (!staffName) {
      setMessage({
        type: "error",
        text: "Please enter the name of the staff who created the ticket.",
      });

      return;
    }

    if (!form.category) {
      setMessage({
        type: "error",
        text: "Please select a ticket category.",
      });

      return;
    }

    if (!form.priority) {
      setMessage({
        type: "error",
        text: "The system could not determine the ticket priority.",
      });

      return;
    }

    if (!subject) {
      setMessage({
        type: "error",
        text: "Please enter the ticket subject.",
      });

      return;
    }

    if (!description) {
      setMessage({
        type: "error",
        text: "Please describe the concern.",
      });

      return;
    }

    setLoading(true);
    setMessage({
      type: "",
      text: "",
    });

    try {
      const ticketNumber =
        generateTicketNumber();

      await addDoc(
        collection(db, "tickets"),
        {
          ticketNumber,

          requesterUid: currentUser.uid,
          requesterEmail:
            currentUser.email || "",

          department,
          staffName,

          category: form.category,
          priority: form.priority,

          subject,
          description,

          status: "Pending",

          assignedTo: "",
          assignedToName: "",

          remarks: "",

          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      );

      setMessage({
        type: "success",
        text: `Ticket ${ticketNumber} was submitted successfully.`,
      });

      setForm(initialForm);
    } catch (error) {
      console.error(
        "Create ticket error:",
        error
      );

      if (
        error.code ===
        "permission-denied"
      ) {
        setMessage({
          type: "error",
          text: "You do not have permission to create a ticket. Please check your Firestore rules.",
        });
      } else if (
        error.code ===
        "unavailable"
      ) {
        setMessage({
          type: "error",
          text: "The service is currently unavailable. Please check your internet connection and try again.",
        });
      } else {
        setMessage({
          type: "error",
          text:
            error.message ||
            "Unable to submit the ticket.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const priorityStyles = {
    Low: "border-emerald-200 bg-emerald-50 text-emerald-700",
    Medium:
      "border-amber-200 bg-amber-50 text-amber-700",
    High: "border-orange-200 bg-orange-50 text-orange-700",
    Critical:
      "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <div className="mx-auto max-w-5xl">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-5 flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
      >
        <ArrowLeft size={18} />
        Back
      </button>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-8 flex items-start gap-4">
          <div className="rounded-xl bg-blue-100 p-3 text-blue-700">
            <TicketPlus size={28} />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
              Create Ticket
            </h1>

            <p className="mt-1 text-slate-500">
              Submit a department concern to
              the MIS Department.
            </p>
          </div>
        </div>

        {message.text && (
          <div
            role="alert"
            className={`mb-6 rounded-xl border px-4 py-3 text-sm font-medium ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {message.text}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-6 md:grid-cols-2"
        >
          <div>
            <label
              htmlFor="department"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Department
            </label>

            <input
              id="department"
              type="text"
              value={department}
              readOnly
              placeholder="No department assigned"
              className="w-full cursor-not-allowed rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-slate-700 outline-none"
            />

            <p className="mt-2 text-xs text-slate-500">
              This is based on the
              department of the logged-in
              account.
            </p>
          </div>

          <div>
            <label
              htmlFor="staffName"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Name of Staff
            </label>

            <input
              id="staffName"
              name="staffName"
              type="text"
              value={form.staffName}
              onChange={handleChange}
              disabled={loading}
              required
              maxLength={100}
              placeholder="Enter the name of the staff"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            />

            <p className="mt-2 text-xs text-slate-500">
              Manually enter the name of
              the staff who created or
              requested the ticket.
            </p>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label
                htmlFor="category"
                className="block text-sm font-semibold text-slate-700"
              >
                Category
              </label>

              {userProfile?.role === "admin" && (
                <button
                  type="button"
                  onClick={() => setShowAddCategory(true)}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  <Plus size={16} />
                  Add category
                </button>
              )}
            </div>

            <select
              id="category"
              name="category"
              value={form.category}
              onChange={handleChange}
              disabled={loading}
              required
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              <option value="">
                Select category
              </option>

              {categories.map(
                (category) => (
                  <option
                    key={category}
                    value={category}
                  >
                    {category}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label
              htmlFor="priority"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Priority Classification
            </label>

            <input
              id="priority"
              type="text"
              value={
                form.priority ||
                "Select a category first"
              }
              readOnly
              className={`w-full cursor-not-allowed rounded-xl border px-4 py-3 font-semibold outline-none ${
                form.priority
                  ? priorityStyles[
                      form.priority
                    ]
                  : "border-slate-300 bg-slate-100 text-slate-500"
              }`}
            />

            <p className="mt-2 text-xs text-slate-500">
              Priority is automatically
              classified based on the
              selected category.
            </p>
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="subject"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Subject
            </label>

            <input
              id="subject"
              name="subject"
              type="text"
              value={form.subject}
              onChange={handleChange}
              disabled={loading}
              required
              maxLength={150}
              placeholder="Enter a brief summary of the concern"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            />

            <div className="mt-2 text-right text-xs text-slate-400">
              {form.subject.length}/150
            </div>
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="description"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Description
            </label>

            <textarea
              id="description"
              name="description"
              rows={7}
              value={form.description}
              onChange={handleChange}
              disabled={loading}
              required
              maxLength={2000}
              placeholder="Describe the issue, affected equipment or system, error messages, and other relevant details."
              className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            />

            <div className="mt-2 text-right text-xs text-slate-400">
              {form.description.length}/2000
            </div>
          </div>

          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={
                loading ||
                !department
              }
              className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              <Send size={18} />

              {loading
                ? "Submitting..."
                : "Submit Ticket"}
            </button>
          </div>
        </form>
      </div>

      {showAddCategory && userProfile?.role === "admin" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !categorySaving
            ) {
              setShowAddCategory(false);
              setNewCategoryName("");
            }
          }}
        >
          <form
            onSubmit={addCategory}
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-slate-200 p-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Add Category
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  The new category will be selected automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddCategory(false);
                  setNewCategoryName("");
                }}
                disabled={categorySaving}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close add category"
              >
                <X size={22} />
              </button>
            </div>

            <div className="p-5">
              <label
                htmlFor="newCategoryName"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Category Name
              </label>
              <input
                id="newCategoryName"
                value={newCategoryName}
                onChange={(event) =>
                  setNewCategoryName(event.target.value)
                }
                disabled={categorySaving}
                maxLength={80}
                autoFocus
                required
                placeholder="Example: Hardware"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
              <p className="mt-2 text-right text-xs text-slate-400">
                {newCategoryName.length}/80
              </p>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 p-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowAddCategory(false);
                  setNewCategoryName("");
                }}
                disabled={categorySaving}
                className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={categorySaving || !newCategoryName.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
              >
                {categorySaving ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Plus size={18} />
                )}
                {categorySaving ? "Saving..." : "Add Category"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
