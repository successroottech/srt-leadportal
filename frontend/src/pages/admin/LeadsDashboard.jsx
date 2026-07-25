import { useEffect, useState } from "react";
import { api } from "../../api/client";
import StatCard from "../../components/StatCard";

export default function LeadsDashboard() {
  const [dash, setDash] = useState(null);
  const [pending, setPending] = useState([]);
  const [telecallers, setTelecallers] = useState([]);
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    api.get("/dashboards/leads").then((res) => setDash(res.data));
    api.get("/staff", { params: { role: "telecaller" } }).then((res) => setTelecallers(res.data)).catch(() => {});
    api.get("/courses").then((res) => setCourses(res.data)).catch(() => {});
    api.get("/leads").then((res) => {
      const today = new Date().toISOString().slice(0, 10);
      const rows = res.data
        .filter((l) => l.follow_up_date && l.follow_up_date <= today && !["converted", "not_interested", "closed", "invalid_number"].includes(l.status))
        .sort((a, b) => (a.follow_up_date < b.follow_up_date ? -1 : 1));
      setPending(rows);
    });
  }, []);

  if (!dash) return <p className="text-slate-500">Loading dashboard...</p>;

  const telecallerName = (id) => telecallers.find((t) => t.id === id)?.name || (id ? `#${id}` : "Unassigned");
  const courseName = (id) => courses.find((c) => c.id === id)?.name || (id ? `#${id}` : "—");

  return (
    <div>
      <h1 className="text-xl font-bold text-navy-900 mb-4">Leads Dashboard</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total Leads" value={dash.total_leads} />
        <StatCard label="Today's Follow-ups" value={dash.todays_followups} accent="gold" />
        <StatCard label="Overdue Follow-ups" value={dash.overdue_followups} accent="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="card p-4">
          <h2 className="font-semibold text-navy-900 mb-2">Status Breakdown</h2>
          <div className="space-y-1 text-sm">
            {Object.entries(dash.status_breakdown).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="capitalize text-slate-600">{status.replace(/_/g, " ")}</span>
                <span className="font-semibold">{count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-4">
          <h2 className="font-semibold text-navy-900 mb-2">Telecaller-wise Conversion</h2>
          <div className="space-y-1 text-sm">
            {dash.telecaller_wise.length === 0 ? (
              <p className="text-slate-400">No data</p>
            ) : (
              dash.telecaller_wise.map((t) => (
                <div key={t.telecaller_id ?? "unassigned"} className="flex items-center justify-between">
                  <span className="text-slate-600">{telecallerName(t.telecaller_id)}</span>
                  <span className="font-semibold">{t.converted} / {t.total}</span>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="card p-4">
          <h2 className="font-semibold text-navy-900 mb-2">Source-wise</h2>
          <div className="space-y-1 text-sm">
            {Object.entries(dash.source_wise).map(([source, count]) => (
              <div key={source} className="flex items-center justify-between">
                <span className="capitalize text-slate-600">{source.replace(/_/g, " ")}</span>
                <span className="font-semibold">{count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-4">
          <h2 className="font-semibold text-navy-900 mb-2">Course-wise Interest</h2>
          <div className="space-y-1 text-sm">
            {Object.keys(dash.course_wise).length === 0 ? (
              <p className="text-slate-400">No data</p>
            ) : (
              Object.entries(dash.course_wise).map(([courseId, count]) => (
                <div key={courseId} className="flex items-center justify-between">
                  <span className="text-slate-600">{courseName(courseId === "null" ? null : Number(courseId))}</span>
                  <span className="font-semibold">{count}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <h2 className="font-semibold text-navy-900 mb-2">Pending Follow-ups (due today or overdue)</h2>
      <div className="card overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr><th>Name</th><th>Mobile</th><th>Telecaller</th><th>Status</th><th>Due Date</th></tr>
          </thead>
          <tbody>
            {pending.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-slate-400 py-6">No pending follow-ups</td></tr>
            ) : (
              pending.map((l) => (
                <tr key={l.id}>
                  <td className="font-medium">{l.name}</td>
                  <td>{l.mobile}</td>
                  <td>{telecallerName(l.assigned_telecaller_id)}</td>
                  <td><span className="badge bg-amber-100 text-amber-700">{l.status.replace(/_/g, " ")}</span></td>
                  <td>{l.follow_up_date}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
