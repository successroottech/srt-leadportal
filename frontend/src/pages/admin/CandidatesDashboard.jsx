import { useEffect, useState } from "react";
import { api } from "../../api/client";
import StatCard from "../../components/StatCard";

export default function CandidatesDashboard() {
  const [dash, setDash] = useState(null);
  const [followups, setFollowups] = useState([]);
  const [staff, setStaff] = useState([]);

  useEffect(() => {
    api.get("/dashboards/candidates").then((res) => setDash(res.data));
    api.get("/staff").then((res) => setStaff(res.data)).catch(() => {});
    api.get("/candidates").then((res) => {
      const today = new Date().toISOString().slice(0, 10);
      const rows = res.data
        .filter((c) => c.follow_up_date && c.follow_up_date <= today && !["selected", "rejected", "joined", "closed"].includes(c.status))
        .sort((a, b) => (a.follow_up_date < b.follow_up_date ? -1 : 1));
      setFollowups(rows);
    });
  }, []);

  if (!dash) return <p className="text-slate-500">Loading dashboard...</p>;

  const staffName = (id) => staff.find((s) => s.id === id)?.name || (id ? `#${id}` : "Unassigned");

  return (
    <div>
      <h1 className="text-xl font-bold text-navy-900 mb-4">Candidates Dashboard</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        <StatCard label="Total Candidates" value={dash.total_candidates} />
        <StatCard label="Unassigned" value={dash.unassigned_candidates} accent="gold" />
        <StatCard label="Assigned Today" value={dash.assigned_today} accent="green" />
        <StatCard label="Stale Pending" value={dash.stale_pending} accent="red" />
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
          <h2 className="font-semibold text-navy-900 mb-2">Telecaller-wise (Total / Today / Stale)</h2>
          <div className="space-y-1 text-sm">
            {dash.telecaller_wise.length === 0 ? (
              <p className="text-slate-400">No data</p>
            ) : (
              dash.telecaller_wise.map((t) => (
                <div key={t.telecaller_id} className="flex items-center justify-between">
                  <span className="text-slate-600">{staffName(t.telecaller_id)}</span>
                  <span className="font-semibold">
                    {t.total_assigned} / {t.assigned_today} / <span className={t.stale_pending > 0 ? "text-red-600" : ""}>{t.stale_pending}</span>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="card p-4">
          <h2 className="font-semibold text-navy-900 mb-2">Trainer Handoffs</h2>
          <div className="space-y-1 text-sm">
            {dash.trainer_wise.length === 0 ? (
              <p className="text-slate-400">No data</p>
            ) : (
              dash.trainer_wise.map((t) => (
                <div key={t.trainer_id} className="flex items-center justify-between">
                  <span className="text-slate-600">{staffName(t.trainer_id)}</span>
                  <span className="font-semibold">{t.handed_off}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <h2 className="font-semibold text-navy-900 mb-2">Follow-ups Due (today or overdue)</h2>
      <div className="card overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr><th>Name</th><th>Mobile</th><th>Telecaller</th><th>Status</th><th>Follow-up Date</th></tr>
          </thead>
          <tbody>
            {followups.length === 0 ? (
              <tr><td colSpan={5} className="text-center text-slate-400 py-4">No pending follow-ups</td></tr>
            ) : (
              followups.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{c.name}</td>
                  <td>{c.mobile}</td>
                  <td>{staffName(c.assigned_telecaller_id)}</td>
                  <td><span className="badge bg-slate-200 text-slate-700">{c.status.replace(/_/g, " ")}</span></td>
                  <td>{c.follow_up_date}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
