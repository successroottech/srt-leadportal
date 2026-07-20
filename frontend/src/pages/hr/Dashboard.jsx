import { useEffect, useState } from "react";
import { api } from "../../api/client";
import StatCard from "../../components/StatCard";

export default function HrDashboard() {
  const [d, setD] = useState(null);

  useEffect(() => {
    api.get("/dashboards/hr").then((res) => setD(res.data));
  }, []);

  if (!d) return <p className="text-slate-500">Loading dashboard...</p>;

  return (
    <div>
      <h1 className="text-xl font-bold text-navy-900 mb-4">HR Dashboard</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard label="Total Staff" value={d.total_staff} />
        <StatCard label="Staff Present Today" value={d.staff_present_today} accent="green" />
        <StatCard label="Staff Absent Today" value={d.staff_absent_today} accent="red" />
        <StatCard label="Staff On Leave" value={d.staff_on_leave_today} />
        <StatCard label="Pending Leave Approvals" value={d.pending_leave_approvals} accent="gold" />
        <StatCard label="Total Candidates" value={d.total_candidates} />
        <StatCard label="Ready for Interview" value={d.candidates_ready_for_interview} />
        <StatCard label="Interviews Scheduled" value={d.interviews_scheduled} />
        <StatCard label="Selected Candidates" value={d.selected_candidates} accent="green" />
        <StatCard label="Joined Candidates" value={d.joined_candidates} accent="green" />
      </div>
    </div>
  );
}
