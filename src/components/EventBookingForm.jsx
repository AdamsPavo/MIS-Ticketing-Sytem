import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import {
  CalendarDays,
  Loader2,
  X,
} from "lucide-react";

import { db } from "../firebase/firebase";

const venueOptions = [
  "Boardroom",
  "Canteen Function Hall",
  "Hospital Function Hall",
  "Other",
];

const initialForm = {
  eventTitle: "",
  department: "",
  venue: "",
  otherVenue: "",
  eventDate: "",
  startTime: "",
  endTime: "",
  purpose: "",
  expectedParticipants: "",
  
};

export default function EventBookingForm({
  currentUser,
  userProfile,
  onClose,
  onSuccess,
}) {
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState({
    type: "",
    text: "",
  });

  useEffect(() => {
    setForm((currentForm) => ({
      ...currentForm,
      department:
        currentForm.department ||
        userProfile?.department ||
        "",
    }));
  }, [userProfile?.department]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,

      ...(name === "venue" && value !== "Other"
        ? { otherVenue: "" }
        : {}),
    }));
  };

  const validateForm = () => {
    if (!form.eventTitle.trim()) {
      return "Please enter the event title.";
    }

    if (!form.department.trim()) {
      return "Please enter the department.";
    }

    if (!form.venue) {
      return "Please select a venue.";
    }

    if (
      form.venue === "Other" &&
      !form.otherVenue.trim()
    ) {
      return "Please describe the event venue.";
    }

    if (!form.eventDate) {
      return "Please select the event date.";
    }

    if (!form.startTime) {
      return "Please select the event start time.";
    }

    if (!form.endTime) {
      return "Please select the event end time.";
    }

    if (form.endTime <= form.startTime) {
      return "The end time must be later than the start time.";
    }

    if (!form.purpose.trim()) {
      return "Please enter the purpose of the event.";
    }

    if (
      form.expectedParticipants &&
      Number(form.expectedParticipants) < 1
    ) {
      return "Expected participants must be at least 1.";
    }

    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!currentUser) {
      setMessage({
        type: "error",
        text: "You must be logged in to book an event.",
      });

      return;
    }

    const allowedBookingRoles = [
      "admin",
      "IT_STAFF",
      "user",
    ];

    if (
      !allowedBookingRoles.includes(userProfile?.role)
    ) {
      setMessage({
        type: "error",
        text: "Your account is not allowed to create event bookings.",
      });

      return;
    }

    const validationError = validateForm();

    if (validationError) {
      setMessage({
        type: "error",
        text: validationError,
      });

      return;
    }

    const requesterName =
      userProfile?.fullName ||
      userProfile?.name ||
      currentUser.displayName ||
      currentUser.email ||
      "System User";

    const eventNumber = `EVT-${Date.now()
      .toString()
      .slice(-8)}`;

    setSaving(true);

    setMessage({
      type: "",
      text: "",
    });

    try {
      await addDoc(collection(db, "events"), {
        eventNumber,

        eventTitle: form.eventTitle.trim(),

        department: form.department.trim(),

        venue: form.venue,

        otherVenue:
          form.venue === "Other"
            ? form.otherVenue.trim()
            : "",

        eventDate: form.eventDate,
        startTime: form.startTime,
        endTime: form.endTime,

        purpose: form.purpose.trim(),

        expectedParticipants:
          Number(form.expectedParticipants) || 0,


        status: "Pending QA Approval",

        requesterUid: currentUser.uid,

        requesterName,

        requesterEmail:
          currentUser.email || "",

        requesterRole:
          userProfile?.role || "user",

        approvedByUid: "",
        approvedByName: "",
        approvedAt: null,

        rejectedByUid: "",
        rejectedByName: "",
        rejectedAt: null,
        rejectionReason: "",

        completedByUid: "",
        completedByName: "",
        completedAt: null,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setForm({
        ...initialForm,

        department:
          userProfile?.department || "",

        
      });

      setMessage({
        type: "success",
        text: "Event booking submitted for QA approval.",
      });

      if (onSuccess) {
        onSuccess(
          "Event booking submitted successfully and is now pending QA approval."
        );
      }

      onClose();
    } catch (error) {
      console.error(
        "Unable to submit event booking:",
        error
      );

      let readableMessage =
        error.message ||
        "Unable to submit the event booking.";

      if (
        error.code === "permission-denied" ||
        error.code ===
          "firestore/permission-denied"
      ) {
        readableMessage =
          "Your Firestore rules do not allow event booking creation.";
      }

      setMessage({
        type: "error",
        text: readableMessage,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (saving) return;

    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) {
          handleClose();
        }
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white p-5">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Book an Event
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Submit the event schedule for QA approval.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Close booking form"
          >
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
            {message.text && (
              <div
                role="alert"
                className={`rounded-xl border px-4 py-3 text-sm font-medium ${
                  message.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {message.text}
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                label="Event Title"
                name="eventTitle"
                value={form.eventTitle}
                onChange={handleInputChange}
                placeholder="Example: Department Seminar"
                required
                disabled={saving}
              />

              <FormField
                label="Department"
                name="department"
                value={form.department}
                onChange={handleInputChange}
                placeholder="Example: Nursing Department"
                required
                disabled={saving}
              />
            </div>

            <div>
              <label
                htmlFor="venue"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Venue <span className="text-red-500">*</span>
              </label>

              <select
                id="venue"
                name="venue"
                value={form.venue}
                onChange={handleInputChange}
                required
                disabled={saving}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
              >
                <option value="">Select a venue</option>
                {venueOptions.map((venue) => (
                  <option key={venue} value={venue}>
                    {venue}
                  </option>
                ))}
              </select>
            </div>

            {form.venue === "Other" && (
              <FormField
                label="Describe the Venue"
                name="otherVenue"
                value={form.otherVenue}
                onChange={handleInputChange}
                placeholder="Enter the complete venue name or location"
                required
                disabled={saving}
              />
            )}

            <div className="grid gap-5 sm:grid-cols-3">
              <FormField
                label="Event Date"
                name="eventDate"
                type="date"
                value={form.eventDate}
                onChange={handleInputChange}
                required
                disabled={saving}
              />

              <FormField
                label="Start Time"
                name="startTime"
                type="time"
                value={form.startTime}
                onChange={handleInputChange}
                required
                disabled={saving}
              />

              <FormField
                label="End Time"
                name="endTime"
                type="time"
                value={form.endTime}
                onChange={handleInputChange}
                required
                disabled={saving}
              />
            </div>

            <FormField
              label="Expected Participants"
              name="expectedParticipants"
              type="number"
              min="1"
              value={form.expectedParticipants}
              onChange={handleInputChange}
              placeholder="Example: 50"
              disabled={saving}
            />

            <div>
              <label
                htmlFor="purpose"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                Event Purpose or Description <span className="text-red-500">*</span>
              </label>

              <textarea
                id="purpose"
                name="purpose"
                rows={5}
                value={form.purpose}
                onChange={handleInputChange}
                placeholder="Describe the event and any assistance needed from the MIS team..."
                required
                disabled={saving}
                maxLength={2000}
                className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
              />

              <p className="mt-2 text-right text-xs text-slate-400">
                {form.purpose.length}/2000
              </p>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-white p-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {saving ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CalendarDays size={18} />
                  Submit for QA Approval
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FormField({
  label,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  required = false,
  min,
  disabled = false,
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-2 block text-sm font-semibold text-slate-700"
      >
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </label>

      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        min={min}
        disabled={disabled}
        className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
      />
    </div>
  );
}