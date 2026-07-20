import { useEffect, useState } from "react";
import { api } from "../../api/client";
import StatCard from "../../components/StatCard";

export default function TrainerDashboard() {
  const [d, setD] = useState(null);

  useEffect(() => {
    api.get("/dashboards/trainer").then((res) => setD(res.data));
  }, []);

  if (!d) return <p className="text-slate-500">Loading dashboard...</p>;

  return (
    <div>
      <h1 className="text-xl font-bold text-navy-900 mb-4">Trainer Dashboard</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard label="Assigned Batches" value={d.assigned_batches} />
        <StatCard label="Active Batches" value={d.active_batches} accent="green" />
        <StatCard label="Completed Batches" value={d.completed_batches} />
        <StatCard label="Pending Batches" value={d.pending_batches} accent="gold" />
        <StatCard label="Total Assigned Students" value={d.total_assigned_students} />
        <StatCard label="Batch Completion %" value={d.batch_completion_percentage} suffix="%" accent="green" />
        <StatCard label="Pending Topics" value={d.pending_topics} accent="red" />
        <StatCard label="Upcoming Batch Completions (14d)" value={d.upcoming_batch_completions} />
      </div>
    </div>
  );
}
