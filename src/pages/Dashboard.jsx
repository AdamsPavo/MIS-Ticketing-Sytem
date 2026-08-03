import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  MapPin,
  Tickets,
  TriangleAlert,
} from "lucide-react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";

import { db } from "../firebase/firebase";
import { useAuth } from "../context/AuthContext";

const normalizeStatus = (status) =>
  String(status || "")
    .trim()
    .toLowerCase();

const formatDate = (value) => {
  if (!value) return "No date";

  try {
    const date =
      typeof value?.toDate === "function"
        ? value.toDate()
        : new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "No date";
    }

    return new Intl.DateTimeFormat("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  } catch {
    return "No date";
  }
};

const getStatusStyle = (status) => {
  const normalizedStatus = normalizeStatus(status);

  switch (normalizedStatus) {
    case "pending":
    case "new":
      return "bg-orange-50 text-orange-700 ring-orange-600/20";

    case "assigned":
      return "bg-cyan-50 text-cyan-700 ring-cyan-600/20";

    case "in progress":
      return "bg-violet-50 text-violet-700 ring-violet-600/20";

    case "resolved":
      return "bg-emerald-50 text-emerald-700 ring-emerald-600/20";

    case "closed":
      return "bg-slate-100 text-slate-700 ring-slate-600/20";

    default:
      return "bg-blue-50 text-blue-700 ring-blue-600/20";
  }
};


const formatEventDate = (dateValue) => {
  if (!dateValue) return "No date";

  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

const formatEventTime = (timeValue) => {
  if (!timeValue) return "No time";

  const [hours, minutes] = String(timeValue).split(":");
  const date = new Date();

  date.setHours(Number(hours), Number(minutes), 0, 0);

  return new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const getEventVenue = (eventItem) =>
  eventItem?.venue === "Other"
    ? eventItem?.otherVenue || "Other venue"
    : eventItem?.venue || "No venue";

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [tickets, setTickets] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [eventLoadError, setEventLoadError] = useState("");

  useEffect(() => {
    const ticketsQuery = query(
      collection(db, "tickets"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      ticketsQuery,
      (snapshot) => {
        const ticketData = snapshot.docs.map((ticketDocument) => ({
          id: ticketDocument.id,
          ...ticketDocument.data(),
        }));

        setTickets(ticketData);
        setLoading(false);
        setLoadError("");
      },
      (error) => {
        console.error("Unable to load dashboard tickets:", error);

        setLoading(false);
        setLoadError(
          error.message || "Unable to load dashboard ticket information."
        );
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const eventsQuery = query(
      collection(db, "events"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      eventsQuery,
      (snapshot) => {
        const eventData = snapshot.docs.map((eventDocument) => ({
          id: eventDocument.id,
          ...eventDocument.data(),
        }));

        setEvents(eventData);
        setEventsLoading(false);
        setEventLoadError("");
      },
      (error) => {
        console.error("Unable to load dashboard events:", error);

        setEventsLoading(false);
        setEventLoadError(
          error.message || "Unable to load upcoming event information."
        );
      }
    );

    return () => unsubscribe();
  }, []);

  const stats = useMemo(() => {
    const countStatus = (...statuses) => {
      const normalizedStatuses = statuses.map(normalizeStatus);

      return tickets.filter((ticket) =>
        normalizedStatuses.includes(normalizeStatus(ticket.status))
      ).length;
    };

    return {
      total: tickets.length,
      pending: countStatus("Pending", "New"),
      assigned: countStatus("Assigned"),
      inProgress: countStatus("In Progress"),
      resolved: countStatus("Resolved"),
      closed: countStatus("Closed"),
    };
  }, [tickets]);

  const ticketStats = useMemo(
    () => [
      {
        title: "Total Tickets",
        value: stats.total,
        description: "All submitted concerns",
        icon: Tickets,
        iconClass: "bg-blue-50 text-blue-600",
      },
      {
        title: "New Tickets",
        value: stats.pending,
        description: "Waiting for MIS review",
        icon: TriangleAlert,
        iconClass: "bg-orange-50 text-orange-600",
      },
      {
        title: "In Progress",
        value: stats.inProgress,
        description: "Currently being handled",
        icon: Clock3,
        iconClass: "bg-violet-50 text-violet-600",
      },
      {
        title: "Resolved",
        value: stats.resolved,
        description: "Successfully completed",
        icon: CheckCircle2,
        iconClass: "bg-emerald-50 text-emerald-600",
      },
    ],
    [stats]
  );

  const newTickets = useMemo(() => {
    return tickets
      .filter((ticket) => {
        const status = normalizeStatus(ticket.status);

        return status === "pending" || status === "new";
      })
      .slice(0, 5);
  }, [tickets]);

  const upcomingEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return events
      .filter((eventItem) => {
        const eventDate = eventItem.eventDate
          ? new Date(`${eventItem.eventDate}T00:00:00`)
          : null;

        const normalizedEventStatus = normalizeStatus(eventItem.status);

        return (
          eventDate &&
          !Number.isNaN(eventDate.getTime()) &&
          eventDate >= today &&
          normalizedEventStatus !== "rejected" &&
          normalizedEventStatus !== "cancelled" &&
          normalizedEventStatus !== "completed"
        );
      })
      .sort((firstEvent, secondEvent) => {
        const firstDateTime = new Date(
          `${firstEvent.eventDate}T${firstEvent.startTime || "00:00"}:00`
        ).getTime();

        const secondDateTime = new Date(
          `${secondEvent.eventDate}T${secondEvent.startTime || "00:00"}:00`
        ).getTime();

        return firstDateTime - secondDateTime;
      })
      .slice(0, 5);
  }, [events]);

  const openTicket = (ticket) => {
    /*
      Change this route if your ticket-details route is different.

      Examples:
      navigate(`/tickets/${ticket.id}`);
      navigate(`/ticket/${ticket.id}`);
    */

    navigate("/tickets", {
      state: {
        selectedTicketId: ticket.id,
      },
    });
  };

  return (
    <div className="mx-auto max-w-7xl">
      {/* Page heading */}
      <section className="mb-7">
        <p className="text-sm font-semibold uppercase tracking-[0.15em] text-blue-600">
          MIS support dashboard
        </p>

        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Welcome back
        </h2>

        <p className="mt-2 text-slate-500">
          Signed in as{" "}
          <span className="font-medium text-slate-700">
            {currentUser?.email || "MIS user"}
          </span>
        </p>
      </section>

      {/* Error message */}
      {loadError && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {loadError}
        </div>
      )}

      {eventLoadError && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {eventLoadError}
        </div>
      )}

      {/* Ticket statistics */}
      <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {ticketStats.map((stat) => {
          const Icon = stat.icon;

          return (
            <article
              key={stat.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className={`rounded-xl p-3 ${stat.iconClass}`}>
                  <Icon size={22} />
                </div>

                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                  Live
                </span>
              </div>

              <div className="mt-5">
                {loading ? (
                  <Loader2
                    size={28}
                    className="animate-spin text-slate-400"
                  />
                ) : (
                  <p className="text-3xl font-bold text-slate-900">
                    {stat.value}
                  </p>
                )}
              </div>

              <h3 className="mt-1 font-semibold text-slate-800">
                {stat.title}
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                {stat.description}
              </p>
            </article>
          );
        })}
      </section>

      <section className="mt-7 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        {/* New tickets */}
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
            <div>
              <h3 className="font-bold text-slate-900">
                New tickets
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Pending tickets waiting for MIS action
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/tickets")}
              className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-blue-600 transition hover:text-blue-700"
            >
              View all
              <ArrowRight size={16} />
            </button>
          </div>

          {loading ? (
            <div className="flex min-h-72 items-center justify-center">
              <div className="flex flex-col items-center text-slate-500">
                <Loader2
                  size={34}
                  className="animate-spin text-blue-600"
                />

                <p className="mt-3 text-sm">
                  Loading recent tickets...
                </p>
              </div>
            </div>
          ) : newTickets.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
              <div className="rounded-2xl bg-blue-50 p-4 text-blue-600">
                <Tickets size={38} />
              </div>

              <h4 className="mt-5 text-lg font-bold text-slate-900">
                No pending tickets
              </h4>

              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                All pending ticket requests waiting for MIS action will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {newTickets.map((ticket) => {
                const title =
                  ticket.subject ||
                  ticket.title ||
                  ticket.concern ||
                  "Untitled ticket";

                const ticketNumber =
                  ticket.ticketNumber ||
                  ticket.ticket_number ||
                  ticket.referenceNumber ||
                  ticket.id;

                return (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => openTicket(ticket)}
                    className="flex w-full flex-col gap-4 px-6 py-4 text-left transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-semibold text-slate-900">
                          {title}
                        </p>

                        <span className="text-xs font-medium text-slate-400">
                          #{ticketNumber}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
                        <span>
                          {ticket.department || "No department"}
                        </span>

                        <span
                          className="hidden text-slate-300 sm:inline"
                          aria-hidden="true"
                        >
                          •
                        </span>

                        <span>
                          {ticket.requesterName ||
                            ticket.createdByName ||
                            ticket.userName ||
                            ticket.requesterEmail ||
                            "Unknown requester"}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-slate-400">
                        {formatDate(
                          ticket.createdAt ||
                            ticket.submittedAt ||
                            ticket.dateCreated
                        )}
                      </p>
                    </div>

                    <span
                      className={`inline-flex w-fit shrink-0 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${getStatusStyle(
                        ticket.status
                      )}`}
                    >
                      {ticket.status || "Pending"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </article>

        {/* Ticket status overview */}
        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h3 className="font-bold text-slate-900">
              Ticket overview
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Current ticket status distribution
            </p>
          </div>

          {loading ? (
            <div className="flex min-h-72 items-center justify-center">
              <Loader2
                size={34}
                className="animate-spin text-blue-600"
              />
            </div>
          ) : (
            <div className="mt-7 space-y-5">
              <StatusProgress
                label="Pending"
                value={stats.pending}
                total={stats.total}
                barClass="bg-orange-500"
              />

              <StatusProgress
                label="Assigned"
                value={stats.assigned}
                total={stats.total}
                barClass="bg-cyan-500"
              />

              <StatusProgress
                label="In Progress"
                value={stats.inProgress}
                total={stats.total}
                barClass="bg-violet-600"
              />

              <StatusProgress
                label="Resolved"
                value={stats.resolved}
                total={stats.total}
                barClass="bg-emerald-500"
              />

            
            </div>
          )}
        </article>
      </section>

      {/* Upcoming events */}
      <section className="mt-7">
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-6 py-5">
            <div>
              <h3 className="font-bold text-slate-900">
                Upcoming events
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Confirmed and pending event bookings scheduled from today onward
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/events")}
              className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-blue-600 transition hover:text-blue-700"
            >
              View all
              <ArrowRight size={16} />
            </button>
          </div>

          {eventsLoading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex flex-col items-center text-slate-500">
                <Loader2
                  size={34}
                  className="animate-spin text-blue-600"
                />

                <p className="mt-3 text-sm">
                  Loading upcoming events...
                </p>
              </div>
            </div>
          ) : upcomingEvents.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
              <div className="rounded-2xl bg-blue-50 p-4 text-blue-600">
                <CalendarDays size={38} />
              </div>

              <h4 className="mt-5 text-lg font-bold text-slate-900">
                No upcoming events
              </h4>

              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                Future event bookings will appear here after they are submitted.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
              {upcomingEvents.map((eventItem) => (
                <button
                  key={eventItem.id}
                  type="button"
                  onClick={() =>
                    navigate("/events", {
                      state: {
                        selectedEventId: eventItem.id,
                      },
                    })
                  }
                  className="rounded-2xl border border-slate-200 p-5 text-left transition hover:border-blue-300 hover:bg-blue-50/40 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                        {eventItem.eventNumber || "Event booking"}
                      </p>

                      <h4 className="mt-1 truncate font-bold text-slate-900">
                        {eventItem.eventTitle || "Untitled event"}
                      </h4>
                    </div>

                    <span className="inline-flex shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-600/20">
                      {eventItem.status || "Pending QA Approval"}
                    </span>
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <CalendarDays
                        size={16}
                        className="shrink-0 text-slate-400"
                      />

                      <span>
                        {formatEventDate(eventItem.eventDate)}
                        {" · "}
                        {formatEventTime(eventItem.startTime)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <MapPin
                        size={16}
                        className="shrink-0 text-slate-400"
                      />

                      <span className="truncate">
                        {getEventVenue(eventItem)}
                      </span>
                    </div>
                  </div>

                  <p className="mt-4 text-sm font-medium text-slate-700">
                    {eventItem.department || "No department"}
                  </p>
                </button>
              ))}
            </div>
          )}
        </article>
      </section>
    </div>
  );
}

function StatusProgress({
  label,
  value,
  total,
  barClass = "bg-blue-600",
}) {
  const percentage =
    total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4">
        <span className="text-sm font-medium text-slate-700">
          {label}
        </span>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">
            {percentage}%
          </span>

          <span className="min-w-5 text-right text-sm font-semibold text-slate-900">
            {value}
          </span>
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barClass}`}
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>
    </div>
  );
}
