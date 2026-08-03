import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  BellRing,
  CalendarDays,
  Check,
  CheckCheck,
  LoaderCircle,
  TicketCheck,
  X,
} from "lucide-react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/firebase";

const timestampValue = (value) => {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const formatNotificationTime = (value) => {
  const milliseconds = timestampValue(value);
  if (!milliseconds) return "Just now";

  const difference = Date.now() - milliseconds;
  const minutes = Math.max(0, Math.floor(difference / 60000));

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
  }).format(new Date(milliseconds));
};

export default function NotificationBell() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const panelRef = useRef(null);
  const browserSeenIdsRef = useRef(new Set());
  const browserNotificationsReadyRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [readIds, setReadIds] = useState([]);
  const [browserPermission, setBrowserPermission] = useState(() =>
    typeof window !== "undefined" && "Notification" in window
      ? window.Notification.permission
      : "unsupported"
  );

  const storageKey = currentUser
    ? `mis-notifications-read-${currentUser.uid}`
    : "";

  useEffect(() => {
    if (!storageKey) return;

    try {
      const storedIds = JSON.parse(
        window.localStorage.getItem(storageKey) || "[]"
      );
      setReadIds(Array.isArray(storedIds) ? storedIds : []);
    } catch {
      setReadIds([]);
    }
  }, [storageKey]);

  useEffect(() => {
    browserSeenIdsRef.current = new Set();
    browserNotificationsReadyRef.current = false;
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!currentUser || !userProfile?.role) return undefined;

    setLoading(true);
    let ticketsLoaded = false;
    let eventsLoaded = userProfile.role !== "QA";

    const finishLoading = () => {
      if (ticketsLoaded && eventsLoaded) setLoading(false);
    };

    const unsubscribeTickets = onSnapshot(
      query(collection(db, "tickets"), orderBy("createdAt", "desc")),
      (snapshot) => {
        setTickets(
          snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          }))
        );
        ticketsLoaded = true;
        finishLoading();
      },
      (error) => {
        console.error("Unable to load ticket notifications:", error);
        ticketsLoaded = true;
        finishLoading();
      }
    );

    let unsubscribeEvents = () => {};

    if (userProfile.role === "QA") {
      unsubscribeEvents = onSnapshot(
        query(collection(db, "events"), orderBy("createdAt", "desc")),
        (snapshot) => {
          setEvents(
            snapshot.docs.map((document) => ({
              id: document.id,
              ...document.data(),
            }))
          );
          eventsLoaded = true;
          finishLoading();
        },
        (error) => {
          console.error("Unable to load event notifications:", error);
          eventsLoaded = true;
          finishLoading();
        }
      );
    }

    return () => {
      unsubscribeTickets();
      unsubscribeEvents();
    };
  }, [currentUser, userProfile?.role]);

  useEffect(() => {
    if (!open) return undefined;

    const closeOnOutsideClick = (event) => {
      if (!panelRef.current?.contains(event.target)) setOpen(false);
    };

    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const notifications = useMemo(() => {
    const role = userProfile?.role;
    const items = [];

    if (role === "admin" || role === "IT_STAFF") {
      tickets
        .filter((ticket) => ticket.status === "Pending")
        .forEach((ticket) => {
          items.push({
            id: `new-ticket-${ticket.id}`,
            title: "New support ticket",
            description: `${ticket.ticketNumber || "Ticket"}: ${
              ticket.subject || "No subject"
            }`,
            createdAt: ticket.createdAt,
            path: "/all-tickets",
            icon: TicketCheck,
            iconClass: "bg-blue-50 text-blue-600",
          });
        });
    }

    if (role === "QA") {
      events
        .filter((eventItem) =>
          ["Pending", "Pending QA Approval"].includes(eventItem.status)
        )
        .forEach((eventItem) => {
          items.push({
            id: `new-event-${eventItem.id}`,
            title: "New event for QA review",
            description:
              eventItem.eventTitle ||
              eventItem.eventNumber ||
              "Event booking",
            createdAt: eventItem.createdAt,
            path: "/events",
            icon: CalendarDays,
            iconClass: "bg-violet-50 text-violet-600",
          });
        });
    }

    tickets
      .filter(
        (ticket) =>
          ticket.requesterUid === currentUser?.uid &&
          ticket.status === "Waiting for Confirmation" &&
          ticket.userConfirmedResolved !== true
      )
      .forEach((ticket) => {
        items.push({
          id: `confirm-ticket-${ticket.id}`,
          title: "Please confirm ticket completion",
          description: `${ticket.ticketNumber || "Ticket"}: ${
            ticket.subject || "No subject"
          }`,
          createdAt: ticket.updatedAt || ticket.resolvedAt,
          path: "/my-tickets",
          icon: Check,
          iconClass: "bg-emerald-50 text-emerald-600",
        });
      });

    return items.sort(
      (first, second) =>
        timestampValue(second.createdAt) -
        timestampValue(first.createdAt)
    );
  }, [currentUser?.uid, events, tickets, userProfile?.role]);

  const unreadCount = notifications.filter(
    (notification) => !readIds.includes(notification.id)
  ).length;

  useEffect(() => {
    if (loading) return;

    const currentIds = new Set(
      notifications.map((notification) => notification.id)
    );

    if (!browserNotificationsReadyRef.current) {
      browserSeenIdsRef.current = currentIds;
      browserNotificationsReadyRef.current = true;
      return;
    }

    const newNotifications = notifications.filter(
      (notification) =>
        !browserSeenIdsRef.current.has(notification.id)
    );

    browserSeenIdsRef.current = currentIds;

    if (
      browserPermission !== "granted" ||
      typeof window === "undefined" ||
      !("Notification" in window)
    ) {
      return;
    }

    newNotifications.forEach((notification) => {
      const browserNotification = new window.Notification(
        notification.title,
        {
          body: notification.description,
          icon: "/vite.svg",
          tag: notification.id,
        }
      );

      browserNotification.onclick = () => {
        window.focus();
        navigate(notification.path);
        browserNotification.close();
      };
    });
  }, [browserPermission, loading, navigate, notifications]);

  const enableBrowserNotifications = async () => {
    if (!("Notification" in window)) {
      setBrowserPermission("unsupported");
      return;
    }

    const permission = await window.Notification.requestPermission();
    setBrowserPermission(permission);
  };

  const saveReadIds = (nextReadIds) => {
    const activeNotificationIds = new Set(
      notifications.map((notification) => notification.id)
    );
    const cleanedIds = [...new Set(nextReadIds)].filter((id) =>
      activeNotificationIds.has(id)
    );

    setReadIds(cleanedIds);
    window.localStorage.setItem(storageKey, JSON.stringify(cleanedIds));
  };

  const markAllAsRead = () => {
    saveReadIds(notifications.map((notification) => notification.id));
  };

  const openNotification = (notification) => {
    saveReadIds([...readIds, notification.id]);
    setOpen(false);
    navigate(notification.path);
  };

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className="relative rounded-xl border border-slate-200 p-2.5 text-slate-600 transition hover:bg-slate-50"
        aria-label={`Notifications${
          unreadCount ? `, ${unreadCount} unread` : ""
        }`}
        aria-expanded={open}
      >
        <Bell size={20} />

        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section className="fixed inset-x-3 top-20 z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:absolute sm:inset-auto sm:right-0 sm:top-12 sm:w-96">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <h2 className="font-bold text-slate-900">Notifications</h2>
              <p className="text-xs text-slate-500">
                {unreadCount} unread
              </p>
            </div>

            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50"
                >
                  <CheckCheck size={15} />
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close notifications"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {browserPermission !== "granted" && (
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
              {browserPermission === "default" ? (
                <button
                  type="button"
                  onClick={enableBrowserNotifications}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  <BellRing size={17} />
                  Enable browser popups
                </button>
              ) : (
                <p className="text-center text-xs leading-5 text-slate-500">
                  {browserPermission === "denied"
                    ? "Browser popups are blocked. Allow notifications in your browser site settings."
                    : "Browser notifications are not supported on this device."}
                </p>
              )}
            </div>
          )}

          <div className="max-h-[min(65vh,430px)] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-slate-500">
                <LoaderCircle size={20} className="animate-spin" />
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <Bell size={28} className="mx-auto text-slate-300" />
                <p className="mt-3 font-semibold text-slate-700">
                  You are all caught up
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  New activity will appear here.
                </p>
              </div>
            ) : (
              notifications.map((notification) => {
                const Icon = notification.icon;
                const unread = !readIds.includes(notification.id);

                return (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => openNotification(notification)}
                    className={`flex w-full items-start gap-3 border-b border-slate-100 px-4 py-4 text-left transition last:border-b-0 hover:bg-slate-50 ${
                      unread ? "bg-blue-50/50" : "bg-white"
                    }`}
                  >
                    <span
                      className={`mt-0.5 shrink-0 rounded-xl p-2 ${notification.iconClass}`}
                    >
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-3">
                        <span className="font-semibold text-slate-900">
                          {notification.title}
                        </span>
                        {unread && (
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600" />
                        )}
                      </span>
                      <span className="mt-1 block text-sm text-slate-600">
                        {notification.description}
                      </span>
                      <span className="mt-1.5 block text-xs text-slate-400">
                        {formatNotificationTime(notification.createdAt)}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </section>
      )}
    </div>
  );
}
