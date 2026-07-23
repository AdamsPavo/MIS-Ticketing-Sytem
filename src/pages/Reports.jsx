import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Download,
  FileBarChart,
  Loader2,
  Printer,
  RefreshCw,
  TicketCheck,
  Tickets,
  Users,
} from "lucide-react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { db } from "../firebase/firebase";

const STATUS_ORDER = [
  "Pending",
  "Assigned",
  "In Progress",
  "Resolved",
  "Closed",
];

const STATUS_COLORS = {
  Pending: "#f97316",
  Assigned: "#06b6d4",
  "In Progress": "#8b5cf6",
  Resolved: "#10b981",
  Closed: "#64748b",
};

const PRIORITY_COLORS = {
  Low: "#22c55e",
  Medium: "#3b82f6",
  High: "#f97316",
  Urgent: "#ef4444",
  "Not Set": "#94a3b8",
};

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeStatus(value) {
  const status = normalizeText(value).toLowerCase();

  if (status === "new") return "Pending";
  if (status === "pending") return "Pending";
  if (status === "assigned") return "Assigned";
  if (status === "in progress") return "In Progress";
  if (status === "resolved") return "Resolved";
  if (status === "closed") return "Closed";

  return normalizeText(value) || "Pending";
}

function normalizePriority(value) {
  const priority = normalizeText(value).toLowerCase();

  if (priority === "low") return "Low";
  if (priority === "medium") return "Medium";
  if (priority === "high") return "High";
  if (priority === "urgent") return "Urgent";

  return normalizeText(value) || "Not Set";
}

function getDateValue(value) {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  if (typeof value === "object" && value.seconds) {
    return new Date(value.seconds * 1000);
  }

  const parsedDate = new Date(value);

  return Number.isNaN(parsedDate.getTime())
    ? null
    : parsedDate;
}

function formatDate(value, includeTime = false) {
  const date = getDateValue(value);

  if (!date) return "No date";

  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(includeTime
      ? {
          hour: "numeric",
          minute: "2-digit",
        }
      : {}),
  }).format(date);
}

function formatDuration(hours) {
  if (!Number.isFinite(hours) || hours <= 0) {
    return "No data";
  }

  if (hours < 1) {
    return `${Math.round(hours * 60)} mins`;
  }

  if (hours < 24) {
    return `${hours.toFixed(1)} hrs`;
  }

  return `${(hours / 24).toFixed(1)} days`;
}

function getTicketTitle(ticket) {
  return (
    ticket.subject ||
    ticket.title ||
    ticket.concern ||
    ticket.issue ||
    ticket.description ||
    "Untitled ticket"
  );
}

function getTicketNumber(ticket) {
  return (
    ticket.ticketNumber ||
    ticket.ticket_number ||
    ticket.referenceNumber ||
    ticket.referenceNo ||
    ticket.id
  );
}

function getDepartment(ticket) {
  return (
    ticket.department ||
    ticket.requesterDepartment ||
    ticket.createdByDepartment ||
    "Unspecified"
  );
}

function getCategory(ticket) {
  return (
    ticket.category ||
    ticket.concernType ||
    ticket.issueCategory ||
    ticket.type ||
    "Other"
  );
}

function getPriority(ticket) {
  return normalizePriority(
    ticket.priority || ticket.urgency
  );
}

function getAssignedStaff(ticket) {
  return (
    ticket.assignedToName ||
    ticket.assignedStaffName ||
    ticket.assignedToEmail ||
    ticket.assigneeName ||
    ticket.assignedTo ||
    "Unassigned"
  );
}

function getCreatedDate(ticket) {
  return getDateValue(
    ticket.createdAt ||
      ticket.submittedAt ||
      ticket.dateCreated ||
      ticket.createdDate
  );
}

function getResolvedDate(ticket) {
  return getDateValue(
    ticket.resolvedAt ||
      ticket.closedAt ||
      ticket.completedAt ||
      ticket.dateResolved
  );
}

export default function Reports() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [dateRange, setDateRange] = useState("30");
  const [departmentFilter, setDepartmentFilter] =
    useState("all");
  const [statusFilter, setStatusFilter] =
    useState("all");
  const [categoryFilter, setCategoryFilter] =
    useState("all");
  const [priorityFilter, setPriorityFilter] =
    useState("all");
  const [staffFilter, setStaffFilter] =
    useState("all");

  useEffect(() => {
    const ticketsQuery = query(
      collection(db, "tickets"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      ticketsQuery,
      (snapshot) => {
        const data = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        }));

        setTickets(data);
        setLoading(false);
        setLoadError("");
      },
      (error) => {
        console.error("Unable to load report data:", error);

        setLoading(false);
        setLoadError(
          error.message ||
            "Unable to load ticket reports."
        );
      }
    );

    return () => unsubscribe();
  }, []);

  const departments = useMemo(() => {
    return [
      ...new Set(tickets.map(getDepartment)),
    ]
      .filter(Boolean)
      .sort();
  }, [tickets]);

  const categories = useMemo(() => {
    return [
      ...new Set(tickets.map(getCategory)),
    ]
      .filter(Boolean)
      .sort();
  }, [tickets]);

  const staffMembers = useMemo(() => {
    return [
      ...new Set(tickets.map(getAssignedStaff)),
    ]
      .filter(
        (staff) => staff && staff !== "Unassigned"
      )
      .sort();
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    const selectedDays = Number(dateRange);
    const startDate = new Date();

    if (selectedDays > 0) {
      startDate.setHours(0, 0, 0, 0);
      startDate.setDate(
        startDate.getDate() - selectedDays
      );
    }

    return tickets.filter((ticket) => {
      const createdDate = getCreatedDate(ticket);
      const status = normalizeStatus(ticket.status);
      const department = getDepartment(ticket);
      const category = getCategory(ticket);
      const priority = getPriority(ticket);
      const staff = getAssignedStaff(ticket);

      const matchesDate =
        selectedDays === 0 ||
        !createdDate ||
        createdDate >= startDate;

      const matchesDepartment =
        departmentFilter === "all" ||
        department === departmentFilter;

      const matchesStatus =
        statusFilter === "all" ||
        status === statusFilter;

      const matchesCategory =
        categoryFilter === "all" ||
        category === categoryFilter;

      const matchesPriority =
        priorityFilter === "all" ||
        priority === priorityFilter;

      const matchesStaff =
        staffFilter === "all" ||
        staff === staffFilter;

      return (
        matchesDate &&
        matchesDepartment &&
        matchesStatus &&
        matchesCategory &&
        matchesPriority &&
        matchesStaff
      );
    });
  }, [
    tickets,
    dateRange,
    departmentFilter,
    statusFilter,
    categoryFilter,
    priorityFilter,
    staffFilter,
  ]);

  const analytics = useMemo(() => {
    const statusCounts = {
      Pending: 0,
      Assigned: 0,
      "In Progress": 0,
      Resolved: 0,
      Closed: 0,
    };

    const departmentCounts = {};
    const categoryCounts = {};
    const priorityCounts = {};
    const staffCounts = {};
    const dailyTrend = {};
    const departmentPerformance = {};

    let totalResolutionHours = 0;
    let ticketsWithResolutionTime = 0;

    filteredTickets.forEach((ticket) => {
      const status = normalizeStatus(ticket.status);
      const department = getDepartment(ticket);
      const category = getCategory(ticket);
      const priority = getPriority(ticket);
      const staff = getAssignedStaff(ticket);
      const createdDate = getCreatedDate(ticket);
      const resolvedDate = getResolvedDate(ticket);

      statusCounts[status] =
        (statusCounts[status] || 0) + 1;

      departmentCounts[department] =
        (departmentCounts[department] || 0) + 1;

      categoryCounts[category] =
        (categoryCounts[category] || 0) + 1;

      priorityCounts[priority] =
        (priorityCounts[priority] || 0) + 1;

      if (!departmentPerformance[department]) {
        departmentPerformance[department] = {
          total: 0,
          pending: 0,
          inProgress: 0,
          resolved: 0,
          closed: 0,
        };
      }

      departmentPerformance[department].total += 1;

      if (status === "Pending") {
        departmentPerformance[department].pending += 1;
      }

      if (
        status === "Assigned" ||
        status === "In Progress"
      ) {
        departmentPerformance[
          department
        ].inProgress += 1;
      }

      if (status === "Resolved") {
        departmentPerformance[
          department
        ].resolved += 1;
      }

      if (status === "Closed") {
        departmentPerformance[department].closed += 1;
      }

      if (staff !== "Unassigned") {
        if (!staffCounts[staff]) {
          staffCounts[staff] = {
            assigned: 0,
            pending: 0,
            inProgress: 0,
            resolved: 0,
            closed: 0,
          };
        }

        staffCounts[staff].assigned += 1;

        if (status === "Pending") {
          staffCounts[staff].pending += 1;
        }

        if (
          status === "Assigned" ||
          status === "In Progress"
        ) {
          staffCounts[staff].inProgress += 1;
        }

        if (status === "Resolved") {
          staffCounts[staff].resolved += 1;
        }

        if (status === "Closed") {
          staffCounts[staff].closed += 1;
        }
      }

      if (createdDate) {
        const trendKey =
          dateRange === "365" || dateRange === "0"
            ? new Intl.DateTimeFormat("en-PH", {
                month: "short",
                year: "2-digit",
              }).format(createdDate)
            : new Intl.DateTimeFormat("en-PH", {
                month: "short",
                day: "numeric",
              }).format(createdDate);

        if (!dailyTrend[trendKey]) {
          dailyTrend[trendKey] = {
            label: trendKey,
            date: createdDate,
            tickets: 0,
            resolved: 0,
          };
        }

        dailyTrend[trendKey].tickets += 1;

        if (
          status === "Resolved" ||
          status === "Closed"
        ) {
          dailyTrend[trendKey].resolved += 1;
        }
      }

      if (
        createdDate &&
        resolvedDate &&
        (status === "Resolved" ||
          status === "Closed")
      ) {
        const durationHours =
          (resolvedDate.getTime() -
            createdDate.getTime()) /
          (1000 * 60 * 60);

        if (durationHours >= 0) {
          totalResolutionHours += durationHours;
          ticketsWithResolutionTime += 1;
        }
      }
    });

    const total = filteredTickets.length;
    const completed =
      statusCounts.Resolved + statusCounts.Closed;

    const averageResolutionHours =
      ticketsWithResolutionTime > 0
        ? totalResolutionHours /
          ticketsWithResolutionTime
        : 0;

    const statusData = STATUS_ORDER.map(
      (status) => ({
        name: status,
        value: statusCounts[status] || 0,
      })
    );

    const departmentData = Object.entries(
      departmentCounts
    )
      .map(([name, value]) => ({
        name,
        value,
      }))
      .sort((a, b) => b.value - a.value);

    const categoryData = Object.entries(
      categoryCounts
    )
      .map(([name, value]) => ({
        name,
        value,
      }))
      .sort((a, b) => b.value - a.value);

    const priorityData = Object.entries(
      priorityCounts
    )
      .map(([name, value]) => ({
        name,
        value,
      }))
      .sort((a, b) => b.value - a.value);

    const trendData = Object.values(dailyTrend)
      .sort(
        (a, b) =>
          a.date.getTime() - b.date.getTime()
      )
      .map(({ label, tickets: count, resolved }) => ({
        name: label,
        tickets: count,
        resolved,
      }));

    const staffData = Object.entries(staffCounts)
      .map(([name, values]) => {
        const completedTickets =
          values.resolved + values.closed;

        return {
          name,
          ...values,
          completed: completedTickets,
          resolutionRate:
            values.assigned > 0
              ? Math.round(
                  (completedTickets /
                    values.assigned) *
                    100
                )
              : 0,
        };
      })
      .sort(
        (a, b) => b.completed - a.completed
      );

    const departmentReportData = Object.entries(
      departmentPerformance
    )
      .map(([name, values]) => {
        const completedTickets =
          values.resolved + values.closed;

        return {
          name,
          ...values,
          completed: completedTickets,
          resolutionRate:
            values.total > 0
              ? Math.round(
                  (completedTickets /
                    values.total) *
                    100
                )
              : 0,
        };
      })
      .sort((a, b) => b.total - a.total);

    return {
      total,
      pending: statusCounts.Pending,
      assigned: statusCounts.Assigned,
      inProgress: statusCounts["In Progress"],
      resolved: statusCounts.Resolved,
      closed: statusCounts.Closed,
      completed,
      resolutionRate:
        total > 0
          ? Math.round((completed / total) * 100)
          : 0,
      averageResolutionHours,
      statusData,
      departmentData,
      categoryData,
      priorityData,
      trendData,
      staffData,
      departmentReportData,
    };
  }, [filteredTickets, dateRange]);

  const overdueTickets = useMemo(() => {
    const now = new Date();

    return filteredTickets
      .filter((ticket) => {
        const status = normalizeStatus(ticket.status);

        if (
          status === "Resolved" ||
          status === "Closed"
        ) {
          return false;
        }

        const createdDate = getCreatedDate(ticket);

        if (!createdDate) return false;

        const ageInHours =
          (now.getTime() - createdDate.getTime()) /
          (1000 * 60 * 60);

        return ageInHours >= 72;
      })
      .map((ticket) => {
        const createdDate = getCreatedDate(ticket);

        return {
          ...ticket,
          ageInDays: createdDate
            ? Math.floor(
                (now.getTime() -
                  createdDate.getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            : 0,
        };
      })
      .sort(
        (a, b) => b.ageInDays - a.ageInDays
      );
  }, [filteredTickets]);

  const recentlyCompleted = useMemo(() => {
    return filteredTickets
      .filter((ticket) => {
        const status = normalizeStatus(ticket.status);

        return (
          status === "Resolved" ||
          status === "Closed"
        );
      })
      .sort((a, b) => {
        const firstDate =
          getResolvedDate(a)?.getTime() || 0;
        const secondDate =
          getResolvedDate(b)?.getTime() || 0;

        return secondDate - firstDate;
      })
      .slice(0, 8);
  }, [filteredTickets]);

  const resetFilters = () => {
    setDateRange("30");
    setDepartmentFilter("all");
    setStatusFilter("all");
    setCategoryFilter("all");
    setPriorityFilter("all");
    setStaffFilter("all");
  };

  const exportToCsv = () => {
    if (filteredTickets.length === 0) {
      return;
    }

    const rows = filteredTickets.map((ticket) => ({
      "Ticket Number": getTicketNumber(ticket),
      Subject: getTicketTitle(ticket),
      Department: getDepartment(ticket),
      Category: getCategory(ticket),
      Priority: getPriority(ticket),
      Status: normalizeStatus(ticket.status),
      "Assigned Staff": getAssignedStaff(ticket),
      "Created Date": formatDate(
        getCreatedDate(ticket),
        true
      ),
      "Resolved Date": formatDate(
        getResolvedDate(ticket),
        true
      ),
    }));

    const headers = Object.keys(rows[0]);

    const csvContent = [
      headers
        .map((header) => `"${header}"`)
        .join(","),
      ...rows.map((row) =>
        headers
          .map((header) => {
            const value = String(
              row[header] ?? ""
            ).replace(/"/g, '""');

            return `"${value}"`;
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const fileUrl = URL.createObjectURL(blob);
    const downloadLink =
      document.createElement("a");

    downloadLink.href = fileUrl;
    downloadLink.download = `MIS-Ticket-Report-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    URL.revokeObjectURL(fileUrl);
  };

  const summaryCards = [
    {
      title: "Total Tickets",
      value: analytics.total,
      description: "Tickets matching your filters",
      icon: Tickets,
      iconClass: "bg-blue-50 text-blue-600",
    },
    {
      title: "Pending",
      value: analytics.pending,
      description: "Waiting for MIS action",
      icon: AlertTriangle,
      iconClass: "bg-orange-50 text-orange-600",
    },
    {
      title: "In Progress",
      value: analytics.inProgress,
      description: "Currently being handled",
      icon: Clock3,
      iconClass: "bg-violet-50 text-violet-600",
    },
    {
      title: "Completed",
      value: analytics.completed,
      description: `${analytics.resolutionRate}% resolution rate`,
      icon: CheckCircle2,
      iconClass:
        "bg-emerald-50 text-emerald-600",
    },
    {
      title: "Average Resolution",
      value: formatDuration(
        analytics.averageResolutionHours
      ),
      description: "Average completion time",
      icon: TicketCheck,
      iconClass: "bg-cyan-50 text-cyan-600",
    },
    {
      title: "Overdue",
      value: overdueTickets.length,
      description: "Open for at least 3 days",
      icon: AlertTriangle,
      iconClass: "bg-red-50 text-red-600",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl print:max-w-none">
      {/* Header */}
      <section className="mb-7 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.15em] text-blue-600">
            MIS reports and analytics
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Reports
          </h1>

          <p className="mt-2 max-w-2xl text-slate-500">
            Monitor ticket volume, status distribution,
            department concerns, priorities, and IT staff
            performance.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 print:hidden">
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw size={17} />
            Reset filters
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <Printer size={17} />
            Print
          </button>

          <button
            type="button"
            onClick={exportToCsv}
            disabled={filteredTickets.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            <Download size={17} />
            Export CSV
          </button>
        </div>
      </section>

      {/* Filters */}
      <section className="mb-7 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 xl:grid-cols-3 print:hidden">
        <FilterSelect
          label="Date range"
          value={dateRange}
          onChange={setDateRange}
          options={[
            {
              value: "7",
              label: "Last 7 days",
            },
            {
              value: "30",
              label: "Last 30 days",
            },
            {
              value: "90",
              label: "Last 90 days",
            },
            {
              value: "365",
              label: "Last 12 months",
            },
            {
              value: "0",
              label: "All time",
            },
          ]}
        />

        <FilterSelect
          label="Department"
          value={departmentFilter}
          onChange={setDepartmentFilter}
          options={[
            {
              value: "all",
              label: "All departments",
            },
            ...departments.map((department) => ({
              value: department,
              label: department,
            })),
          ]}
        />

        <FilterSelect
          label="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            {
              value: "all",
              label: "All statuses",
            },
            ...STATUS_ORDER.map((status) => ({
              value: status,
              label: status,
            })),
          ]}
        />

        <FilterSelect
          label="Category"
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={[
            {
              value: "all",
              label: "All categories",
            },
            ...categories.map((category) => ({
              value: category,
              label: category,
            })),
          ]}
        />

        <FilterSelect
          label="Priority"
          value={priorityFilter}
          onChange={setPriorityFilter}
          options={[
            {
              value: "all",
              label: "All priorities",
            },
            {
              value: "Low",
              label: "Low",
            },
            {
              value: "Medium",
              label: "Medium",
            },
            {
              value: "High",
              label: "High",
            },
            {
              value: "Urgent",
              label: "Urgent",
            },
            {
              value: "Not Set",
              label: "Not Set",
            },
          ]}
        />

        <FilterSelect
          label="Assigned IT staff"
          value={staffFilter}
          onChange={setStaffFilter}
          options={[
            {
              value: "all",
              label: "All IT staff",
            },
            ...staffMembers.map((staff) => ({
              value: staff,
              label: staff,
            })),
          ]}
        />
      </section>

      {loadError && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-96 flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white">
          <Loader2
            size={38}
            className="animate-spin text-blue-600"
          />

          <p className="mt-3 text-sm text-slate-500">
            Loading report analytics...
          </p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {summaryCards.map((card) => {
              const Icon = card.icon;

              return (
                <article
                  key={card.title}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div
                      className={`rounded-xl p-3 ${card.iconClass}`}
                    >
                      <Icon size={22} />
                    </div>

                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 print:hidden">
                      Live
                    </span>
                  </div>

                  <p className="mt-5 text-3xl font-bold text-slate-900">
                    {card.value}
                  </p>

                  <h2 className="mt-1 font-semibold text-slate-800">
                    {card.title}
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {card.description}
                  </p>
                </article>
              );
            })}
          </section>

          {/* Ticket trend and status */}
          <section className="mt-7 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <ChartCard
              title="Ticket trend"
              description="Submitted and completed tickets during the selected period"
            >
              {analytics.trendData.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer
                  width="100%"
                  height={320}
                >
                  <LineChart
                    data={analytics.trendData}
                    margin={{
                      top: 10,
                      right: 20,
                      left: -20,
                      bottom: 0,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                    />

                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                    />

                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                    />

                    <Tooltip />

                    <Line
                      type="monotone"
                      dataKey="tickets"
                      name="Submitted"
                      stroke="#2563eb"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />

                    <Line
                      type="monotone"
                      dataKey="resolved"
                      name="Completed"
                      stroke="#10b981"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard
              title="Status distribution"
              description="Current ticket status breakdown"
            >
              {analytics.total === 0 ? (
                <EmptyChart />
              ) : (
                <>
                  <ResponsiveContainer
                    width="100%"
                    height={220}
                  >
                    <PieChart>
                      <Pie
                        data={analytics.statusData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={55}
                        outerRadius={88}
                        paddingAngle={3}
                      >
                        {analytics.statusData.map(
                          (entry) => (
                            <Cell
                              key={entry.name}
                              fill={
                                STATUS_COLORS[
                                  entry.name
                                ]
                              }
                            />
                          )
                        )}
                      </Pie>

                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="space-y-2">
                    {analytics.statusData.map(
                      (entry) => (
                        <div
                          key={entry.name}
                          className="flex items-center justify-between gap-6 text-sm"
                        >
                          <span className="flex items-center gap-2 text-slate-600">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{
                                backgroundColor:
                                  STATUS_COLORS[
                                    entry.name
                                  ],
                              }}
                            />

                            {entry.name}
                          </span>

                          <span className="font-semibold text-slate-900">
                            {entry.value}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </>
              )}
            </ChartCard>
          </section>

          {/* Department and category */}
          <section className="mt-6 grid gap-6 xl:grid-cols-2">
            <ChartCard
              title="Tickets by department"
              description="Departments with the most submitted concerns"
            >
              {analytics.departmentData.length ===
              0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer
                  width="100%"
                  height={340}
                >
                  <BarChart
                    data={analytics.departmentData.slice(
                      0,
                      10
                    )}
                    layout="vertical"
                    margin={{
                      top: 5,
                      right: 20,
                      left: 40,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={false}
                    />

                    <XAxis
                      type="number"
                      allowDecimals={false}
                    />

                    <YAxis
                      type="category"
                      dataKey="name"
                      width={110}
                      tick={{ fontSize: 11 }}
                    />

                    <Tooltip />

                    <Bar
                      dataKey="value"
                      name="Tickets"
                      fill="#2563eb"
                      radius={[0, 6, 6, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard
              title="Tickets by category"
              description="Most frequently reported issue categories"
            >
              {analytics.categoryData.length === 0 ? (
                <EmptyChart />
              ) : (
                <ResponsiveContainer
                  width="100%"
                  height={340}
                >
                  <BarChart
                    data={analytics.categoryData.slice(
                      0,
                      10
                    )}
                    margin={{
                      top: 5,
                      right: 10,
                      left: -15,
                      bottom: 65,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                    />

                    <XAxis
                      dataKey="name"
                      angle={-30}
                      textAnchor="end"
                      interval={0}
                      tick={{ fontSize: 11 }}
                    />

                    <YAxis allowDecimals={false} />

                    <Tooltip />

                    <Bar
                      dataKey="value"
                      name="Tickets"
                      fill="#8b5cf6"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </section>

          {/* Priority and IT staff */}
          <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.5fr]">
            <ChartCard
              title="Priority distribution"
              description="Tickets grouped according to priority"
            >
              {analytics.priorityData.length === 0 ? (
                <EmptyChart />
              ) : (
                <>
                  <ResponsiveContainer
                    width="100%"
                    height={230}
                  >
                    <PieChart>
                      <Pie
                        data={analytics.priorityData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={50}
                        outerRadius={88}
                        paddingAngle={3}
                      >
                        {analytics.priorityData.map(
                          (entry) => (
                            <Cell
                              key={entry.name}
                              fill={
                                PRIORITY_COLORS[
                                  entry.name
                                ] || "#94a3b8"
                              }
                            />
                          )
                        )}
                      </Pie>

                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="space-y-2">
                    {analytics.priorityData.map(
                      (entry) => (
                        <div
                          key={entry.name}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="flex items-center gap-2 text-slate-600">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{
                                backgroundColor:
                                  PRIORITY_COLORS[
                                    entry.name
                                  ] || "#94a3b8",
                              }}
                            />

                            {entry.name}
                          </span>

                          <span className="font-semibold text-slate-900">
                            {entry.value}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </>
              )}
            </ChartCard>

            <TableCard
              title="IT staff performance"
              description="Assigned workload and completed tickets"
              icon={Users}
            >
              <table className="min-w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <TableHeader>IT Staff</TableHeader>
                    <TableHeader>Assigned</TableHeader>
                    <TableHeader>
                      In Progress
                    </TableHeader>
                    <TableHeader>Completed</TableHeader>
                    <TableHeader>
                      Resolution Rate
                    </TableHeader>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {analytics.staffData.length === 0 ? (
                    <EmptyTable
                      colSpan={5}
                      message="No IT staff performance data available."
                    />
                  ) : (
                    analytics.staffData.map((staff) => (
                      <tr
                        key={staff.name}
                        className="hover:bg-slate-50"
                      >
                        <TableCell>
                          <span className="font-semibold text-slate-800">
                            {staff.name}
                          </span>
                        </TableCell>

                        <TableCell>
                          {staff.assigned}
                        </TableCell>

                        <TableCell>
                          {staff.inProgress}
                        </TableCell>

                        <TableCell>
                          {staff.completed}
                        </TableCell>

                        <TableCell>
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            {staff.resolutionRate}%
                          </span>
                        </TableCell>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </TableCard>
          </section>

          {/* Department report */}
          <section className="mt-6">
            <TableCard
              title="Department report"
              description="Ticket activity and resolution rate for every department"
              icon={FileBarChart}
            >
              <table className="min-w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <TableHeader>
                      Department
                    </TableHeader>
                    <TableHeader>Total</TableHeader>
                    <TableHeader>Pending</TableHeader>
                    <TableHeader>
                      Active
                    </TableHeader>
                    <TableHeader>
                      Completed
                    </TableHeader>
                    <TableHeader>
                      Resolution Rate
                    </TableHeader>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {analytics.departmentReportData
                    .length === 0 ? (
                    <EmptyTable
                      colSpan={6}
                      message="No department report data available."
                    />
                  ) : (
                    analytics.departmentReportData.map(
                      (department) => (
                        <tr
                          key={department.name}
                          className="hover:bg-slate-50"
                        >
                          <TableCell>
                            <span className="font-semibold text-slate-800">
                              {department.name}
                            </span>
                          </TableCell>

                          <TableCell>
                            {department.total}
                          </TableCell>

                          <TableCell>
                            {department.pending}
                          </TableCell>

                          <TableCell>
                            {department.inProgress}
                          </TableCell>

                          <TableCell>
                            {department.completed}
                          </TableCell>

                          <TableCell>
                            <span className="font-semibold text-blue-600">
                              {
                                department.resolutionRate
                              }
                              %
                            </span>
                          </TableCell>
                        </tr>
                      )
                    )
                  )}
                </tbody>
              </table>
            </TableCard>
          </section>

          {/* Overdue and recent completed */}
          <section className="mt-6 grid gap-6 xl:grid-cols-2">
            <TableCard
              title="Overdue tickets"
              description="Open tickets that are at least three days old"
              icon={AlertTriangle}
              iconClass="bg-red-50 text-red-600"
            >
              <table className="min-w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <TableHeader>Ticket</TableHeader>
                    <TableHeader>
                      Department
                    </TableHeader>
                    <TableHeader>Status</TableHeader>
                    <TableHeader>Age</TableHeader>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {overdueTickets.length === 0 ? (
                    <EmptyTable
                      colSpan={4}
                      message="No overdue tickets."
                    />
                  ) : (
                    overdueTickets
                      .slice(0, 8)
                      .map((ticket) => (
                        <tr
                          key={ticket.id}
                          className="hover:bg-slate-50"
                        >
                          <TableCell>
                            <p className="max-w-56 truncate font-semibold text-slate-800">
                              {getTicketTitle(ticket)}
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              #{getTicketNumber(ticket)}
                            </p>
                          </TableCell>

                          <TableCell>
                            {getDepartment(ticket)}
                          </TableCell>

                          <TableCell>
                            <StatusBadge
                              status={normalizeStatus(
                                ticket.status
                              )}
                            />
                          </TableCell>

                          <TableCell>
                            <span className="font-semibold text-red-600">
                              {ticket.ageInDays} days
                            </span>
                          </TableCell>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </TableCard>

            <TableCard
              title="Recently completed tickets"
              description="Latest tickets marked as resolved or closed"
              icon={CheckCircle2}
              iconClass="bg-emerald-50 text-emerald-600"
            >
              <table className="min-w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <TableHeader>Ticket</TableHeader>
                    <TableHeader>
                      Assigned Staff
                    </TableHeader>
                    <TableHeader>Status</TableHeader>
                    <TableHeader>
                      Completed
                    </TableHeader>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {recentlyCompleted.length === 0 ? (
                    <EmptyTable
                      colSpan={4}
                      message="No completed tickets available."
                    />
                  ) : (
                    recentlyCompleted.map((ticket) => (
                      <tr
                        key={ticket.id}
                        className="hover:bg-slate-50"
                      >
                        <TableCell>
                          <p className="max-w-56 truncate font-semibold text-slate-800">
                            {getTicketTitle(ticket)}
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            #{getTicketNumber(ticket)}
                          </p>
                        </TableCell>

                        <TableCell>
                          {getAssignedStaff(ticket)}
                        </TableCell>

                        <TableCell>
                          <StatusBadge
                            status={normalizeStatus(
                              ticket.status
                            )}
                          />
                        </TableCell>

                        <TableCell>
                          {formatDate(
                            getResolvedDate(ticket)
                          )}
                        </TableCell>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </TableCard>
          </section>
        </>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm print:break-inside-avoid">
      <div className="mb-6 flex items-start gap-3">
        <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
          <BarChart3 size={20} />
        </div>

        <div>
          <h2 className="font-bold text-slate-900">
            {title}
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            {description}
          </p>
        </div>
      </div>

      {children}
    </article>
  );
}

function TableCard({
  title,
  description,
  icon: Icon,
  iconClass = "bg-blue-50 text-blue-600",
  children,
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm print:break-inside-avoid">
      <div className="border-b border-slate-100 px-6 py-5">
        <div className="flex items-center gap-3">
          <div
            className={`rounded-xl p-2.5 ${iconClass}`}
          >
            <Icon size={20} />
          </div>

          <div>
            <h2 className="font-bold text-slate-900">
              {title}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {description}
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        {children}
      </div>
    </article>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-72 flex-col items-center justify-center text-center">
      <div className="rounded-2xl bg-slate-100 p-4 text-slate-400">
        <BarChart3 size={34} />
      </div>

      <p className="mt-4 font-semibold text-slate-700">
        No analytics data
      </p>

      <p className="mt-1 text-sm text-slate-500">
        Ticket information matching the selected filters
        will appear here.
      </p>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    Pending:
      "bg-orange-50 text-orange-700 ring-orange-600/20",
    Assigned:
      "bg-cyan-50 text-cyan-700 ring-cyan-600/20",
    "In Progress":
      "bg-violet-50 text-violet-700 ring-violet-600/20",
    Resolved:
      "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    Closed:
      "bg-slate-100 text-slate-700 ring-slate-600/20",
  };

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
        styles[status] ||
        "bg-blue-50 text-blue-700 ring-blue-600/20"
      }`}
    >
      {status}
    </span>
  );
}

function TableHeader({ children }) {
  return (
    <th className="whitespace-nowrap px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}

function TableCell({ children }) {
  return (
    <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-600">
      {children}
    </td>
  );
}

function EmptyTable({ colSpan, message }) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-6 py-12 text-center text-sm text-slate-500"
      >
        {message}
      </td>
    </tr>
  );
}