import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "../../api/client";

export default function StaffAttendanceSelf() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await api.get("/attendance/staff/me");
    setRows(data);
  }

  useEffect(() => {
    load();
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const todayRow = rows.find((r) => r.attendance_date === today);

  async function handleLogin() {
    setBusy(true);
    setError("");
    try {
      await api.post("/attendance/staff/login");
      await load();
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
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-navy-900 mb-4">My Attendance</h1>
      <div className="card p-4 mb-4 flex items-center gap-3">
        <button className="btn-primary" disabled={busy || !!todayRow?.login_time} onClick={handleLogin}>
          Login for Attendance
        </button>
        <button className="btn-secondary" disabled={busy || !todayRow?.login_time || !!todayRow?.logout_time} onClick={handleLogout}>
          Logout
        </button>
        {todayRow && (
          <span className="text-sm text-slate-500">
            Today: {todayRow.login_time ? new Date(todayRow.login_time).toLocaleTimeString() : "—"} →{" "}
            {todayRow.logout_time ? new Date(todayRow.logout_time).toLocaleTimeString() : "—"}
          </span>
        )}
      </div>
      {error && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="card overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr><th>Date</th><th>Login</th><th>Logout</th><th>Total Hours</th><th>Status</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.attendance_date}</td>
                <td>{r.login_time ? new Date(r.login_time).toLocaleTimeString() : "—"}</td>
                <td>{r.logout_time ? new Date(r.logout_time).toLocaleTimeString() : "—"}</td>
                <td>{r.total_hours ?? "—"}</td>
                <td><span className="badge bg-slate-200 text-slate-700">{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
