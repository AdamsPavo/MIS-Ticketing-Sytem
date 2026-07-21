import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Plus,
  TicketCheck,
  Tickets,
  TriangleAlert,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ticketStats = [
  {
    title: "Total Tickets",
    value: "0",
    description: "All submitted concerns",
    icon: Tickets,
    iconClass: "bg-blue-50 text-blue-600",
  },
  {
    title: "New Tickets",
    value: "0",
    description: "Waiting for MIS review",
    icon: TriangleAlert,
    iconClass: "bg-orange-50 text-orange-600",
  },
  {
    title: "In Progress",
    value: "0",
    description: "Currently being handled",
    icon: Clock3,
    iconClass: "bg-violet-50 text-violet-600",
  },
  {
    title: "Resolved",
    value: "0",
    description: "Successfully completed",
    icon: CheckCircle2,
    iconClass: "bg-emerald-50 text-emerald-600",
  },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  return (
    <div className="mx-auto max-w-7xl">
      <section className="mb-7 flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.15em] text-blue-600">
            MIS support dashboard
          </p>

          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Welcome back
          </h2>

          <p className="mt-2 text-slate-500">
            Signed in as {currentUser?.email}
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/tickets/create")}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700"
        >
          <Plus size={19} />
          Create New Ticket
        </button>
      </section>

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

              <p className="mt-5 text-3xl font-bold text-slate-900">
                {stat.value}
              </p>

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
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
            <div>
              <h3 className="font-bold text-slate-900">
                Recent tickets
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Latest support concerns submitted by departments
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/tickets")}
              className="flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              View all
              <ArrowRight size={16} />
            </button>
          </div>

          <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
            <div className="rounded-2xl bg-blue-50 p-4 text-blue-600">
              <TicketCheck size={38} />
            </div>

            <h4 className="mt-5 text-lg font-bold text-slate-900">
              No tickets available
            </h4>

            <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
              New tickets submitted by departments will appear in
              this section.
            </p>

            <button
              type="button"
              onClick={() => navigate("/tickets/create")}
              className="mt-5 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Submit first ticket
            </button>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <h3 className="font-bold text-slate-900">
              Ticket overview
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Current ticket status distribution
            </p>
          </div>

          <div className="mt-7 space-y-5">
            <StatusProgress
              label="New"
              value={0}
              total={0}
            />

            <StatusProgress
              label="In Progress"
              value={0}
              total={0}
            />

            <StatusProgress
              label="Resolved"
              value={0}
              total={0}
            />

            <StatusProgress
              label="Closed"
              value={0}
              total={0}
            />
          </div>
        </article>
      </section>
    </div>
  );
}

function StatusProgress({ label, value, total }) {
  const percentage =
    total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">
          {label}
        </span>

        <span className="text-sm font-semibold text-slate-900">
          {value}
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-blue-600 transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}