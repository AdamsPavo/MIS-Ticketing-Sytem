import {
  Bell,
  Menu,
  PanelLeftClose,
  Search,
} from "lucide-react";

export default function Topbar({
  openSidebar,
  sidebarOpen,
}) {
  return (
    <header className="sticky top-0 z-30 flex h-[73px] items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
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

        <div>
          <p className="text-sm font-semibold text-slate-900">
            Management Information Systems
          </p>

          <p className="hidden text-xs text-slate-500 sm:block">
            Ticketing and Support Portal
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
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

        <button
          type="button"
          className="relative rounded-xl border border-slate-200 p-2.5 text-slate-600 transition hover:bg-slate-50"
          aria-label="Notifications"
        >
          <Bell size={20} />

          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
        </button>
      </div>
    </header>
  );
}