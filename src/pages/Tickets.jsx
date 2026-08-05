import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Eye,
  Loader2,
  Search,
  Ticket,
  UserCheck,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  increment,
  runTransaction,
  deleteDoc,
  getDocs,
  writeBatch,
} from "firebase/firestore";

import { db } from "../firebase/firebase";
import { useAuth } from "../context/AuthContext";

const statusOptions = [
  "Pending",
  "Assigned",
  "In Progress",
  "Resolved",
  "Closed",
];

const priorityOptions = [
  "Low",
  "Medium",
  "High",
  "Critical",
];

const statusStyles = {
  Pending: "border-amber-200 bg-amber-50 text-amber-700",
  Assigned: "border-blue-200 bg-blue-50 text-blue-700",
  "In Progress":
    "border-violet-200 bg-violet-50 text-violet-700",
  Resolved:
    "border-emerald-200 bg-emerald-50 text-emerald-700",
  Closed: "border-slate-200 bg-slate-100 text-slate-700",
};

const priorityStyles = {
  Low: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Medium: "border-amber-200 bg-amber-50 text-amber-700",
  High: "border-orange-200 bg-orange-50 text-orange-700",
  Critical: "border-red-200 bg-red-50 text-red-700",
};

const formatDate = (timestamp) => {
  if (!timestamp) {
    return "Saving...";
  }

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

export default function AllTickets() {
  const { currentUser, userProfile } = useAuth();

  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [configuredCategories, setConfiguredCategories] = useState([]);

  const [remarks, setRemarks] = useState("");
  const [releaseReason, setReleaseReason] = useState("");
  const [selectedStatus, setSelectedStatus] =
    useState("Pending");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState({
    type: "",
    text: "",
  });

  useEffect(() => {
    const categoriesQuery = query(
      collection(db, "concernCategories"),
      orderBy("name", "asc")
    );

    const unsubscribe = onSnapshot(
      categoriesQuery,
      (snapshot) => {
        const categoryList = snapshot.docs
          .map((categoryDoc) => ({
            id: categoryDoc.id,
            ...categoryDoc.data(),
          }))
          .filter((category) => category.isActive !== false)
          .map((category) => String(category.name || "").trim())
          .filter(Boolean);

        setConfiguredCategories(categoryList);
      },
      (error) => {
        console.error("Unable to load concern categories:", error);

        setMessage((currentMessage) =>
          currentMessage.text
            ? currentMessage
            : {
                type: "error",
                text:
                  error.message ||
                  "Unable to load concern categories from Firestore.",
              }
        );
      }
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const ticketsQuery = query(
      collection(db, "tickets"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      ticketsQuery,
      (snapshot) => {
        const ticketList = snapshot.docs.map((ticketDoc) => ({
          id: ticketDoc.id,
          ...ticketDoc.data(),
        }));

        setTickets(ticketList);
        setLoading(false);

        setSelectedTicket((currentSelectedTicket) => {
          if (!currentSelectedTicket) {
            return null;
          }

          const updatedTicket = ticketList.find(
            (ticket) => ticket.id === currentSelectedTicket.id
          );

          return updatedTicket || null;
        });
      },
      (error) => {
        console.error("Unable to load tickets:", error);

        setMessage({
          type: "error",
          text:
            error.message ||
            "Unable to load tickets from Firestore.",
        });

        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!selectedTicket) {
      return;
    }

    setRemarks(selectedTicket.remarks || "");
    setReleaseReason("");
    setSelectedStatus(selectedTicket.status || "Pending");
  }, [selectedTicket]);

  const categoryOptions = useMemo(() => {
    const ticketCategories = tickets
      .map((ticketItem) => String(ticketItem.category || "").trim())
      .filter(Boolean);

    return [...new Set([...configuredCategories, ...ticketCategories])].sort(
      (firstCategory, secondCategory) =>
        firstCategory.localeCompare(secondCategory)
    );
  }, [configuredCategories, tickets]);

  useEffect(() => {
    if (
      categoryFilter !== "All" &&
      !categoryOptions.includes(categoryFilter)
    ) {
      setCategoryFilter("All");
    }
  }, [categoryFilter, categoryOptions]);

  const filteredTickets = useMemo(() => {
    const searchValue = search.toLowerCase().trim();

    return tickets.filter((ticketItem) => {
      const matchesSearch =
        !searchValue ||
        ticketItem.ticketNumber
          ?.toLowerCase()
          .includes(searchValue) ||
        ticketItem.staffName
          ?.toLowerCase()
          .includes(searchValue) ||
        ticketItem.department
          ?.toLowerCase()
          .includes(searchValue) ||
        ticketItem.subject
          ?.toLowerCase()
          .includes(searchValue) ||
        ticketItem.category
          ?.toLowerCase()
          .includes(searchValue);

      const matchesStatus =
        statusFilter === "All" ||
        ticketItem.status === statusFilter;

      const matchesPriority =
        priorityFilter === "All" ||
        ticketItem.priority === priorityFilter;

      const matchesCategory =
        categoryFilter === "All" ||
        ticketItem.category === categoryFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority &&
        matchesCategory
      );
    });
  }, [
    tickets,
    search,
    statusFilter,
    priorityFilter,
    categoryFilter,
  ]);

  const ticketCounts = useMemo(() => {
    return {
      total: tickets.length,
      pending: tickets.filter(
        (ticketItem) => ticketItem.status === "Pending"
      ).length,
      inProgress: tickets.filter(
        (ticketItem) =>
          ticketItem.status === "In Progress"
      ).length,
      resolved: tickets.filter(
        (ticketItem) => ticketItem.status === "Resolved"
      ).length,
    };
  }, [tickets]);

  const openTicket = (ticketItem) => {
    setSelectedTicket(ticketItem);
    setSelectedStatus(ticketItem.status || "Pending");
    setRemarks(ticketItem.remarks || "");
    setReleaseReason("");

    setMessage({
      type: "",
      text: "",
    });
  };

  const closeTicket = () => {
    if (saving) {
      return;
    }

    setSelectedTicket(null);
    setRemarks("");
    setReleaseReason("");
    setSelectedStatus("Pending");
  };

  const assignTicketToMe = async () => {
    if (!selectedTicket || !currentUser) {
      return;
    }

    if (
      userProfile?.role !== "IT_STAFF" &&
      userProfile?.role !== "admin"
    ) {
      setMessage({
        type: "error",
        text: "Only IT Staff or an administrator can accept tickets.",
      });
      return;
    }

    const staffName =
      userProfile?.fullName ||
      currentUser.displayName ||
      currentUser.email ||
      "IT Staff";

    setSaving(true);
    setMessage({
      type: "",
      text: "",
    });

    try {
      const ticketReference = doc(
        db,
        "tickets",
        selectedTicket.id
      );

      await runTransaction(db, async (transaction) => {
        const latestTicketSnapshot =
          await transaction.get(ticketReference);

        if (!latestTicketSnapshot.exists()) {
          throw new Error("This ticket no longer exists.");
        }

        const latestTicket = latestTicketSnapshot.data();

        if (latestTicket.assignedTo) {
          throw new Error(
            `This ticket is already assigned to ${
              latestTicket.assignedToName || "another IT Staff member"
            }.`
          );
        }

        transaction.update(ticketReference, {
          assignedTo: currentUser.uid,
          assignedToName: staffName,
          status: "Assigned",
          assignedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      setSelectedStatus("Assigned");

      setMessage({
        type: "success",
        text: "The ticket has been assigned to you.",
      });
    } catch (error) {
      console.error("Unable to assign ticket:", error);

      setMessage({
        type: "error",
        text:
          error.message ||
          "Unable to assign the ticket.",
      });
    } finally {
      setSaving(false);
    }
  };

  const releaseTicket = async () => {
    if (!selectedTicket || !currentUser) {
      return;
    }

    const isAdministrator = userProfile?.role === "admin";
    const isAssignedStaff =
      selectedTicket.assignedTo === currentUser.uid;

    if (!isAdministrator && !isAssignedStaff) {
      setMessage({
        type: "error",
        text:
          "Only the assigned IT Staff member or an administrator can release this ticket.",
      });
      return;
    }

    if (
      selectedTicket.status === "Resolved" ||
      selectedTicket.status === "Closed"
    ) {
      setMessage({
        type: "error",
        text: "Resolved or closed tickets cannot be released.",
      });
      return;
    }

    const reason = releaseReason.trim();

    if (!reason) {
      setMessage({
        type: "error",
        text:
          "Please explain why this ticket cannot be handled before releasing it.",
      });
      return;
    }

    const releasedByName =
      userProfile?.fullName ||
      currentUser.displayName ||
      currentUser.email ||
      "IT Staff";

    setSaving(true);
    setMessage({
      type: "",
      text: "",
    });

    try {
      await updateDoc(
        doc(db, "tickets", selectedTicket.id),
        {
          status: "Pending",
          assignedTo: "",
          assignedToName: "",
          assignedAt: null,
          lastReleasedBy: currentUser.uid,
          lastReleasedByName: releasedByName,
          lastReleaseReason: reason,
          lastReleasedAt: serverTimestamp(),
          reassignmentCount: increment(1),
          updatedAt: serverTimestamp(),
        }
      );

      setSelectedStatus("Pending");
      setReleaseReason("");

      setMessage({
        type: "success",
        text:
          "The ticket was returned to the pending queue. Another IT Staff member can now accept it.",
      });
    } catch (error) {
      console.error("Unable to release ticket:", error);

      setMessage({
        type: "error",
        text:
          error.message ||
          "Unable to release the ticket.",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveTicketChanges = async () => {
    if (!selectedTicket) {
      return;
    }

    const isAdministrator = userProfile?.role === "admin";
    const isAssignedStaff =
      selectedTicket.assignedTo === currentUser?.uid;

    if (!isAdministrator && !isAssignedStaff) {
      setMessage({
        type: "error",
        text:
          "You must be assigned to this ticket before you can update its status or remarks.",
      });
      return;
    }

    if (
      selectedStatus === "In Progress" &&
      !selectedTicket.assignedTo
    ) {
      setMessage({
        type: "error",
        text: "Assign the ticket to an IT Staff member before marking it as In Progress.",
      });

      return;
    }

    setSaving(true);
    setMessage({
      type: "",
      text: "",
    });

    try {
      const updateData = {
        status: selectedStatus,
        remarks: remarks.trim(),
        updatedAt: serverTimestamp(),
      };

      if (selectedStatus === "Resolved") {
        updateData.resolvedAt = serverTimestamp();
        updateData.resolvedBy = currentUser?.uid || "";
        updateData.resolvedByName =
          userProfile?.fullName ||
          currentUser?.email ||
          "MIS Staff";
      }

      if (selectedStatus === "Closed") {
        updateData.closedAt = serverTimestamp();
        updateData.closedBy = currentUser?.uid || "";
        updateData.closedByName =
          userProfile?.fullName ||
          currentUser?.email ||
          "MIS Staff";
      }

      await updateDoc(
        doc(db, "tickets", selectedTicket.id),
        updateData
      );

      setMessage({
        type: "success",
        text: "Ticket changes saved successfully.",
      });
    } catch (error) {
      console.error("Unable to update ticket:", error);

      setMessage({
        type: "error",
        text:
          error.message ||
          "Unable to save ticket changes.",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteSelectedTicket = async () => {
    if (userProfile?.role !== "admin") {
      setMessage({
        type: "error",
        text: "Only the administrator can delete tickets.",
      });
      return;
    }

    if (!selectedTicket) {
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete ${
        selectedTicket.ticketNumber || "this ticket"
      }? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setMessage({ type: "", text: "" });

    try {
      await deleteDoc(doc(db, "tickets", selectedTicket.id));

      setSelectedTicket(null);
      setRemarks("");
      setReleaseReason("");
      setSelectedStatus("Pending");

      setMessage({
        type: "success",
        text: "Ticket deleted successfully.",
      });
    } catch (error) {
      console.error("Unable to delete ticket:", error);

      setMessage({
        type: "error",
        text: error.message || "Unable to delete the ticket.",
      });
    } finally {
      setSaving(false);
    }
  };

  const deleteAllTickets = async () => {
    if (userProfile?.role !== "admin") {
      setMessage({
        type: "error",
        text: "Only the administrator can delete all tickets.",
      });
      return;
    }

    if (tickets.length === 0) {
      setMessage({
        type: "error",
        text: "There are no tickets to delete.",
      });
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete all ${tickets.length} tickets? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    const finalConfirmation = window.confirm(
      "Final confirmation: Delete every ticket now?"
    );

    if (!finalConfirmation) {
      return;
    }

    setSaving(true);
    setMessage({ type: "", text: "" });

    try {
      const snapshot = await getDocs(collection(db, "tickets"));
      const documents = snapshot.docs;
      const batchSize = 450;

      for (let index = 0; index < documents.length; index += batchSize) {
        const batch = writeBatch(db);
        const documentChunk = documents.slice(index, index + batchSize);

        documentChunk.forEach((ticketDocument) => {
          batch.delete(ticketDocument.ref);
        });

        await batch.commit();
      }

      setSelectedTicket(null);
      setRemarks("");
      setReleaseReason("");
      setSelectedStatus("Pending");

      setMessage({
        type: "success",
        text: "All tickets were deleted successfully.",
      });
    } catch (error) {
      console.error("Unable to delete all tickets:", error);

      setMessage({
        type: "error",
        text: error.message || "Unable to delete all tickets.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            All Tickets
          </h1>

          <p className="mt-2 text-slate-500">
            View, assign, and manage department concerns.
          </p>
        </div>

        {userProfile?.role === "admin" && (
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={deleteAllTickets}
              disabled={saving || tickets.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
            >
              {saving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Trash2 size={18} />
              )}
              Delete All Tickets
            </button>
          </div>
        )}
      </div>

      {message.text && !selectedTicket && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm font-medium ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total Tickets"
          value={ticketCounts.total}
          icon={Ticket}
          iconClass="bg-blue-50 text-blue-600"
        />

        <SummaryCard
          title="Pending"
          value={ticketCounts.pending}
          icon={Clock3}
          iconClass="bg-amber-50 text-amber-600"
        />

        <SummaryCard
          title="In Progress"
          value={ticketCounts.inProgress}
          icon={AlertCircle}
          iconClass="bg-violet-50 text-violet-600"
        />

        <SummaryCard
          title="Resolved"
          value={ticketCounts.resolved}
          icon={CheckCircle2}
          iconClass="bg-emerald-50 text-emerald-600"
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search ticket number, staff, department, or subject..."
                className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </div>

            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusOptions}
              defaultLabel="All Statuses"
            />

            <FilterSelect
              value={priorityFilter}
              onChange={setPriorityFilter}
              options={priorityOptions}
              defaultLabel="All Priorities"
            />

            <FilterSelect
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={categoryOptions}
              defaultLabel="All Categories"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center">
            <Loader2
              size={28}
              className="animate-spin text-blue-600"
            />

            <span className="ml-3 text-sm font-medium text-slate-500">
              Loading tickets...
            </span>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <div className="rounded-full bg-slate-100 p-4 text-slate-400">
              <Ticket size={30} />
            </div>

            <h2 className="mt-4 font-semibold text-slate-800">
              No tickets found
            </h2>

            <p className="mt-1 max-w-md text-sm text-slate-500">
              No tickets match your current search and filters.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[1000px]">
                <thead className="bg-slate-50">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-4">
                      Ticket
                    </th>

                    <th className="px-5 py-4">
                      Staff / Department
                    </th>

                    <th className="px-5 py-4">
                      Category
                    </th>

                    <th className="px-5 py-4">
                      Priority
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

                    <th className="px-5 py-4 text-right">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {filteredTickets.map((ticketItem) => (
                    <tr
                      key={ticketItem.id}
                      className="transition hover:bg-slate-50"
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold text-blue-700">
                          {ticketItem.ticketNumber ||
                            "No ticket number"}
                        </p>

                        <p className="mt-1 max-w-xs truncate text-sm text-slate-600">
                          {ticketItem.subject}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-800">
                          {ticketItem.staffName || "Unknown staff"}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {ticketItem.department ||
                            "No department"}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-700">
                        {ticketItem.category || "—"}
                      </td>

                      <td className="px-5 py-4">
                        <Badge
                          text={ticketItem.priority || "Unknown"}
                          className={
                            priorityStyles[ticketItem.priority] ||
                            "border-slate-200 bg-slate-100 text-slate-600"
                          }
                        />
                      </td>

                      <td className="px-5 py-4">
                        <Badge
                          text={ticketItem.status || "Pending"}
                          className={
                            statusStyles[ticketItem.status] ||
                            statusStyles.Pending
                          }
                        />
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-600">
                        {ticketItem.assignedToName ||
                          "Unassigned"}
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-500">
                        {formatDate(ticketItem.createdAt)}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => openTicket(ticketItem)}
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

            <div className="divide-y divide-slate-200 lg:hidden">
              {filteredTickets.map((ticketItem) => (
                <button
                  type="button"
                  key={ticketItem.id}
                  onClick={() => openTicket(ticketItem)}
                  className="w-full p-5 text-left transition hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-blue-700">
                        {ticketItem.ticketNumber}
                      </p>

                      <p className="mt-1 font-medium text-slate-800">
                        {ticketItem.subject}
                      </p>
                    </div>

                    <Badge
                      text={ticketItem.priority}
                      className={
                        priorityStyles[ticketItem.priority] ||
                        "border-slate-200 bg-slate-100 text-slate-600"
                      }
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge
                      text={ticketItem.status || "Pending"}
                      className={
                        statusStyles[ticketItem.status] ||
                        statusStyles.Pending
                      }
                    />

                    <span className="text-sm text-slate-500">
                      {ticketItem.department}
                    </span>

                    <span className="text-sm text-slate-400">
                      •
                    </span>

                    <span className="text-sm text-slate-500">
                      {ticketItem.staffName}
                    </span>
                  </div>

                  <p className="mt-3 text-xs text-slate-400">
                    {formatDate(ticketItem.createdAt)}
                  </p>
                </button>
              ))}
            </div>

            <div className="border-t border-slate-200 px-5 py-4 text-sm text-slate-500">
              Showing {filteredTickets.length} of {tickets.length}{" "}
              tickets
            </div>
          </>
        )}
      </div>

      {selectedTicket && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeTicket();
            }
          }}
        >
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white p-5">
              <div>
                <p className="text-sm font-semibold text-blue-600">
                  {selectedTicket.ticketNumber}
                </p>

                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  {selectedTicket.subject}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeTicket}
                disabled={saving}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed"
              >
                <X size={22} />
              </button>
            </div>

            <div className="space-y-6 p-5 sm:p-6">
              {message.text && (
                <div
                  className={`rounded-xl border px-4 py-3 text-sm font-medium ${
                    message.type === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  {message.text}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <DetailItem
                  label="Name of Staff"
                  value={selectedTicket.staffName}
                />

                <DetailItem
                  label="Department"
                  value={selectedTicket.department}
                />

                <DetailItem
                  label="Category"
                  value={selectedTicket.category}
                />

                <DetailItem
                  label="Priority"
                  value={selectedTicket.priority}
                />

                <DetailItem
                  label="Created At"
                  value={formatDate(selectedTicket.createdAt)}
                />

                <DetailItem
                  label="Submitted Account"
                  value={
                    selectedTicket.requesterEmail ||
                    "Not available"
                  }
                />

                <DetailItem
                  label="Assigned IT Staff"
                  value={
                    selectedTicket.assignedToName ||
                    "Not yet assigned"
                  }
                />

                <DetailItem
                  label="Current Status"
                  value={selectedTicket.status || "Pending"}
                />

                {selectedTicket.lastReleaseReason && (
                  <DetailItem
                    label="Last Release Reason"
                    value={`${selectedTicket.lastReleaseReason}${
                      selectedTicket.lastReleasedByName
                        ? ` — ${selectedTicket.lastReleasedByName}`
                        : ""
                    }`}
                  />
                )}
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Description
                </p>

                <div className="mt-2 whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">
                  {selectedTicket.description ||
                    "No description provided."}
                </div>
              </div>

              {!selectedTicket.assignedTo &&
                (userProfile?.role === "IT_STAFF" ||
                  userProfile?.role === "admin") && (
                  <button
                    type="button"
                    onClick={assignTicketToMe}
                    disabled={saving}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                  >
                    <UserCheck size={18} />
                    Assign Ticket to Me
                  </button>
                )}

              {selectedTicket.assignedTo &&
                selectedTicket.status !== "Resolved" &&
                selectedTicket.status !== "Closed" &&
                (userProfile?.role === "admin" ||
                  selectedTicket.assignedTo === currentUser?.uid) && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <label
                      htmlFor="releaseReason"
                      className="block text-sm font-semibold text-amber-900"
                    >
                      Cannot handle this ticket?
                    </label>

                    <p className="mt-1 text-sm text-amber-700">
                      Enter a reason and return it to the pending queue so
                      another IT Staff member can accept it.
                    </p>

                    <textarea
                      id="releaseReason"
                      rows={3}
                      value={releaseReason}
                      onChange={(event) =>
                        setReleaseReason(event.target.value)
                      }
                      disabled={saving}
                      maxLength={500}
                      placeholder="Example: This concern requires network administration access."
                      className="mt-3 w-full resize-y rounded-xl border border-amber-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100 disabled:bg-slate-100"
                    />

                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-xs text-amber-700">
                        {releaseReason.length}/500
                      </span>

                      <button
                        type="button"
                        onClick={releaseTicket}
                        disabled={saving || !releaseReason.trim()}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-300"
                      >
                        <RotateCcw size={17} />
                        Release to Pending Queue
                      </button>
                    </div>
                  </div>
                )}

              <div className="grid gap-5 border-t border-slate-200 pt-6">
                <div>
                  <label
                    htmlFor="ticketStatus"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Ticket Status
                  </label>

                  <select
                    id="ticketStatus"
                    value={selectedStatus}
                    onChange={(event) =>
                      setSelectedStatus(event.target.value)
                    }
                    disabled={
                      saving ||
                      (userProfile?.role !== "admin" &&
                        selectedTicket.assignedTo !== currentUser?.uid)
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="remarks"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    MIS Remarks
                  </label>

                  <textarea
                    id="remarks"
                    rows={5}
                    value={remarks}
                    onChange={(event) =>
                      setRemarks(event.target.value)
                    }
                    disabled={
                      saving ||
                      (userProfile?.role !== "admin" &&
                        selectedTicket.assignedTo !== currentUser?.uid)
                    }
                    maxLength={2000}
                    placeholder="Add findings, actions taken, recommendations, or resolution details..."
                    className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
                  />

                  <p className="mt-2 text-right text-xs text-slate-400">
                    {remarks.length}/2000
                  </p>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-slate-200 bg-white p-5 sm:flex-row sm:justify-end">
              {userProfile?.role === "admin" && (
                <button
                  type="button"
                  onClick={deleteSelectedTicket}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
                >
                  {saving ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Trash2 size={18} />
                  )}
                  Delete Ticket
                </button>
              )}

              <button
                type="button"
                onClick={closeTicket}
                disabled={saving}
                className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={saveTicketChanges}
                disabled={
                  saving ||
                  (userProfile?.role !== "admin" &&
                    selectedTicket.assignedTo !== currentUser?.uid)
                }
                className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {saving ? (
                  <>
                    <Loader2
                      size={18}
                      className="animate-spin"
                    />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
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

function FilterSelect({
  value,
  onChange,
  options,
  defaultLabel,
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-40 appearance-none rounded-xl border border-slate-300 bg-white py-3 pl-4 pr-10 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
      >
        <option value="All">{defaultLabel}</option>

        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>

      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
      />
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
