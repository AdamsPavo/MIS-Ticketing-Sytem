import { useState } from "react";
import { Outlet } from "react-router-dom";

import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setSidebarOpen((previous) => !previous);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar
        open={sidebarOpen}
        setOpen={setSidebarOpen}
      />

      <div
        className={`min-h-screen min-w-0 transition-all duration-300 ${
          sidebarOpen ? "lg:pl-72" : "lg:pl-0"
        }`}
      >
        <Topbar
          openSidebar={toggleSidebar}
          sidebarOpen={sidebarOpen}
        />

        <main className="min-h-[calc(100vh-73px)] min-w-0 overflow-x-hidden p-3 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          onClick={closeSidebar}
          className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden"
        />
      )}
    </div>
  );
}
