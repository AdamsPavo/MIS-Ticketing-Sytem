import {
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import AppLayout from "./components/AppLayout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

import AllTickets from "./pages/Tickets.jsx";
import CreateTicket from "./pages/CreateTicket.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Events from "./pages/Events.jsx";
import Login from "./pages/Login.jsx";
import MyTickets from "./pages/MyTickets.jsx";
import Reports from "./pages/Reports.jsx";
import UserManagement from "./pages/UserManagement.jsx";
import ITWorkBoard from "./pages/ITWorkBoard";

function HomeRedirect() {
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Public route */}
      <Route
        path="/login"
        element={<Login />}
      />

      {/* Protected routes using AppLayout */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute
              allowedRoles={[
                "admin",
                "IT_STAFF",
              ]}
            >
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/create-ticket"
          element={
            <ProtectedRoute
              allowedRoles={[
                "admin",
                "IT_STAFF",
                "user",
                "QA",
              ]}
            >
              <CreateTicket />
            </ProtectedRoute>
          }
        />

        <Route
          path="/all-tickets"
          element={
            <ProtectedRoute
              allowedRoles={[
                "admin",
                "IT_STAFF",
                "QA",
              ]}
            >
              <AllTickets />
            </ProtectedRoute>
          }
        />

        <Route
          path="/my-tickets"
          element={
            <ProtectedRoute
              allowedRoles={[
                "admin",
                "IT_STAFF",
                "user",
                "QA",
              ]}
            >
              <MyTickets />
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports"
          element={
            <ProtectedRoute
              allowedRoles={["admin"]}
            >
              <Reports />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings/users"
          element={
            <ProtectedRoute
              allowedRoles={["admin"]}
            >
              <UserManagement />
            </ProtectedRoute>
          }
        />

        <Route
          path="/events"
          element={
            <ProtectedRoute
              allowedRoles={[
                "admin",
                "IT_STAFF",
                "QA",
                "user",
              ]}
            >
              <Events />
            </ProtectedRoute>
          }
        />

          <Route
                path="/it-work-board"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      "admin",
                      "IT_STAFF",
                      "user",
                      "QA",
                    ]}
                  >
                    <ITWorkBoard />
                  </ProtectedRoute>
                }
                />

      </Route>

      

      {/* Redirect routes */}
      <Route
        path="/"
        element={<HomeRedirect />}
      />

      <Route
        path="*"
        element={<HomeRedirect />}
      />
    </Routes>
  );
}