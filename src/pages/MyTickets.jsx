import { useEffect, useMemo, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import {
  Search,
  Eye,
  X,
} from "lucide-react";

import { db } from "../firebase/firebase";
import { useAuth } from "../context/AuthContext";

const statusStyles = {
  Pending: "bg-amber-100 text-amber-700",
  Assigned: "bg-blue-100 text-blue-700",
  "In Progress": "bg-purple-100 text-purple-700",
  Resolved: "bg-green-100 text-green-700",
  Closed: "bg-slate-200 text-slate-700",
};

const formatDate = (timestamp) => {
  if (!timestamp) return "-";

  const date =
    typeof timestamp.toDate === "function"
      ? timestamp.toDate()
      : new Date(timestamp);

  return date.toLocaleString();
};

export default function MyTickets() {
  const { currentUser } = useAuth();

  const [tickets, setTickets] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedTicket, setSelectedTicket] = useState(null);

  useEffect(() => {
    const q = query(
      collection(db, "tickets"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setTickets(data);
    });

    return unsubscribe;
  }, []);

  const myTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      if (ticket.requesterUid !== currentUser?.uid) return false;

      if (!search.trim()) return true;

      const value = search.toLowerCase();

      return (
        ticket.ticketNumber?.toLowerCase().includes(value) ||
        ticket.subject?.toLowerCase().includes(value) ||
        ticket.category?.toLowerCase().includes(value)
      );
    });
  }, [tickets, search, currentUser]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          My Tickets
        </h1>

        <p className="mt-2 text-slate-500">
          Track the status of the concerns you submitted.
        </p>
      </div>

      <div className="relative">
        <Search
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />

        <input
          type="search"
          placeholder="Search ticket..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-slate-300 py-3 pl-10 pr-4 outline-none focus:border-blue-500"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr className="text-left text-sm text-slate-500">
              <th className="px-5 py-4">Ticket #</th>
              <th className="px-5 py-4">Subject</th>
              <th className="px-5 py-4">Category</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">Assigned To</th>
              <th className="px-5 py-4">Created</th>
              <th className="px-5 py-4"></th>
            </tr>
          </thead>

          <tbody>
            {myTickets.map((ticket) => (
              <tr
                key={ticket.id}
                className="border-t hover:bg-slate-50"
              >
                <td className="px-5 py-4 font-semibold text-blue-700">
                  {ticket.ticketNumber}
                </td>

                <td className="px-5 py-4">
                  {ticket.subject}
                </td>

                <td className="px-5 py-4">
                  {ticket.category}
                </td>

                <td className="px-5 py-4">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      statusStyles[ticket.status]
                    }`}
                  >
                    {ticket.status}
                  </span>
                </td>

                <td className="px-5 py-4">
                  {ticket.assignedToName || "Waiting for assignment"}
                </td>

                <td className="px-5 py-4">
                  {formatDate(ticket.createdAt)}
                </td>

                <td className="px-5 py-4">
                  <button
                    onClick={() => setSelectedTicket(ticket)}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2 hover:bg-slate-100"
                  >
                    <Eye size={16} />
                    View
                  </button>
                </td>
              </tr>
            ))}

            {myTickets.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="py-16 text-center text-slate-500"
                >
                  No tickets found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl">

            <div className="flex items-center justify-between border-b p-5">
              <h2 className="text-xl font-bold">
                {selectedTicket.ticketNumber}
              </h2>

              <button
                onClick={() => setSelectedTicket(null)}
              >
                <X />
              </button>
            </div>

            <div className="space-y-4 p-6">

              <div>
                <p className="text-sm font-semibold">
                  Subject
                </p>
                <p>{selectedTicket.subject}</p>
              </div>

              <div>
                <p className="text-sm font-semibold">
                  Description
                </p>
                <p className="whitespace-pre-wrap">
                  {selectedTicket.description}
                </p>
              </div>

              <div>
                <p className="text-sm font-semibold">
                  Assigned To
                </p>
                <p>
                  {selectedTicket.assignedToName ||
                    "Not assigned"}
                </p>
              </div>

              <div>
                <p className="text-sm font-semibold">
                  Status
                </p>
                <p>{selectedTicket.status}</p>
              </div>

              <div>
                <p className="text-sm font-semibold">
                  MIS Remarks
                </p>
                <p>
                  {selectedTicket.remarks ||
                    "No remarks yet."}
                </p>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}