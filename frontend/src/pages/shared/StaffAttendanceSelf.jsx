import { useEffect, useRef, useState } from "react";
import { api, apiErrorMessage } from "../../api/client";

function formatDuration(totalSeconds) {
  if (totalSeconds < 0) totalSeconds = 0;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${h}h ${m}m ${s}s`;
}

export default function StaffAttendanceSelf() {
  const [rows, setRows] = useState([]);
  const [today, setToday] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const heartbeatRef = useRef(null);

  async function load() {
    const { data } = await api.get("/attendance/staff/me");
    setRows(data);
  }

  async function loadToday() {
    try {
      const { data } = await api.get("/attendance/staff/today");
      setToday(data);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    load();
    loadToday();
  }, []);

  // Live elapsed-time ticker (client-side, no extra API calls)
  useEffect(() => {
    if (!today?.login_time || today?.logout_time) {
      setElapsedSeconds(0);
      return;
    }
    function tick() {
      const grossSeconds = (Date.now() - new Date(today.login_time).getTime()) / 1000;
      const breakSeconds = (today.break_minutes || 0) * 60 + (today.on_break ? (Date.now() - new Date(today.active_break_start).getTime()) / 1000 : 0);
      setElapsedSeconds(grossSeconds - breakSeconds);
    }
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [today]);

  // Heartbeat every 60s while a session is active and this tab is open
  useEffect(() => {
    clearInterval(heartbeatRef.current);
    if (today?.login_time && !today?.logout_time) {
      heartbeatRef.current = setInterval(() => {
        api.post("/attendance/staff/heartbeat").catch(() => {});
      }, 60000);
    }
    return () => clearInterval(heartbeatRef.current);
  }, [today?.login_time, today?.logout_time]);

  const todayHistoryRow = rows.find((r) => r.attendance_date === new Date().toISOString().slice(0, 10));

  async function handleLogin() {
    setBusy(true);
    setError("");
    try {
      await api.post("/attendance/staff/login");
      await Promise.all([load(), loadToday()]);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    setError("");
    try {
      await api.post("/attendance/staff/logout");
      await Promise.all([load(), loadToday()]);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleBreakStart() {
    setBusy(true);
    setError("");
    try {
      await api.post("/attendance/staff/break/start");
      await loadToday();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleBreakEnd() {
    setBusy(true);
    setError("");
    try {
      await api.post("/attendance/staff/break/end");
      await loadToday();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const isLoggedIn = !!today?.login_time && !today?.logout_time;

  return (
    <div>
      <h1 className="text-xl font-bold text-navy-900 mb-4">My Attendance</h1>
      <div className="card p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-primary" disabled={busy || isLoggedIn} onClick={handleLogin}>
            Login for Attendance
          </button>
          <button className="btn-secondary" disabled={busy || !isLoggedIn || today?.on_break} onClick={handleLogout}>
            Logout
          </button>
          {isLoggedIn && (
            today?.on_break ? (
              <button className="btn-secondary !border-amber-400 !text-amber-700" disabled={busy} onClick={handleBreakEnd}>
                End Break
              </button>
            ) : (
              <button className="btn-secondary" disabled={busy} onClick={handleBreakStart}>
                Start Break
              </button>
            )
          )}
          {todayHistoryRow && (
            <span className="text-sm text-slate-500">
              Today: {todayHistoryRow.login_time ? new Date(todayHistoryRow.login_time).toLocaleTimeString() : "—"} →{" "}
              {todayHistoryRow.logout_time ? new Date(todayHistoryRow.logout_time).toLocaleTimeString() : "—"}
            </span>
          )}
        </div>
        {isLoggedIn && (
          <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-3">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                {today?.on_break ? "On break — net working time" : "Working time (live)"}
              </p>
              <p className={`text-lg font-bold ${today?.on_break ? "text-amber-600" : "text-emerald-600"}`}>
                {formatDuration(elapsedSeconds)}
              </p>
            </div>
            {today?.break_minutes > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Break time today</p>
                <p className="text-lg font-bold text-slate-600">{today.break_minutes}m</p>
              </div>
            )}
          </div>
        )}
      </div>
      {error && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {rows.length === 0 ? (
        <p className="text-center text-slate-400 py-6">No attendance records yet</p>
      ) : (
        <>
          <div className="hidden sm:block card overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr><th>Date</th><th>Login</th><th>Logout</th><th>Break (min)</th><th>Total Hours</th><th>Status</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.attendance_date}</td>
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
                  <p className="font-medium text-navy-900">{r.attendance_date}</p>
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
