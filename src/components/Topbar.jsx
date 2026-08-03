import { Menu, PanelLeftClose, Search } from "lucide-react";

import NotificationBell from "./NotificationBell";

export default function Topbar({
  openSidebar,
  sidebarOpen,
}) {
  return (
    <header className="sticky top-0 z-30 flex h-[73px] items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={openSidebar}
          className="rounded-xl border border-slate-200 p-2.5 text-slate-600 transition hover:bg-slate-50"
          aria-label={
            sidebarOpen
              ? "Close sidebar"
              : "Open sidebar"
          }
        >
          {sidebarOpen ? (
            <PanelLeftClose size={21} />
          ) : (
            <Menu size={21} />
          )}
        </button>

        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-slate-900 sm:text-sm">
            Management Information Systems
          </p>

          <p className="hidden text-xs text-slate-500 sm:block">
            Ticketing and Support Portal
          </p>
        </div>
      </div>

      <div className="ml-2 flex shrink-0 items-center gap-2">
        <div className="relative hidden md:block">
          <Search
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            type="search"
            placeholder="Search tickets..."
            className="w-64 rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
        </div>

        <NotificationBell />
      </div>
    </header>
  );
}
