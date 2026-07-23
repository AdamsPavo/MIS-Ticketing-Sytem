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
  AlertTriangle,
  CheckCircle2,
  Eye,
  Loader2,
  RotateCcw,
  Save,
  Search,
  X,
} from "lucide-react";

import { db } from "../firebase/firebase";
import { useAuth } from "../context/AuthContext";

const statusStyles = {
  Pending: "bg-amber-100 text-amber-700",
  Assigned: "bg-blue-100 text-blue-700",
  "In Progress": "bg-purple-100 text-purple-700",
  "Waiting for Confirmation":
    "bg-cyan-100 text-cyan-700",
  Resolved: "bg-green-100 text-green-700",
};

const formatDate = (timestamp) => {
  if (!timestamp) {
    return "-";
  }

  const date =
    typeof timestamp?.toDate === "function"
      ? timestamp.toDate()
      : new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const getDisplayName = (
  userProfile,
  currentUser,
  fallback = "Unknown User"
) => {
  return (
    userProfile?.fullName ||
    userProfile?.name ||
    currentUser?.displayName ||
    currentUser?.email ||
    fallback
  );
};

export default function MyTickets() {
  const { currentUser, userProfile } = useAuth();

  const [tickets, setTickets] = useState([]);
  const [search, setSearch] = useState("");

  const [selectedTicket, setSelectedTicket] =
    useState(null);

  const [editStatus, setEditStatus] = useState("");
  const [editRemarks, setEditRemarks] =
    useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [actionTicketId, setActionTicketId] =
    useState("");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const ticketsQuery = query(
      collection(db, "tickets"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      ticketsQuery,
      (snapshot) => {
        const ticketData = snapshot.docs.map(
          (ticketDocument) => ({
            id: ticketDocument.id,
            ...ticketDocument.data(),
          })
        );

        setTickets(ticketData);
        setLoading(false);
        setError("");

        setSelectedTicket((currentTicket) => {
          if (!currentTicket) {
            return null;
          }

          return (
            ticketData.find(
              (ticket) =>
                ticket.id === currentTicket.id
            ) || null
          );
        });
      },
      (snapshotError) => {
        console.error(
          "Unable to load tickets:",
          snapshotError
        );

        setError(
          "Unable to load tickets. Please try again."
        );

        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const isRequester = (ticket) => {
    if (!ticket || !currentUser?.uid) {
      return false;
    }

    return (
      ticket.requesterUid === currentUser.uid ||
      ticket.createdByUid === currentUser.uid ||
      ticket.userUid === currentUser.uid ||
      ticket.createdBy === currentUser.uid
    );
  };

  const canManageTicket = (ticket) => {
    if (!ticket || !currentUser?.uid) {
      return false;
    }

    if (userProfile?.role === "admin") {
      return true;
    }

    if (userProfile?.role === "IT_STAFF") {
      return (
        ticket.assignedTo === currentUser.uid ||
        ticket.assignedToUid === currentUser.uid
      );
    }

    return false;
  };

  const canConfirmTicket = (ticket) => {
    if (!ticket || !currentUser?.uid) {
      return false;
    }

    const requesterRole =
      userProfile?.role === "user" ||
      userProfile?.role === "QA";

    return (
      requesterRole &&
      isRequester(ticket) &&
      ticket.status ===
        "Waiting for Confirmation"
    );
  };

  const myTickets = useMemo(() => {
    if (!currentUser?.uid || !userProfile?.role) {
      return [];
    }

    const searchValue = search
      .trim()
      .toLowerCase();

    return tickets.filter((ticket) => {
      let canSeeTicket = false;

      if (userProfile.role === "admin") {
        canSeeTicket = Boolean(
          ticket.assignedTo ||
            ticket.assignedToUid
        );
      } else if (
        userProfile.role === "IT_STAFF"
      ) {
        canSeeTicket =
          ticket.assignedTo === currentUser.uid ||
          ticket.assignedToUid ===
            currentUser.uid;
      } else if (
        userProfile.role === "user" ||
        userProfile.role === "QA"
      ) {
        canSeeTicket = isRequester(ticket);
      }

      if (!canSeeTicket) {
        return false;
      }

      if (!searchValue) {
        return true;
      }

      return (
        ticket.ticketNumber
          ?.toLowerCase()
          .includes(searchValue) ||
        ticket.subject
          ?.toLowerCase()
          .includes(searchValue) ||
        ticket.category
          ?.toLowerCase()
          .includes(searchValue) ||
        ticket.department
          ?.toLowerCase()
          .includes(searchValue) ||
        ticket.assignedToName
          ?.toLowerCase()
          .includes(searchValue) ||
        ticket.requesterName
          ?.toLowerCase()
          .includes(searchValue) ||
        ticket.description
          ?.toLowerCase()
          .includes(searchValue)
      );
    });
  }, [
    tickets,
    search,
    currentUser?.uid,
    userProfile?.role,
  ]);

  const openTicket = (ticket) => {
    setSelectedTicket(ticket);
    setEditStatus(ticket.status || "Assigned");
    setEditRemarks(ticket.remarks || "");
    setError("");
    setMessage("");
  };

  const closeTicketModal = () => {
    if (saving || actionTicketId) {
      return;
    }

    setSelectedTicket(null);
    setEditStatus("");
    setEditRemarks("");
    setError("");
    setMessage("");
  };

  const handleSaveChanges = async () => {
    if (!selectedTicket) {
      return;
    }

    if (!canManageTicket(selectedTicket)) {
      setError(
        "You are not allowed to edit this ticket."
      );

      return;
    }

    if (!editStatus) {
      setError(
        "Please select a ticket status."
      );

      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const ticketReference = doc(
        db,
        "tickets",
        selectedTicket.id
      );

      const staffName = getDisplayName(
        userProfile,
        currentUser,
        "MIS Staff"
      );

      const updates = {
        status: editStatus,
        remarks: editRemarks.trim(),
        updatedAt: serverTimestamp(),
        updatedByUid: currentUser.uid,
        updatedByName: staffName,
      };

      if (editStatus === "Assigned") {
        updates.assignedStatusUpdatedAt =
          serverTimestamp();
      }

      if (editStatus === "In Progress") {
        updates.startedAt =
          selectedTicket.startedAt ||
          serverTimestamp();

        updates.startedByUid =
          currentUser.uid;

        updates.startedByName = staffName;

        updates.userConfirmedResolved = false;
      }

      if (
        editStatus ===
        "Waiting for Confirmation"
      ) {
        updates.markedDoneAt =
          serverTimestamp();

        updates.markedDoneByUid =
          currentUser.uid;

        updates.markedDoneByName = staffName;

        updates.userConfirmedResolved = false;
      }

      await updateDoc(
        ticketReference,
        updates
      );

      setMessage(
        "Ticket updated successfully."
      );
    } catch (updateError) {
      console.error(
        "Unable to update ticket:",
        updateError
      );

      setError(
        "Unable to update the ticket. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAsDone = async (ticket) => {
    if (!canManageTicket(ticket)) {
      setError(
        "You are not allowed to complete this ticket."
      );

      return;
    }

    try {
      setActionTicketId(ticket.id);
      setError("");
      setMessage("");

      const ticketReference = doc(
        db,
        "tickets",
        ticket.id
      );

      const staffName = getDisplayName(
        userProfile,
        currentUser,
        "MIS Staff"
      );

      const currentRemarks =
        selectedTicket?.id === ticket.id
          ? editRemarks.trim()
          : ticket.remarks || "";

      await updateDoc(ticketReference, {
        status: "Waiting for Confirmation",
        remarks: currentRemarks,

        markedDoneAt: serverTimestamp(),
        markedDoneByUid: currentUser.uid,
        markedDoneByName: staffName,

        userConfirmedResolved: false,

        updatedAt: serverTimestamp(),
        updatedByUid: currentUser.uid,
        updatedByName: staffName,
      });

      if (selectedTicket?.id === ticket.id) {
        setEditStatus(
          "Waiting for Confirmation"
        );

        setMessage(
          "Ticket marked as done and sent to the requester for confirmation."
        );
      }
    } catch (updateError) {
      console.error(
        "Unable to mark ticket as done:",
        updateError
      );

      setError(
        "Unable to mark the ticket as done. Please try again."
      );
    } finally {
      setActionTicketId("");
    }
  };

  const handleConfirmResolved = async (
    ticket
  ) => {
    if (!canConfirmTicket(ticket)) {
      setError(
        "You are not allowed to confirm this ticket."
      );

      return;
    }

    try {
      setActionTicketId(ticket.id);
      setError("");
      setMessage("");

      const ticketReference = doc(
        db,
        "tickets",
        ticket.id
      );

      const requesterName = getDisplayName(
        userProfile,
        currentUser,
        "Requester"
      );

      await updateDoc(ticketReference, {
        status: "Resolved",

        userConfirmedResolved: true,

        confirmedAt: serverTimestamp(),
        confirmedByUid: currentUser.uid,
        confirmedByName: requesterName,

        resolvedAt: serverTimestamp(),
        resolvedByUid: currentUser.uid,
        resolvedByName: requesterName,

        updatedAt: serverTimestamp(),
        updatedByUid: currentUser.uid,
        updatedByName: requesterName,
      });

      if (selectedTicket?.id === ticket.id) {
        setEditStatus("Resolved");

        setMessage(
          "Thank you. The ticket has been confirmed as resolved."
        );
      }
    } catch (confirmationError) {
      console.error(
        "Unable to confirm ticket:",
        confirmationError
      );

      setError(
        "Unable to confirm the ticket. Please try again."
      );
    } finally {
      setActionTicketId("");
    }
  };

  const handleProblemNotFixed = async (
    ticket
  ) => {
    if (!canConfirmTicket(ticket)) {
      setError(
        "You are not allowed to return this ticket."
      );

      return;
    }

    try {
      setActionTicketId(ticket.id);
      setError("");
      setMessage("");

      const ticketReference = doc(
        db,
        "tickets",
        ticket.id
      );

      const requesterName = getDisplayName(
        userProfile,
        currentUser,
        "Requester"
      );

      await updateDoc(ticketReference, {
        status: "In Progress",

        userConfirmedResolved: false,

        returnedByUser: true,
        returnedAt: serverTimestamp(),
        returnedByUid: currentUser.uid,
        returnedByName: requesterName,

        lastUserResponse: "Problem Not Fixed",

        updatedAt: serverTimestamp(),
        updatedByUid: currentUser.uid,
        updatedByName: requesterName,
      });

      if (selectedTicket?.id === ticket.id) {
        setEditStatus("In Progress");

        setMessage(
          "The ticket was returned to the assigned IT staff."
        );
      }
    } catch (returnError) {
      console.error(
        "Unable to return ticket:",
        returnError
      );

      setError(
        "Unable to return the ticket. Please try again."
      );
    } finally {
      setActionTicketId("");
    }
  };

  const pageDescription = useMemo(() => {
    if (userProfile?.role === "admin") {
      return "View and manage all tickets assigned to IT staff.";
    }

    if (userProfile?.role === "IT_STAFF") {
      return "View and manage tickets assigned to your account.";
    }

    return "Track your submitted concerns and confirm whether the problem has been resolved.";
  }, [userProfile?.role]);

  const emptyMessage = useMemo(() => {
    if (search.trim()) {
      return "No matching tickets found.";
    }

    if (userProfile?.role === "admin") {
      return "No tickets are currently assigned to IT staff.";
    }

    if (userProfile?.role === "IT_STAFF") {
      return "No tickets are currently assigned to your account.";
    }

    return "You have not submitted any tickets yet.";
  }, [search, userProfile?.role]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          My Tickets
        </h1>

        <p className="mt-2 text-slate-500">
          {pageDescription}
        </p>
      </div>

      {error && !selectedTicket && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {message && !selectedTicket && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      )}

      <div className="relative">
        <Search
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />

        <input
          type="search"
          placeholder="Search ticket..."
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-4 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead className="bg-slate-50">
              <tr className="text-left text-sm text-slate-500">
                <th className="px-5 py-4">
                  Ticket #
                </th>

                <th className="px-5 py-4">
                  Subject
                </th>

                <th className="px-5 py-4">
                  Category
                </th>

                <th className="px-5 py-4">
                  Status
                </th>

                <th className="px-5 py-4">
                  Assigned To
                </th>

                <th className="px-5 py-4">
                  Created
                </th>

                <th className="px-5 py-4">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-16 text-center text-slate-500"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Loader2
                        size={20}
                        className="animate-spin"
                      />

                      Loading tickets...
                    </div>
                  </td>
                </tr>
              )}

              {!loading &&
                myTickets.map((ticket) => {
                  const waitingForConfirmation =
                    ticket.status ===
                    "Waiting for Confirmation";

                  const resolved =
                    ticket.status === "Resolved";

                  const actionLoading =
                    actionTicketId === ticket.id;

                  return (
                    <tr
                      key={ticket.id}
                      className="border-t transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4 font-semibold text-blue-700">
                        {ticket.ticketNumber || "-"}
                      </td>

                      <td className="px-5 py-4 font-medium text-slate-800">
                        {ticket.subject || "-"}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {ticket.category || "-"}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${
                            statusStyles[
                              ticket.status
                            ] ||
                            "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {ticket.status ||
                            "Unknown"}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {ticket.assignedToName ||
                          "Waiting for assignment"}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {formatDate(
                          ticket.createdAt
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              openTicket(ticket)
                            }
                            className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                          >
                            <Eye size={16} />
                            View
                          </button>

                          {canManageTicket(ticket) &&
                            !waitingForConfirmation &&
                            !resolved && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleMarkAsDone(
                                    ticket
                                  )
                                }
                                disabled={
                                  actionLoading
                                }
                                className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {actionLoading ? (
                                  <Loader2
                                    size={16}
                                    className="animate-spin"
                                  />
                                ) : (
                                  <CheckCircle2
                                    size={16}
                                  />
                                )}

                                {actionLoading
                                  ? "Updating..."
                                  : "Mark as Done"}
                              </button>
                            )}

                          {canConfirmTicket(ticket) && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  handleConfirmResolved(
                                    ticket
                                  )
                                }
                                disabled={
                                  actionLoading
                                }
                                className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {actionLoading ? (
                                  <Loader2
                                    size={16}
                                    className="animate-spin"
                                  />
                                ) : (
                                  <CheckCircle2
                                    size={16}
                                  />
                                )}

                                Confirm Resolved
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleProblemNotFixed(
                                    ticket
                                  )
                                }
                                disabled={
                                  actionLoading
                                }
                                className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                <RotateCcw
                                  size={16}
                                />

                                Problem Not Fixed
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

              {!loading &&
                myTickets.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-16 text-center text-slate-500"
                    >
                      {emptyMessage}
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedTicket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={closeTicketModal}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {selectedTicket.ticketNumber ||
                    "Ticket Details"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Created{" "}
                  {formatDate(
                    selectedTicket.createdAt
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={closeTicketModal}
                disabled={
                  saving ||
                  Boolean(actionTicketId)
                }
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
                aria-label="Close ticket details"
              >
                <X size={22} />
              </button>
            </div>

            <div className="space-y-5 p-6">
              {message && (
                <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                  {message}
                </div>
              )}

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {canConfirmTicket(
                selectedTicket
              ) && (
                <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4">
                  <div className="flex gap-3">
                    <AlertTriangle
                      size={22}
                      className="mt-0.5 shrink-0 text-cyan-700"
                    />

                    <div>
                      <p className="font-semibold text-cyan-900">
                        Please confirm the
                        resolution
                      </p>

                      <p className="mt-1 text-sm text-cyan-800">
                        The MIS staff marked this
                        ticket as done. Please check
                        whether your problem has
                        been resolved.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <DetailItem
                label="Subject"
                value={
                  selectedTicket.subject || "-"
                }
              />

              <DetailItem
                label="Category"
                value={
                  selectedTicket.category || "-"
                }
              />

              {selectedTicket.department && (
                <DetailItem
                  label="Department"
                  value={
                    selectedTicket.department
                  }
                />
              )}

              <DetailItem
                label="Description"
                value={
                  selectedTicket.description ||
                  "No description provided."
                }
                preserveWhitespace
              />

              <DetailItem
                label="Assigned To"
                value={
                  selectedTicket.assignedToName ||
                  "Not assigned"
                }
              />

              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Status
                </p>

                <span
                  className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                    statusStyles[
                      selectedTicket.status
                    ] ||
                    "bg-slate-100 text-slate-700"
                  }`}
                >
                  {selectedTicket.status ||
                    "Unknown"}
                </span>
              </div>

              {selectedTicket.markedDoneByName && (
                <DetailItem
                  label="Marked Done By"
                  value={
                    selectedTicket
                      .markedDoneByName
                  }
                />
              )}

              {selectedTicket.markedDoneAt && (
                <DetailItem
                  label="Marked Done At"
                  value={formatDate(
                    selectedTicket.markedDoneAt
                  )}
                />
              )}

              {selectedTicket.confirmedByName && (
                <DetailItem
                  label="Confirmed By"
                  value={
                    selectedTicket.confirmedByName
                  }
                />
              )}

              {selectedTicket.confirmedAt && (
                <DetailItem
                  label="Confirmed At"
                  value={formatDate(
                    selectedTicket.confirmedAt
                  )}
                />
              )}

              {canManageTicket(
                selectedTicket
              ) ? (
                <>
                  <div>
                    <label
                      htmlFor="ticket-status"
                      className="text-sm font-semibold text-slate-700"
                    >
                      Status
                    </label>

                    <select
                      id="ticket-status"
                      value={editStatus}
                      onChange={(event) =>
                        setEditStatus(
                          event.target.value
                        )
                      }
                      disabled={
                        saving ||
                        selectedTicket.status ===
                          "Resolved"
                      }
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                    >
                      <option value="Assigned">
                        Assigned
                      </option>

                      <option value="In Progress">
                        In Progress
                      </option>

                      <option value="Waiting for Confirmation">
                        Waiting for Confirmation
                      </option>

                      {selectedTicket.status ===
                        "Resolved" && (
                        <option value="Resolved">
                          Resolved
                        </option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="ticket-remarks"
                      className="text-sm font-semibold text-slate-700"
                    >
                      MIS Remarks
                    </label>

                    <textarea
                      id="ticket-remarks"
                      rows={5}
                      value={editRemarks}
                      onChange={(event) =>
                        setEditRemarks(
                          event.target.value
                        )
                      }
                      disabled={
                        saving ||
                        selectedTicket.status ===
                          "Resolved"
                      }
                      placeholder="Enter the action taken, resolution, or other remarks..."
                      className="mt-2 w-full resize-none rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
                    />
                  </div>

                  {selectedTicket.status !==
                    "Resolved" && (
                    <div className="flex flex-wrap justify-end gap-3 border-t pt-5">
                      {selectedTicket.status !==
                        "Waiting for Confirmation" && (
                        <button
                          type="button"
                          onClick={() =>
                            handleMarkAsDone(
                              selectedTicket
                            )
                          }
                          disabled={
                            saving ||
                            actionTicketId ===
                              selectedTicket.id
                          }
                          className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-3 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {actionTicketId ===
                          selectedTicket.id ? (
                            <Loader2
                              size={18}
                              className="animate-spin"
                            />
                          ) : (
                            <CheckCircle2
                              size={18}
                            />
                          )}

                          Mark as Done
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={
                          handleSaveChanges
                        }
                        disabled={saving}
                        className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
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
                          ? "Saving..."
                          : "Save Changes"}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">
                      MIS Remarks
                    </p>

                    <p className="mt-1 whitespace-pre-wrap text-slate-900">
                      {selectedTicket.remarks ||
                        "No remarks yet."}
                    </p>
                  </div>

                  {canConfirmTicket(
                    selectedTicket
                  ) && (
                    <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          handleProblemNotFixed(
                            selectedTicket
                          )
                        }
                        disabled={
                          actionTicketId ===
                          selectedTicket.id
                        }
                        className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {actionTicketId ===
                        selectedTicket.id ? (
                          <Loader2
                            size={18}
                            className="animate-spin"
                          />
                        ) : (
                          <RotateCcw
                            size={18}
                          />
                        )}

                        Problem Not Fixed
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleConfirmResolved(
                            selectedTicket
                          )
                        }
                        disabled={
                          actionTicketId ===
                          selectedTicket.id
                        }
                        className="flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {actionTicketId ===
                        selectedTicket.id ? (
                          <Loader2
                            size={18}
                            className="animate-spin"
                          />
                        ) : (
                          <CheckCircle2
                            size={18}
                          />
                        )}

                        Confirm Resolved
                      </button>
                    </div>
                  )}
                </>
              )}

              {selectedTicket.status ===
                "Resolved" && (
                <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                  <div className="flex gap-3">
                    <CheckCircle2
                      size={22}
                      className="mt-0.5 shrink-0 text-green-700"
                    />

                    <div>
                      <p className="font-semibold text-green-900">
                        Ticket resolved
                      </p>

                      <p className="mt-1 text-sm text-green-800">
                        The requester confirmed
                        that the problem was
                        resolved.
                      </p>

                      {selectedTicket
                        .confirmedAt && (
                        <p className="mt-2 text-xs text-green-700">
                          Confirmed{" "}
                          {formatDate(
                            selectedTicket
                              .confirmedAt
                          )}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailItem({
  label,
  value,
  preserveWhitespace = false,
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-700">
        {label}
      </p>

      <p
        className={`mt-1 text-slate-900 ${
          preserveWhitespace
            ? "whitespace-pre-wrap"
            : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}