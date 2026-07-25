import { useEffect, useState } from "react";
import { api } from "../../api/client";
import StatCard from "../../components/StatCard";

export default function BatchDashboard() {
  const [dash, setDash] = useState(null);
  const [batches, setBatches] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    api.get("/dashboards/batches").then((res) => setDash(res.data));
    api.get("/batches").then((res) => setBatches(res.data));
    api.get("/staff", { params: { role: "trainer" } }).then((res) => setTrainers(res.data)).catch(() => {});
    api.get("/courses").then((res) => setCourses(res.data)).catch(() => {});
  }, []);

  if (!dash) return <p className="text-slate-500">Loading dashboard...</p>;

  const trainerName = (id) => trainers.find((t) => t.id === id)?.name || (id ? `#${id}` : "Unassigned");
  const courseName = (id) => courses.find((c) => c.id === id)?.name || (id ? `#${id}` : "—");

  const today = new Date().toISOString().slice(0, 10);
  const activeWithRemaining = batches
    .filter((b) => b.status === "active")
    .map((b) => ({
      ...b,
      days_remaining: b.expected_completion_date
        ? Math.ceil((new Date(b.expected_completion_date) - new Date(today)) / (1000 * 60 * 60 * 24))
        : null,
    }));

  return (
    <div>
      <h1 className="text-xl font-bold text-navy-900 mb-4">Batch Dashboard</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCard label="Total Batches" value={dash.total_batches} />
        <StatCard label="Active" value={dash.active_batches} accent="green" />
        <StatCard label="Completed" value={dash.completed_batches} />
        <StatCard label="Upcoming" value={dash.upcoming_batches} accent="gold" />
        <StatCard label="On Hold" value={dash.on_hold_batches} />
        <StatCard label="Delayed" value={dash.delayed_batches} accent="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="card p-4">
          <h2 className="font-semibold text-navy-900 mb-2">Trainer-wise Batch Count</h2>
          <div className="space-y-1 text-sm">
            {Object.keys(dash.trainer_wise).length === 0 ? (
              <p className="text-slate-400">No data</p>
            ) : (
              Object.entries(dash.trainer_wise).map(([trainerId, count]) => (
                <div key={trainerId} className="flex items-center justify-between">
                  <span className="text-slate-600">{trainerName(trainerId === "null" ? null : Number(trainerId))}</span>
                  <span className="font-semibold">{count}</span>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="card p-4">
          <h2 className="font-semibold text-navy-900 mb-2">Course-wise Batch Count</h2>
          <div className="space-y-1 text-sm">
            {Object.entries(dash.course_wise).map(([courseId, count]) => (
              <div key={courseId} className="flex items-center justify-between">
                <span className="text-slate-600">{courseName(Number(courseId))}</span>
                <span className="font-semibold">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <h2 className="font-semibold text-navy-900 mb-2">Active Batches — Remaining Completion Time</h2>
      <div className="card overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr><th>Code</th><th>Name</th><th>Course</th><th>Trainer</th><th>Expected Completion</th><th>Days Remaining</th></tr>
          </thead>
          <tbody>
            {activeWithRemaining.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-slate-400 py-6">No active batches</td></tr>
            ) : (
              activeWithRemaining.map((b) => (
                <tr key={b.id}>
                  <td>{b.batch_code}</td>
                  <td className="font-medium">{b.name}</td>
                  <td>{courseName(b.course_id)}</td>
                  <td>{trainerName(b.trainer_id)}</td>
                  <td>{b.expected_completion_date || "—"}</td>
                  <td>
                    {b.days_remaining === null ? (
                      "—"
                    ) : b.days_remaining < 0 ? (
                      <span className="badge bg-red-100 text-red-700">{Math.abs(b.days_remaining)}d overdue</span>
                    ) : (
                      <span className="badge bg-emerald-100 text-emerald-700">{b.days_remaining}d left</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
