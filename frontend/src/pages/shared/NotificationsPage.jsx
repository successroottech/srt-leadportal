import { useEffect, useState } from "react";
import { api } from "../../api/client";

export default function NotificationsPage() {
  const [rows, setRows] = useState([]);

  async function load() {
    const { data } = await api.get("/notifications");
    setRows(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead(row) {
    await api.post(`/notifications/${row.id}/read`);
    await load();
  }

  async function dismiss(row) {
    await api.post(`/notifications/${row.id}/dismiss`);
    await load();
  }

  async function markAll() {
    await api.post("/notifications/mark-all-read");
    await load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-navy-900">Notifications</h1>
        <button className="btn-secondary" onClick={markAll}>Mark all as read</button>
      </div>
      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-slate-400 text-sm">No notifications</p>
        ) : (
          rows.map((n) => (
            <div key={n.id} className={`card p-3 flex items-start justify-between gap-3 ${n.status === "unread" ? "border-l-4 border-l-gold-500" : ""}`}>
              <div>
                <p className="text-sm font-medium text-navy-900">{n.title}</p>
                <p className="text-xs text-slate-500">{n.message}</p>
                <p className="text-[11px] text-slate-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                {n.status === "unread" && (
                  <button className="text-xs text-navy-700 hover:underline" onClick={() => markRead(n)}>Mark read</button>
                )}
                {n.status !== "dismissed" && (
                  <button className="text-xs text-slate-500 hover:underline" onClick={() => dismiss(n)}>Dismiss</button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
