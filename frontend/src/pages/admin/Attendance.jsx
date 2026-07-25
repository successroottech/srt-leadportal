import { useEffect, useState } from "react";
import { api } from "../../api/client";
import StatCard from "../../components/StatCard";

function formatDuration(totalSeconds) {
  if (totalSeconds < 0) totalSeconds = 0;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function lastSeenFreshness(lastSeenAt) {
  if (!lastSeenAt) return { color: "bg-slate-300", label: "no heartbeat yet" };
  const secondsAgo = (Date.now() - new Date(lastSeenAt).getTime()) / 1000;
  if (secondsAgo < 120) return { color: "bg-emerald-500", label: "active now" };
  if (secondsAgo < 600) return { color: "bg-amber-500", label: `idle ${Math.round(secondsAgo / 60)}m` };
  return { color: "bg-slate-400", label: `stale ${Math.round(secondsAgo / 60)}m` };
}

function LiveNowPanel() {
  const [live, setLive] = useState([]);
  const [, setTick] = useState(0);

  async function loadLive() {
    try {
      const { data } = await api.get("/attendance/live");
      setLive(data);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    loadLive();
    const poll = setInterval(loadLive, 20000);
    const ticker = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(ticker);
    };
  }, []);

  return (
    <div className="card p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-navy-900">Live Now</h2>
        <span className="text-xs text-slate-400">Auto-refreshes every 20s</span>
      </div>
      {live.length === 0 ? (
        <p className="text-sm text-slate-400">No one is currently clocked in.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {live.map((entry) => {
            const grossSeconds = (Date.now() - new Date(entry.login_time).getTime()) / 1000;
            const breakSeconds = entry.break_minutes * 60 + (entry.on_break ? (Date.now() - new Date(entry.active_break_start).getTime()) / 1000 : 0);
            const fresh = lastSeenFreshness(entry.last_seen_at);
            return (
              <div key={entry.user_id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-navy-900">{entry.name}</p>
                  <span className="badge bg-slate-100 text-slate-600 capitalize">{entry.role}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Since {new Date(entry.login_time).toLocaleTimeString()}
                </p>
                <p className={`mt-1 text-lg font-bold ${entry.on_break ? "text-amber-600" : "text-emerald-600"}`}>
                  {formatDuration(grossSeconds - breakSeconds)}
                </p>
                <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                  <span className={`inline-block h-2 w-2 rounded-full ${fresh.color}`} />
                  <span>{fresh.label}</span>
                  {entry.on_break && <span className="badge bg-amber-100 text-amber-700">on break</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AdminAttendance() {
  const [dash, setDash] = useState(null);
  const [rows, setRows] = useState([]);
  const [staff, setStaff] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    api.get("/dashboards/attendance").then((res) => setDash(res.data));
    api.get("/staff").then((res) => setStaff(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    api.get("/attendance/staff", { params: { attendance_date: date } }).then((res) => setRows(res.data));
  }, [date]);

  const staffName = (userId) => staff.find((s) => s.id === userId)?.name || `#${userId}`;

  return (
    <div>
      <h1 className="text-xl font-bold text-navy-900 mb-4">Staff Attendance</h1>
      {dash && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          <StatCard label="Present Today" value={dash.present_today} accent="green" />
          <StatCard label="Absent Today" value={dash.absent_today} accent="red" />
          <StatCard label="On Leave Today" value={dash.on_leave_today} />
          <StatCard label="Late Logins" value={dash.late_logins_today} accent="gold" />
          <StatCard label="Early Logouts" value={dash.early_logouts_today} accent="gold" />
        </div>
      )}

      <LiveNowPanel />

      <div className="mb-3">
        <input className="input w-full sm:!w-48" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {rows.length === 0 ? (
        <p className="text-center text-slate-400 py-6">No records for this date</p>
      ) : (
        <>
          <div className="hidden sm:block card overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr><th>Staff</th><th>Login</th><th>Logout</th><th>Break (min)</th><th>Total Hours</th><th>Status</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{staffName(r.user_id)}</td>
                    <td>{r.login_time ? new Date(r.login_time).toLocaleTimeString() : "—"}</td>
                    <td>{r.logout_time ? new Date(r.logout_time).toLocaleTimeString() : "—"}</td>
                    <td>{r.break_minutes ?? 0}</td>
                    <td>{r.total_hours ?? "—"}</td>
                    <td><span className="badge bg-slate-200 text-slate-700">{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sm:hidden space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="card p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-navy-900">{staffName(r.user_id)}</p>
                  <span className="badge bg-slate-200 text-slate-700">{r.status}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>Login: {r.login_time ? new Date(r.login_time).toLocaleTimeString() : "—"}</span>
                  <span>Logout: {r.logout_time ? new Date(r.logout_time).toLocaleTimeString() : "—"}</span>
                  <span>Break: {r.break_minutes ?? 0}m</span>
                  <span>Total: {r.total_hours ?? "—"}h</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
