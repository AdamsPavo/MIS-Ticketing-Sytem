import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  ListChecks,
  LogOut,
  PlusCircle,
  TicketCheck,
  UserCog,
  X,
} from "lucide-react";

import {
  NavLink,
  useNavigate,
} from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export default function Sidebar({
  open,
  setOpen,
}) {
  const navigate = useNavigate();

  const {
    userProfile,
    logout,
  } = useAuth();

  const allMenuItems = [
    {
      label: "Dashboard",
      path: "/dashboard",
      icon: LayoutDashboard,
      roles: [
        "admin",
        "IT_STAFF",
      ],
    },
    {
      label: "Create Ticket",
      path: "/create-ticket",
      icon: PlusCircle,
      roles: [
        "admin",
        "IT_STAFF",
        "user",
        "QA",
      ],
    },
    {
      label: "All Tickets",
      path: "/all-tickets",
      icon: ListChecks,
      roles: [
        "admin",
        "IT_STAFF",
      ],
    },
    {
      label: "My Tickets",
      path: "/my-tickets",
      icon: TicketCheck,
      roles: [
        "admin",
        "IT_STAFF",
        "user",
        "QA",
      ],
    },
    {
      label: "Event Booking",
      path: "/events",
      icon: CalendarDays,
      roles: [
        "admin",
        "IT_STAFF",
        "user",
        "QA",
      ],
    },
    {
      label: "Reports",
      path: "/reports",
      icon: BarChart3,
      roles: ["admin"],
    },
    {
      label: "IT Work Board",
      path: "/it-work-board",
      icon: ClipboardList,
      roles: [
        "admin",
        "IT_STAFF",
        "user",
        "QA",
      ],
    },
    {
      label: "User Management",
      path: "/settings/users",
      icon: UserCog,
      roles: ["admin"],
    },
  ];

  const menuItems = allMenuItems.filter(
    (item) =>
      item.roles.includes(
        userProfile?.role
      )
  );

  const closeSidebar = () => {
    setOpen(false);
  };

  const handleLogout = async () => {
    try {
      closeSidebar();

      await logout();

      navigate("/login", {
        replace: true,
      });
    } catch (error) {
      console.error(
        "Logout error:",
        error
      );
    }
  };

  return (
    <aside
      className={`fixed left-0 top-0 z-50 flex h-screen w-72 flex-col bg-slate-950 text-white shadow-2xl transition-transform duration-300 ease-in-out ${
        open
          ? "translate-x-0"
          : "-translate-x-full"
      }`}
    >
      {/* Logo and close button */}
      <div className="flex h-[73px] shrink-0 items-center justify-between border-b border-white/10 px-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-600 p-2.5 shadow-lg shadow-blue-950/40">
            <TicketCheck size={24} />
          </div>

          <div>
            <p className="font-bold">
              MIS Helpdesk
            </p>

            <p className="text-xs text-slate-400">
              Ticketing System
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={closeSidebar}
          className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
          aria-label="Close sidebar"
        >
          <X size={22} />
        </button>
      </div>

      {/* User information */}
      <div className="shrink-0 border-b border-white/10 px-6 py-5">
        <p className="truncate font-semibold text-white">
          {userProfile?.fullName ||
            "System User"}
        </p>

        <p className="mt-1 text-sm capitalize text-slate-400">
          {userProfile?.role ===
          "IT_STAFF"
            ? "IT Staff"
            : userProfile?.role ||
              "User"}
        </p>

        {userProfile?.department && (
          <p className="mt-1 truncate text-xs text-slate-500">
            {userProfile.department}
          </p>
        )}
      </div>

      {/* Navigation menu */}
      <nav className="flex-1 space-y-2 overflow-y-auto px-4 py-5">
        {menuItems.map(
          ({
            label,
            path,
            icon: Icon,
          }) => (
            <NavLink
              key={path}
              to={path}
              onClick={closeSidebar}
              className={({
                isActive,
              }) =>
                `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  isActive
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-950/30"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <Icon
                size={20}
                className="shrink-0"
              />

              <span className="truncate">
                {label}
              </span>
            </NavLink>
          )
        )}
      </nav>

      {/* Logout button */}
      <div className="shrink-0 border-t border-white/10 p-4">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-slate-300 transition hover:bg-red-500/10 hover:text-red-300"
        >
          <LogOut
            size={20}
            className="shrink-0"
          />

          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}