import { useEffect, useState } from "react";
import { api } from "../../api/client";
import StatCard from "../../components/StatCard";

export default function AdminDashboard() {
  const [d, setD] = useState(null);

  useEffect(() => {
    api.get("/dashboards/admin").then((res) => setD(res.data));
  }, []);

  if (!d) return <p className="text-slate-500">Loading dashboard...</p>;

  return (
    <div>
      <h1 className="text-xl font-bold text-navy-900 mb-4">Admin Dashboard</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard label="Total Staff" value={d.total_staff} />
        <StatCard label="Total Students" value={d.total_students} />
        <StatCard label="Total Trainers" value={d.total_trainers} />
        <StatCard label="Total Telecallers" value={d.total_telecallers} />
        <StatCard label="Active Courses" value={d.active_courses} />
        <StatCard label="Active Batches" value={d.active_batches} />
        <StatCard label="Total Leads" value={d.total_leads} />
        <StatCard label="Today's Follow-ups" value={d.todays_followups} accent="gold" />
        <StatCard label="Pending Follow-ups" value={d.pending_followups} accent="red" />
        <StatCard label="This Month's Admissions" value={d.month_admissions} />
        <StatCard label="This Month's Fee Collection" value={`₹${d.month_fee_collection.toLocaleString()}`} accent="green" />
        <StatCard label="Overall Pending Fees" value={`₹${d.overall_pending_fees.toLocaleString()}`} accent="red" />
        <StatCard label="Monthly Expenses" value={`₹${d.month_expenses.toLocaleString()}`} />
        <StatCard label="Monthly Profit" value={`₹${d.month_profit.toLocaleString()}`} accent="green" />
        <StatCard label="Staff Present Today" value={d.staff_present_today} accent="green" />
        <StatCard label="Staff Absent Today" value={d.staff_absent_today} accent="red" />
        <StatCard label="Staff On Leave Today" value={d.staff_on_leave_today} />
        <StatCard label="Batch Completion (count)" value={d.completed_batches} />
        <StatCard label="Upcoming Fee Dues (7d)" value={d.upcoming_fee_dues_7d} accent="gold" />
        <StatCard label="Upcoming Batch Completions (14d)" value={d.upcoming_batch_completions_14d} />
      </div>
    </div>
  );
}
