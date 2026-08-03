import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Eye,
  Loader2,
  MapPin,
  Plus,
  Search,
  X,
  XCircle,
} from "lucide-react";

import { db } from "../firebase/firebase";
import { useAuth } from "../context/AuthContext";
import EventBookingForm from "../components/EventBookingForm";

const PENDING_STATUSES = ["Pending", "Pending QA Approval"];

const statusStyles = {
  Pending: "border-amber-200 bg-amber-50 text-amber-700",
  "Pending QA Approval":
    "border-amber-200 bg-amber-50 text-amber-700",
  Confirmed: "border-blue-200 bg-blue-50 text-blue-700",
  Completed:
    "border-emerald-200 bg-emerald-50 text-emerald-700",
  Rejected: "border-red-200 bg-red-50 text-red-700",
  Cancelled: "border-slate-200 bg-slate-50 text-slate-700",
};

const formatDate = (timestamp) => {
  if (!timestamp) return "—";

  const date =
    typeof timestamp.toDate === "function"
      ? timestamp.toDate()
      : new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const formatEventDate = (dateValue) => {
  if (!dateValue) return "—";

  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "long",
    day: "2-digit",
    year: "numeric",
  }).format(date);
};

const formatTime = (timeValue) => {
  if (!timeValue) return "—";

  const [hours, minutes] = timeValue.split(":");
  const date = new Date();

  date.setHours(Number(hours), Number(minutes), 0, 0);

  return new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

export default function Events() {
  const { currentUser, userProfile } = useAuth();

  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingAction, setSavingAction] = useState("");
  const [message, setMessage] = useState({
    type: "",
    text: "",
  });

  const role = userProfile?.role;

  const isAdmin = role === "admin";
  const isITStaff = role === "IT_STAFF";
  const isQA = role === "QA";
  const isDepartmentUser = role === "user";

  const canBookEvent =
    isAdmin || isITStaff || isDepartmentUser;

  const canApproveEvent = isAdmin || isQA;
  const canCompleteEvent = isAdmin || isITStaff;
  const canViewAllEvents = isAdmin || isITStaff || isQA;

  useEffect(() => {
    const eventsQuery = query(
      collection(db, "events"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      eventsQuery,
      (snapshot) => {
        const eventList = snapshot.docs.map((eventDoc) => ({
          id: eventDoc.id,
          ...eventDoc.data(),
        }));

        setEvents(eventList);
        setLoading(false);

        setSelectedEvent((currentSelected) => {
          if (!currentSelected) return null;

          return (
            eventList.find(
              (eventItem) =>
                eventItem.id === currentSelected.id
            ) || null
          );
        });
      },
      (error) => {
        console.error("Unable to load events:", error);

        setMessage({
          type: "error",
          text:
            error.message ||
            "Unable to load event bookings.",
        });

        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const visibleEvents = useMemo(() => {
    if (!currentUser?.uid) return [];

    const searchValue = search.trim().toLowerCase();

    return events.filter((eventItem) => {
      const canView =
        canViewAllEvents ||
        eventItem.requesterUid === currentUser.uid;

      if (!canView) return false;
      if (!searchValue) return true;

      const venue =
        eventItem.venue === "Other"
          ? eventItem.otherVenue
          : eventItem.venue;

      return [
        eventItem.eventNumber,
        eventItem.eventTitle,
        eventItem.department,
        eventItem.requesterName,
        venue,
        eventItem.status,
      ].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(searchValue)
      );
    });
  }, [
    events,
    search,
    currentUser?.uid,
    canViewAllEvents,
  ]);

  const eventCounts = useMemo(() => {
    return {
      total: visibleEvents.length,
      pending: visibleEvents.filter((eventItem) =>
        PENDING_STATUSES.includes(eventItem.status)
      ).length,
      confirmed: visibleEvents.filter(
        (eventItem) => eventItem.status === "Confirmed"
      ).length,
      completed: visibleEvents.filter(
        (eventItem) => eventItem.status === "Completed"
      ).length,
    };
  }, [visibleEvents]);

  const updateEvent = async (
    eventItem,
    updateData,
    successText,
    actionName
  ) => {
    if (!eventItem?.id) return;

    setSavingAction(actionName);
    setMessage({ type: "", text: "" });

    try {
      await updateDoc(doc(db, "events", eventItem.id), {
        ...updateData,
        updatedAt: serverTimestamp(),
        updatedByUid: currentUser?.uid || "",
        updatedByName:
          userProfile?.fullName ||
          userProfile?.name ||
          currentUser?.email ||
          "System User",
      });

      setMessage({
        type: "success",
        text: successText,
      });
    } catch (error) {
      console.error("Unable to update event:", error);

      setMessage({
        type: "error",
        text:
          error.message ||
          "Unable to update the event booking.",
      });
    } finally {
      setSavingAction("");
    }
  };

  const handleApprove = async (eventItem) => {
    if (!canApproveEvent) return;

    await updateEvent(
      eventItem,
      {
        status: "Confirmed",
        approvedAt: serverTimestamp(),
        approvedByUid: currentUser?.uid || "",
        approvedByName:
          userProfile?.fullName ||
          userProfile?.name ||
          currentUser?.email ||
          "QA Staff",
        rejectionReason: "",
      },
      "Event booking approved successfully.",
      "approve"
    );
  };

  const handleReject = async (eventItem) => {
    if (!canApproveEvent) return;

    const reason = window.prompt(
      "Enter the reason for rejecting this booking:"
    );

    if (!reason?.trim()) return;

    await updateEvent(
      eventItem,
      {
        status: "Rejected",
        rejectionReason: reason.trim(),
        rejectedAt: serverTimestamp(),
        rejectedByUid: currentUser?.uid || "",
        rejectedByName:
          userProfile?.fullName ||
          userProfile?.name ||
          currentUser?.email ||
          "QA Staff",
      },
      "Event booking rejected.",
      "reject"
    );
  };

  const handleComplete = async (eventItem) => {
    if (!canCompleteEvent) return;

    const confirmed = window.confirm(
      "Mark this event as completed?"
    );

    if (!confirmed) return;

    await updateEvent(
      eventItem,
      {
        status: "Completed",
        completedAt: serverTimestamp(),
        completedByUid: currentUser?.uid || "",
        completedByName:
          userProfile?.fullName ||
          userProfile?.name ||
          currentUser?.email ||
          "MIS Staff",
      },
      "Event marked as completed.",
      "complete"
    );
  };

  const handleCancel = async (eventItem) => {
    const ownsEvent =
      eventItem.requesterUid === currentUser?.uid;

    const canCancel =
      isAdmin ||
      (ownsEvent &&
        PENDING_STATUSES.includes(eventItem.status));

    if (!canCancel) return;

    const confirmed = window.confirm(
      "Cancel this event booking?"
    );

    if (!confirmed) return;

    await updateEvent(
      eventItem,
      {
        status: "Cancelled",
        cancelledAt: serverTimestamp(),
        cancelledByUid: currentUser?.uid || "",
      },
      "Event booking cancelled.",
      "cancel"
    );
  };

  const actualVenue = (eventItem) => {
    if (!eventItem) return "—";

    return eventItem.venue === "Other"
      ? eventItem.otherVenue || "Other venue"
      : eventItem.venue || "—";
  };

  const isPending = (eventItem) =>
    PENDING_STATUSES.includes(eventItem?.status);

  const closeEventDetails = () => {
    if (savingAction) return;
    setSelectedEvent(null);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                  Event Booking
                </h1>
                <p className="mt-2 text-slate-500">
                  Submit event bookings and track their QA
                  approval status.
                </p>
              </div>

              {canBookEvent && (
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(true);
                    setMessage({ type: "", text: "" });
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 sm:w-auto"
                >
                  <Plus size={19} />
                  Book Event
                </button>
              )}
            </div>

            {message.text &&
              !showForm &&
              !selectedEvent && (
                <MessageBox message={message} />
              )}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                title="Total Events"
                value={eventCounts.total}
                icon={CalendarDays}
                iconClass="bg-blue-50 text-blue-600"
              />
              <SummaryCard
                title="Pending QA"
                value={eventCounts.pending}
                icon={Clock3}
                iconClass="bg-amber-50 text-amber-600"
              />
              <SummaryCard
                title="Confirmed"
                value={eventCounts.confirmed}
                icon={CheckCircle2}
                iconClass="bg-violet-50 text-violet-600"
              />
              <SummaryCard
                title="Completed"
                value={eventCounts.completed}
                icon={CheckCircle2}
                iconClass="bg-emerald-50 text-emerald-600"
              />
            </div>

            <div className="relative">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="search"
                placeholder="Search event, venue, department, requester, or status..."
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-4 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {loading ? (
                <div className="flex min-h-64 items-center justify-center">
                  <Loader2
                    size={28}
                    className="animate-spin text-blue-600"
                  />
                  <span className="ml-3 text-sm font-medium text-slate-500">
                    Loading event bookings...
                  </span>
                </div>
              ) : visibleEvents.length === 0 ? (
                <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
                  <div className="rounded-full bg-slate-100 p-4 text-slate-400">
                    <CalendarDays size={30} />
                  </div>
                  <h2 className="mt-4 font-semibold text-slate-800">
                    No event bookings found
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Create a booking or adjust your search.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1000px]">
                    <thead className="bg-slate-50">
                      <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-5 py-4">Event</th>
                        <th className="px-5 py-4">
                          Department
                        </th>
                        <th className="px-5 py-4">Venue</th>
                        <th className="px-5 py-4">
                          Date and Time
                        </th>
                        <th className="px-5 py-4">Status</th>
                        <th className="px-5 py-4 text-right">
                          Action
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-200">
                      {visibleEvents.map((eventItem) => (
                        <tr
                          key={eventItem.id}
                          className="transition hover:bg-slate-50"
                        >
                          <td className="px-5 py-4">
                            <p className="font-semibold text-blue-700">
                              {eventItem.eventNumber}
                            </p>
                            <p className="mt-1 font-medium text-slate-800">
                              {eventItem.eventTitle}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              By{" "}
                              {eventItem.requesterName ||
                                "Unknown requester"}
                            </p>
                          </td>

                          <td className="px-5 py-4 text-sm text-slate-700">
                            {eventItem.department || "—"}
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-start gap-2 text-sm text-slate-700">
                              <MapPin
                                size={16}
                                className="mt-0.5 shrink-0 text-slate-400"
                              />
                              <span>
                                {actualVenue(eventItem)}
                              </span>
                            </div>
                          </td>

                          <td className="px-5 py-4">
                            <p className="text-sm font-medium text-slate-700">
                              {formatEventDate(
                                eventItem.eventDate
                              )}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              {formatTime(
                                eventItem.startTime
                              )}{" "}
                              –{" "}
                              {formatTime(eventItem.endTime)}
                            </p>
                          </td>

                          <td className="px-5 py-4">
                            <Badge
                              text={
                                eventItem.status ||
                                "Pending QA Approval"
                              }
                              className={
                                statusStyles[
                                  eventItem.status
                                ] ||
                                statusStyles[
                                  "Pending QA Approval"
                                ]
                              }
                            />
                          </td>

                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedEvent(eventItem);
                                setMessage({
                                  type: "",
                                  text: "",
                                });
                              }}
                              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                            >
                              <Eye size={16} />
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

      {showForm && canBookEvent && (
        <EventBookingForm
          currentUser={currentUser}
          userProfile={userProfile}
          onClose={() => setShowForm(false)}
          onSuccess={(successMessage) => {
            setMessage({
              type: "success",
              text:
                successMessage ||
                "Event booking submitted for QA approval.",
            });
          }}
        />
      )}

      {selectedEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeEventDetails();
            }
          }}
        >
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white p-5">
              <div>
                <p className="text-sm font-semibold text-blue-600">
                  {selectedEvent.eventNumber}
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  {selectedEvent.eventTitle}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeEventDetails}
                disabled={Boolean(savingAction)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                <X size={22} />
              </button>
            </div>

            <div className="space-y-6 p-5 sm:p-6">
              {message.text && (
                <MessageBox message={message} />
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <DetailItem
                  label="Requested By"
                  value={selectedEvent.requesterName}
                />
                <DetailItem
                  label="Department"
                  value={selectedEvent.department}
                />
                <DetailItem
                  label="Venue"
                  value={actualVenue(selectedEvent)}
                />
                <DetailItem
                  label="Event Date"
                  value={formatEventDate(
                    selectedEvent.eventDate
                  )}
                />
                <DetailItem
                  label="Start Time"
                  value={formatTime(
                    selectedEvent.startTime
                  )}
                />
                <DetailItem
                  label="End Time"
                  value={formatTime(selectedEvent.endTime)}
                />
                <DetailItem
                  label="Expected Participants"
                  value={
                    selectedEvent.expectedParticipants
                      ? String(
                          selectedEvent.expectedParticipants
                        )
                      : "Not specified"
                  }
                />
              
                <DetailItem
                  label="Submitted At"
                  value={formatDate(
                    selectedEvent.createdAt
                  )}
                />
                <DetailItem
                  label="Current Status"
                  value={
                    selectedEvent.status ||
                    "Pending QA Approval"
                  }
                />
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Event Purpose or Description
                </p>
                <div className="mt-2 whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                  {selectedEvent.purpose ||
                    "No purpose provided."}
                </div>
              </div>

              {selectedEvent.rejectionReason && (
                <div>
                  <p className="text-sm font-semibold text-red-700">
                    Rejection Reason
                  </p>
                  <div className="mt-2 whitespace-pre-wrap rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
                    {selectedEvent.rejectionReason}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:flex-wrap">
                {canApproveEvent &&
                  isPending(selectedEvent) && (
                    <>
                      <ActionButton
                        onClick={() =>
                          handleApprove(selectedEvent)
                        }
                        loading={savingAction === "approve"}
                        disabled={Boolean(savingAction)}
                        className="bg-emerald-600 hover:bg-emerald-700"
                        icon={CheckCircle2}
                      >
                        Approve
                      </ActionButton>

                      <ActionButton
                        onClick={() =>
                          handleReject(selectedEvent)
                        }
                        loading={savingAction === "reject"}
                        disabled={Boolean(savingAction)}
                        className="bg-red-600 hover:bg-red-700"
                        icon={XCircle}
                      >
                        Reject
                      </ActionButton>
                    </>
                  )}

                {canCompleteEvent &&
                  selectedEvent.status === "Confirmed" && (
                    <ActionButton
                      onClick={() =>
                        handleComplete(selectedEvent)
                      }
                      loading={savingAction === "complete"}
                      disabled={Boolean(savingAction)}
                      className="bg-blue-600 hover:bg-blue-700"
                      icon={CheckCircle2}
                    >
                      Mark Completed
                    </ActionButton>
                  )}

                {(isAdmin ||
                  (selectedEvent.requesterUid ===
                    currentUser?.uid &&
                    isPending(selectedEvent))) && (
                  <ActionButton
                    onClick={() =>
                      handleCancel(selectedEvent)
                    }
                    loading={savingAction === "cancel"}
                    disabled={Boolean(savingAction)}
                    className="bg-slate-600 hover:bg-slate-700"
                    icon={XCircle}
                  >
                    Cancel Booking
                  </ActionButton>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBox({ message }) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm font-medium ${
        message.type === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {message.text}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  loading,
  disabled,
  className,
  icon: Icon,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {loading ? (
        <Loader2 size={18} className="animate-spin" />
      ) : (
        <Icon size={18} />
      )}
      {children}
    </button>
  );
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  iconClass,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {value}
          </p>
        </div>

        <div className={`rounded-xl p-3 ${iconClass}`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}

function Badge({ text, className }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      {text || "Unknown"}
    </span>
  );
}

function DetailItem({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-medium text-slate-800">
        {value || "Not available"}
      </p>
    </div>
  );
}
