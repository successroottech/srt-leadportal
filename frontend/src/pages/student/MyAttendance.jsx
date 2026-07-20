import { useEffect, useState } from "react";
import { api } from "../../api/client";

export default function MyAttendance() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    api.get("/attendance/students/me").then((res) => setRows(res.data));
  }, []);

  const present = rows.filter((r) => r.status === "present" || r.status === "late").length;
  const pct = rows.length ? Math.round((present / rows.length) * 100) : 0;

  return (
    <div>
      <h1 className="text-xl font-bold text-navy-900 mb-1">My Attendance</h1>
      <p className="text-sm text-slate-500 mb-4">Overall attendance: <strong>{pct}%</strong></p>
      <div className="card overflow-x-auto">
        <table className="data-table w-full">
          <thead><tr><th>Date</th><th>Status</th><th>Remarks</th></tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={3} className="text-center text-slate-400 py-6">No attendance records yet</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.attendance_date}</td>
                  <td><span className="badge bg-slate-200 text-slate-700">{r.status}</span></td>
                  <td>{r.remarks || "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
