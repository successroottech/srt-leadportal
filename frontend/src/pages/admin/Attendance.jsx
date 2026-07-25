import { useEffect, useState } from "react";
import { api } from "../../api/client";
import StatCard from "../../components/StatCard";

export default function AdminAttendance() {
  const [dash, setDash] = useState(null);
  const [rows, setRows] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    api.get("/dashboards/attendance").then((res) => setDash(res.data));
  }, []);

  useEffect(() => {
    api.get("/attendance/staff", { params: { attendance_date: date } }).then((res) => setRows(res.data));
  }, [date]);

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
      <div className="mb-3">
        <input className="input w-full sm:!w-48" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="card overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr><th>User ID</th><th>Login</th><th>Logout</th><th>Total Hours</th><th>Status</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-slate-400 py-6">No records for this date</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.user_id}</td>
                  <td>{r.login_time ? new Date(r.login_time).toLocaleTimeString() : "—"}</td>
                  <td>{r.logout_time ? new Date(r.logout_time).toLocaleTimeString() : "—"}</td>
                  <td>{r.total_hours ?? "—"}</td>
                  <td><span className="badge bg-slate-200 text-slate-700">{r.status}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
