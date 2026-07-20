import { useEffect, useState } from "react";
import { api } from "../../api/client";
import StatCard from "../../components/StatCard";

export default function StudentDashboard() {
  const [d, setD] = useState(null);

  useEffect(() => {
    api.get("/dashboards/student").then((res) => setD(res.data));
  }, []);

  if (!d) return <p className="text-slate-500">Loading dashboard...</p>;

  return (
    <div>
      <h1 className="text-xl font-bold text-navy-900 mb-1">
        Welcome, {d.student_name}
      </h1>
      <p className="text-sm text-slate-500 mb-4">Student Code: {d.student_code}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard label="Course Status" value={d.course_status} />
        <StatCard label="Course Completion" value={d.course_completion_percentage} suffix="%" accent="green" />
        <StatCard label="Completed Topics" value={d.completed_topics} accent="green" />
        <StatCard label="Pending Topics" value={d.pending_topics} accent="gold" />
        <StatCard label="Attendance %" value={d.attendance_percentage} suffix="%" />
        <StatCard label="Total Course Fee" value={`₹${d.total_course_fee.toLocaleString()}`} />
        <StatCard label="Paid Amount" value={`₹${d.paid_amount.toLocaleString()}`} accent="green" />
        <StatCard label="Balance Amount" value={`₹${d.balance_amount.toLocaleString()}`} accent="red" />
        <StatCard label="Next Fee Due Date" value={d.next_fee_due_date || "—"} accent="gold" />
      </div>
    </div>
  );
}
