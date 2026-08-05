import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  Timestamp,
  runTransaction,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import {
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Edit3,
  Loader2,
  MapPin,
  MonitorCog,
  Save,
  Ticket,
  X,
} from "lucide-react";

import { db } from "../firebase/firebase";
import { useAuth } from "../context/AuthContext";

const STATUS_OPTIONS = [
  "Available",
  "Working on a Ticket",
  "Fixing Other Concern",
  "In Meeting",
  "Remote Support",
  "System Maintenance",
  "Installing Software",
  "Network Maintenance",
  "Training",
  "Lunch Break",
  "Out of Office",
];

const STATUS_STYLES = {
  Available: {
    badge: "bg-emerald-100 text-emerald-700",
    dot: "bg-emerald-500",
    card: "border-emerald-200",
  },

  "Working on a Ticket": {
    badge: "bg-blue-100 text-blue-700",
    dot: "bg-blue-500",
    card: "border-blue-200",
  },

  "Fixing Other Concern": {
    badge: "bg-violet-100 text-violet-700",
    dot: "bg-violet-500",
    card: "border-violet-200",
  },

  "In Meeting": {
    badge: "bg-cyan-100 text-cyan-700",
    dot: "bg-cyan-500",
    card: "border-cyan-200",
  },

  "Remote Support": {
    badge: "bg-indigo-100 text-indigo-700",
    dot: "bg-indigo-500",
    card: "border-indigo-200",
  },

  "System Maintenance": {
    badge: "bg-orange-100 text-orange-700",
    dot: "bg-orange-500",
    card: "border-orange-200",
  },

  "Installing Software": {
    badge: "bg-fuchsia-100 text-fuchsia-700",
    dot: "bg-fuchsia-500",
    card: "border-fuchsia-200",
  },

  "Network Maintenance": {
    badge: "bg-amber-100 text-amber-700",
    dot: "bg-amber-500",
    card: "border-amber-200",
  },

  Training: {
    badge: "bg-teal-100 text-teal-700",
    dot: "bg-teal-500",
    card: "border-teal-200",
  },

  "Lunch Break": {
    badge: "bg-yellow-100 text-yellow-700",
    dot: "bg-yellow-500",
    card: "border-yellow-200",
  },

  "Out of Office": {
    badge: "bg-slate-200 text-slate-700",
    dot: "bg-slate-500",
    card: "border-slate-300",
  },
};

const BLANK_FORM = {
  status: "Available",
  activity: "",
  location: "",
  ticketNumber: "",
  estimatedFinish: "",
};

const LUNCH_BREAK_DURATION_MS = 60 * 60 * 1000;

const NON_REPORTABLE_STATUSES = new Set([
  "Available",
  "Working on a Ticket",
  "Lunch Break",
  "Out of Office",
]);

const shouldRecordWorkLog = (status) =>
  Boolean(status) && !NON_REPORTABLE_STATUSES.has(status);

const formatDate = (value) => {
  if (!value) {
    return "Not available";
  }

  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const getUserName = (userProfile, currentUser) => {
  return (
    userProfile?.fullName ||
    userProfile?.name ||
    currentUser?.displayName ||
    currentUser?.email ||
    "IT Staff"
  );
};

const getInitials = (name) => {
  if (!name) {
    return "IT";
  }

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
};

export default function ITWorkBoard() {
  const { currentUser, userProfile } = useAuth();

  const [workPosts, setWorkPosts] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);

  const [form, setForm] = useState(BLANK_FORM);

  const [showEditor, setShowEditor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isITStaff = userProfile?.role === "IT_STAFF";
  const isAdmin =
    userProfile?.role === "admin" ||
    userProfile?.role === "ADMIN";
  const canViewRecentActivities = isITStaff || isAdmin;

  const saveBoardStatusWithWorkLog = async ({ boardData, automatic = false }) => {
    if (!currentUser?.uid) throw new Error("Your account information could not be found.");

    const staffName = getUserName(userProfile, currentUser);
    const now = Timestamp.now();
    const boardReference = doc(db, "itWorkBoard", currentUser.uid);
    const reportable = shouldRecordWorkLog(boardData.status);
    const newLogReference = reportable ? doc(collection(db, "itWorkLogs")) : null;

    await runTransaction(db, async (transaction) => {
      const boardSnapshot = await transaction.get(boardReference);
      const previousBoard = boardSnapshot.exists() ? boardSnapshot.data() : null;
      const previousLogId = previousBoard?.activeWorkLogId || "";

      if (previousLogId) {
        const previousLogReference = doc(db, "itWorkLogs", previousLogId);
        const previousLogSnapshot = await transaction.get(previousLogReference);
        if (previousLogSnapshot.exists()) {
          const previousLog = previousLogSnapshot.data();
          const startedAtMillis = previousLog.startedAt?.toMillis?.() || now.toMillis();
          const durationMs = Math.max(0, now.toMillis() - startedAtMillis);
          transaction.update(previousLogReference, {
            endedAt: now,
            durationMs,
            durationMinutes: Math.round(durationMs / 60000),
            updatedAt: now,
          });
        }
      }

      if (newLogReference) {
        transaction.set(newLogReference, {
          staffId: currentUser.uid,
          staffName,
          email: currentUser.email || "",
          department: userProfile?.department || "MIS",
          status: boardData.status,
          activity: boardData.activity || "",
          location: boardData.location || "",
          estimatedFinish: boardData.estimatedFinish || "",
          startedAt: now,
          endedAt: null,
          durationMs: 0,
          durationMinutes: 0,
          source: automatic ? "automatic" : "manual",
          isProductive: true,
          createdAt: now,
          updatedAt: now,
        });
      }

      transaction.set(boardReference, {
        uid: currentUser.uid,
        fullName: staffName,
        email: currentUser.email || "",
        department: userProfile?.department || "MIS",
        ...boardData,
        activeWorkLogId: newLogReference?.id || "",
        activeWorkLogStartedAt: newLogReference ? now : null,
        createdAt: previousBoard?.createdAt || boardData.createdAt || now,
        updatedAt: now,
        updatedByUid: currentUser.uid,
        updatedByName: staffName,
        updatedAutomatically: automatic,
      }, { merge: true });
    });
  };

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "itWorkBoard"),
      (snapshot) => {
        const records = snapshot.docs.map((workDocument) => ({
          id: workDocument.id,
          ...workDocument.data(),
        }));

        records.sort((firstPost, secondPost) => {
          const firstTime =
            firstPost.updatedAt?.toMillis?.() || 0;

          const secondTime =
            secondPost.updatedAt?.toMillis?.() || 0;

          return secondTime - firstTime;
        });

        setWorkPosts(records);
        setLoading(false);
        setError("");
      },
      (snapshotError) => {
        console.error(
          "Unable to load IT Work Board:",
          snapshotError
        );

        setError(
          "Unable to load the IT Work Board. Please check your connection."
        );

        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!canViewRecentActivities) {
      setRecentActivities([]);
      setActivitiesLoading(false);
      return undefined;
    }

    setActivitiesLoading(true);

    const recentActivityQuery = query(
      collection(db, "itWorkLogs"),
      orderBy("startedAt", "desc"),
      limit(20)
    );

    const unsubscribe = onSnapshot(
      recentActivityQuery,
      (snapshot) => {
        setRecentActivities(
          snapshot.docs.map((activityDocument) => ({
            id: activityDocument.id,
            ...activityDocument.data(),
          }))
        );
        setActivitiesLoading(false);
      },
      (snapshotError) => {
        console.error(
          "Unable to load recent IT activities:",
          snapshotError
        );
        setRecentActivities([]);
        setActivitiesLoading(false);
      }
    );

    return unsubscribe;
  }, [canViewRecentActivities]);

  useEffect(() => {
    if (!isITStaff || !currentUser?.uid) {
      setTicketsLoading(false);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      collection(db, "tickets"),
      (snapshot) => {
        const assignedTickets = snapshot.docs
          .map((ticketDocument) => ({
            id: ticketDocument.id,
            ...ticketDocument.data(),
          }))
          .filter((ticketItem) => {
            const assignedToCurrentUser =
              ticketItem.assignedToUid === currentUser.uid ||
              ticketItem.assignedTo === currentUser.uid;

            const activeStatus = ![
              "Resolved",
              "Waiting for Confirmation",
            ].includes(ticketItem.status);

            return assignedToCurrentUser && activeStatus;
          });

        setTickets(assignedTickets);
        setTicketsLoading(false);
      },
      (snapshotError) => {
        console.error(
          "Unable to load assigned tickets:",
          snapshotError
        );

        setTickets([]);
        setTicketsLoading(false);
      }
    );

    return unsubscribe;
  }, [currentUser?.uid, isITStaff]);

  const myCurrentPost = useMemo(() => {
    if (!currentUser?.uid) {
      return null;
    }

    return (
      workPosts.find(
        (post) =>
          post.uid === currentUser.uid ||
          post.id === currentUser.uid
      ) || null
    );
  }, [workPosts, currentUser?.uid]);

  useEffect(() => {
  if (!isITStaff || !currentUser?.uid || ticketsLoading) {
    return;
  }

  const inProgressTicket = tickets.find(
    (ticketItem) =>
      String(ticketItem.status || "")
        .trim()
        .toLowerCase() === "in progress"
  );

  // Only clear a ticket-synchronized status. Manual statuses such as
  // Lunch Break, In Meeting, and Training must remain selected.
  if (!inProgressTicket) {
    if (myCurrentPost?.status !== "Working on a Ticket") {
      return;
    }

    const setAvailableAutomatically = async () => {
      try {
        await saveBoardStatusWithWorkLog({
          automatic: true,
          boardData: {
            status: "Available",
            activity: "Ready to assist with IT concerns",
            location: "MIS Office",
            ticketNumber: "",
            estimatedFinish: "",
            lunchBreakStartedAt: null,
            lunchBreakEndsAt: null,
          },
        });
      } catch (error) {
        console.error("Unable to automatically set Available:", error);
      }
    };

    setAvailableAutomatically();
    return;
  }

  const ticketNumber =
    inProgressTicket.ticketNumber ||
    inProgressTicket.ticket_number ||
    inProgressTicket.ticketNo ||
    inProgressTicket.id;

  const ticketSubject =
    inProgressTicket.subject ||
    inProgressTicket.title ||
    inProgressTicket.concern ||
    inProgressTicket.description ||
    "IT concern";

  const ticketLocation =
    inProgressTicket.department ||
    inProgressTicket.requesterDepartment ||
    inProgressTicket.location ||
    "";

  // Prevent repeated Firestore writes when the board is already updated.
  const boardAlreadyUpdated =
    myCurrentPost?.status === "Working on a Ticket" &&
    myCurrentPost?.ticketNumber === ticketNumber;

  if (boardAlreadyUpdated) {
    return;
  }

  const updateWorkBoardAutomatically = async () => {
    try {
      await saveBoardStatusWithWorkLog({
        automatic: true,
        boardData: {
          status: "Working on a Ticket",
          activity: `Working on: ${ticketSubject}`,
          location: ticketLocation,
          ticketNumber,
          estimatedFinish: myCurrentPost?.estimatedFinish || "",
          lunchBreakStartedAt: null,
          lunchBreakEndsAt: null,
        },
      });
    } catch (automaticUpdateError) {
      console.error(
        "Unable to automatically update IT Work Board:",
        automaticUpdateError
      );
    }
  };

  updateWorkBoardAutomatically();
}, [
  tickets,
  ticketsLoading,
  isITStaff,
  currentUser?.uid,
  currentUser?.email,
  userProfile,
  myCurrentPost,
]);

  useEffect(() => {
    if (
      !isITStaff ||
      !currentUser?.uid ||
      myCurrentPost?.status !== "Lunch Break"
    ) {
      return undefined;
    }

    const lunchBreakEndsAt =
      myCurrentPost.lunchBreakEndsAt?.toMillis?.() ||
      (myCurrentPost.lunchBreakEndsAt
        ? new Date(myCurrentPost.lunchBreakEndsAt).getTime()
        : 0);

    if (!lunchBreakEndsAt) {
      return undefined;
    }

    const returnToAvailable = async () => {
      try {
        await saveBoardStatusWithWorkLog({
          automatic: true,
          boardData: {
            status: "Available",
            activity: "Ready to assist with IT concerns",
            location: "MIS Office",
            ticketNumber: "",
            estimatedFinish: "",
            lunchBreakStartedAt: null,
            lunchBreakEndsAt: null,
          },
        });
      } catch (automaticUpdateError) {
        console.error(
          "Unable to end lunch break automatically:",
          automaticUpdateError
        );
      }
    };

    const remainingTime = lunchBreakEndsAt - Date.now();

    if (remainingTime <= 0) {
      returnToAvailable();
      return undefined;
    }

    const timeoutId = window.setTimeout(
      returnToAvailable,
      remainingTime
    );

    return () => window.clearTimeout(timeoutId);
  }, [
    currentUser,
    isITStaff,
    myCurrentPost?.lunchBreakEndsAt,
    myCurrentPost?.status,
    userProfile,
  ]);

  useEffect(() => {
    if (!myCurrentPost || showEditor) {
      return;
    }

    setForm({
      status: myCurrentPost.status || "Available",
      activity: myCurrentPost.activity || "",
      location: myCurrentPost.location || "",
      ticketNumber: myCurrentPost.ticketNumber || "",
      estimatedFinish:
        myCurrentPost.estimatedFinish || "",
    });
  }, [myCurrentPost, showEditor]);

  const openEditor = () => {
    setForm({
      status: myCurrentPost?.status || "Available",
      activity: myCurrentPost?.activity || "",
      location: myCurrentPost?.location || "",
      ticketNumber:
        myCurrentPost?.ticketNumber || "",
      estimatedFinish:
        myCurrentPost?.estimatedFinish || "",
    });

    setMessage("");
    setError("");
    setShowEditor(true);
  };

  const closeEditor = () => {
    if (saving) {
      return;
    }

    setShowEditor(false);
    setMessage("");
    setError("");
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  };

  const handleTicketSelection = (event) => {
    const selectedTicketNumber = event.target.value;

    const selectedTicket = tickets.find(
      (ticketItem) =>
        ticketItem.ticketNumber === selectedTicketNumber
    );

    setForm((currentForm) => ({
      ...currentForm,
      ticketNumber: selectedTicketNumber,

      activity: selectedTicket
        ? `Working on: ${
            selectedTicket.subject || "IT concern"
          }`
        : currentForm.activity,

      location:
        selectedTicket?.department ||
        currentForm.location,

      status: selectedTicket
        ? "Working on a Ticket"
        : currentForm.status,
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();

    if (!isITStaff) {
      setError(
        "Only IT staff members can update the IT Work Board."
      );
      return;
    }

    if (!currentUser?.uid) {
      setError(
        "Your account information could not be found."
      );
      return;
    }

    if (!form.status) {
      setError("Please select your current status.");
      return;
    }

    if (
      form.status !== "Available" &&
      !form.activity.trim()
    ) {
      setError(
        "Please describe what you are currently doing."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const isLunchBreak = form.status === "Lunch Break";

      await saveBoardStatusWithWorkLog({
        automatic: false,
        boardData: {
          status: form.status,
          activity: form.status === "Available"
            ? form.activity.trim() || "Ready to assist with IT concerns"
            : form.activity.trim(),
          location: form.location.trim(),
          ticketNumber: form.status === "Working on a Ticket"
            ? form.ticketNumber.trim()
            : "",
          estimatedFinish: form.estimatedFinish.trim(),
          lunchBreakStartedAt: isLunchBreak ? Timestamp.now() : null,
          lunchBreakEndsAt: isLunchBreak
            ? Timestamp.fromMillis(Date.now() + LUNCH_BREAK_DURATION_MS)
            : null,
        },
      });

      setMessage(
        "Your current activity has been posted successfully."
      );

      setShowEditor(false);
    } catch (saveError) {
      console.error(
        "Unable to save IT work status:",
        saveError
      );

      setError(
        "Unable to save your activity. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSetAvailable = async () => {
    if (!isITStaff || !currentUser?.uid) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");
      await saveBoardStatusWithWorkLog({
        automatic: false,
        boardData: {
          status: "Available",
          activity: "Ready to assist with IT concerns",
          location: "MIS Office",
          ticketNumber: "",
          estimatedFinish: "",
          lunchBreakStartedAt: null,
          lunchBreakEndsAt: null,
        },
      });

      setMessage(
        "Your status is now set to Available."
      );
    } catch (updateError) {
      console.error(
        "Unable to update availability:",
        updateError
      );

      setError(
        "Unable to update your availability."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-500 p-4 text-white shadow-lg sm:rounded-3xl sm:p-6 md:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-medium backdrop-blur-sm">
              <MonitorCog size={16} />
              Live MIS activity
            </div>

            <h1 className="text-2xl font-bold sm:text-3xl md:text-4xl">
              IT Work Board
            </h1>

            <p className="mt-3 max-w-2xl text-blue-50">
              See what the IT team is currently working
              on and who is available to assist.
            </p>
          </div>

          {isITStaff && (
            <div className="grid gap-3 sm:flex sm:flex-wrap">
              <button
                type="button"
                onClick={handleSetAvailable}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-white shadow transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <Loader2
                    size={18}
                    className="animate-spin"
                  />
                ) : (
                  <CheckCircle2 size={18} />
                )}

                Set Available
              </button>

              <button
                type="button"
                onClick={openEditor}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 font-semibold text-blue-700 shadow transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Edit3 size={18} />

                {myCurrentPost
                  ? "Update My Activity"
                  : "Post My Activity"}
              </button>
            </div>
          )}
        </div>
      </section>

      {message && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">
          {message}
        </div>
      )}

      {error && !showEditor && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-72 items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center gap-3 text-slate-500">
            <Loader2
              size={22}
              className="animate-spin"
            />

            Loading IT Work Board...
          </div>
        </div>
      ) : workPosts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <MonitorCog
            size={48}
            className="mx-auto text-slate-300"
          />

          <h2 className="mt-4 text-xl font-semibold text-slate-800">
            No IT activity found
          </h2>

          <p className="mt-2 text-slate-500">
            IT staff activities will appear here after
            they post an update.
          </p>

          {isITStaff && (
            <button
              type="button"
              onClick={openEditor}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
            >
              <Edit3 size={18} />
              Post My First Activity
            </button>
          )}
        </div>
      ) : (
        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {workPosts.map((post) => (
            <WorkCard
              key={post.id}
              post={post}
              canEdit={
                isITStaff &&
                (post.uid === currentUser?.uid ||
                  post.id === currentUser?.uid)
              }
              onEdit={openEditor}
            />
          ))}
        </section>
      )}

      {canViewRecentActivities && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
            <h2 className="text-lg font-bold text-slate-900">
              Recent Saved Activities
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              The 20 most recent non-ticket work activities recorded by IT staff, showing when each activity started.
            </p>
          </div>

          {activitiesLoading ? (
            <div className="flex min-h-48 items-center justify-center">
              <Loader2
                size={24}
                className="animate-spin text-blue-600"
              />
              <span className="ml-3 text-sm text-slate-500">
                Loading recent activities...
              </span>
            </div>
          ) : recentActivities.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              No saved IT activities found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-4">IT Staff</th>
                    <th className="px-5 py-4">Activity Type</th>
                    <th className="px-5 py-4">Description</th>
                    <th className="px-5 py-4">Location</th>
                    <th className="px-5 py-4">Time Started</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {recentActivities.map((activityItem) => (
                    <tr
                      key={activityItem.id}
                      className="hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-800">
                          {activityItem.staffName || "IT Staff"}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {activityItem.department || "MIS"}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                          {activityItem.status || "Activity"}
                        </span>
                      </td>

                      <td className="max-w-xs px-5 py-4 text-sm text-slate-700">
                        <p className="line-clamp-2">
                          {activityItem.activity || "No description"}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {activityItem.location || "Not specified"}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {formatDate(activityItem.startedAt)}
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {showEditor && isITStaff && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onClick={closeEditor}
        >
          <div
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {myCurrentPost
                    ? "Update My Activity"
                    : "Post My Activity"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Let users know what you are currently
                  working on.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditor}
                disabled={saving}
                className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
                aria-label="Close activity editor"
              >
                <X size={22} />
              </button>
            </div>

            <form
              onSubmit={handleSave}
              className="space-y-5 p-6"
            >
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label
                  htmlFor="status"
                  className="text-sm font-semibold text-slate-700"
                >
                  Current Status
                </label>

                <select
                  id="status"
                  name="status"
                  value={form.status}
                  onChange={handleInputChange}
                  disabled={saving}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option
                      key={status}
                      value={status}
                    >
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              {form.status ===
                "Working on a Ticket" && (
                <div>
                  <label
                    htmlFor="ticketNumber"
                    className="text-sm font-semibold text-slate-700"
                  >
                    Related Ticket
                  </label>

                  <select
                    id="ticketNumber"
                    name="ticketNumber"
                    value={form.ticketNumber}
                    onChange={handleTicketSelection}
                    disabled={
                      saving || ticketsLoading
                    }
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                  >
                    <option value="">
                      {ticketsLoading
                        ? "Loading assigned tickets..."
                        : "Select an assigned ticket"}
                    </option>

                    {tickets.map((ticketItem) => (
                      <option
                        key={ticketItem.id}
                        value={
                          ticketItem.ticketNumber || ""
                        }
                      >
                        {ticketItem.ticketNumber ||
                          "No ticket number"}{" "}
                        —{" "}
                        {ticketItem.subject ||
                          "No subject"}
                      </option>
                    ))}
                  </select>

                  {!ticketsLoading &&
                    tickets.length === 0 && (
                      <p className="mt-2 text-sm text-amber-600">
                        You currently have no active
                        assigned tickets.
                      </p>
                    )}
                </div>
              )}

              <div>
                <label
                  htmlFor="activity"
                  className="text-sm font-semibold text-slate-700"
                >
                  What are you currently doing?
                </label>

                <textarea
                  id="activity"
                  name="activity"
                  rows={4}
                  value={form.activity}
                  onChange={handleInputChange}
                  disabled={saving}
                  placeholder="Example: Fixing the printer issue in the Accounting Department"
                  className="mt-2 w-full resize-none rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="location"
                    className="text-sm font-semibold text-slate-700"
                  >
                    Location or Department
                  </label>

                  <input
                    id="location"
                    name="location"
                    type="text"
                    value={form.location}
                    onChange={handleInputChange}
                    disabled={saving}
                    placeholder="Example: Accounting Office"
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="estimatedFinish"
                    className="text-sm font-semibold text-slate-700"
                  >
                    Estimated Finish
                  </label>

                  <input
                    id="estimatedFinish"
                    name="estimatedFinish"
                    type="text"
                    value={form.estimatedFinish}
                    onChange={handleInputChange}
                    disabled={saving}
                    placeholder="Example: 11:30 AM or 30 minutes"
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeEditor}
                  disabled={saving}
                  className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2
                      size={18}
                      className="animate-spin"
                    />
                  ) : (
                    <Save size={18} />
                  )}

                  {saving
                    ? "Posting..."
                    : myCurrentPost
                      ? "Update Activity"
                      : "Post Activity"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkCard({
  post,
  canEdit,
  onEdit,
}) {
  const style =
    STATUS_STYLES[post.status] || {
      badge: "bg-slate-100 text-slate-700",
      dot: "bg-slate-500",
      card: "border-slate-200",
    };

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${style.card}`}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 font-bold text-white">
          {getInitials(post.fullName)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-slate-900">
                {post.fullName || "IT Staff"}
              </h2>

              <p className="text-sm text-slate-500">
                {post.department || "MIS Department"}
              </p>
            </div>

            {canEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="rounded-lg p-2 text-blue-600 transition hover:bg-blue-50"
                title="Edit my activity"
                aria-label="Edit my activity"
              >
                <Edit3 size={17} />
              </button>
            )}
          </div>

          <div className="mt-3">
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${style.badge}`}
            >
              <span
                className={`h-2 w-2 rounded-full ${style.dot}`}
              />

              {post.status || "No Status"}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-xl bg-slate-50 p-4">
        <div className="flex items-start gap-3">
          <BriefcaseBusiness
            size={19}
            className="mt-0.5 shrink-0 text-blue-600"
          />

          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Current Activity
            </p>

            <p className="mt-1 whitespace-pre-wrap break-words font-medium text-slate-800">
              {post.activity ||
                "No activity description provided."}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3 text-sm text-slate-600">
        {post.ticketNumber && (
          <InfoRow
            icon={<Ticket size={17} />}
            label="Ticket"
            value={post.ticketNumber}
          />
        )}

        {post.location && (
          <InfoRow
            icon={<MapPin size={17} />}
            label="Location"
            value={post.location}
          />
        )}

        {post.estimatedFinish && (
          <InfoRow
            icon={<CalendarClock size={17} />}
            label="Estimated Finish"
            value={post.estimatedFinish}
          />
        )}

        <InfoRow
          icon={<Clock3 size={17} />}
          label="Last Updated"
          value={formatDate(post.updatedAt)}
        />
      </div>
    </article>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-slate-400">
        {icon}
      </span>

      <div className="min-w-0">
        <span className="font-medium text-slate-500">
          {label}:
        </span>{" "}
        <span className="break-words text-slate-800">
          {value}
        </span>
      </div>
    </div>
  );
}