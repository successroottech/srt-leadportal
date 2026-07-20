import { useEffect, useState } from "react";
import { api } from "../../api/client";
import StatCard from "../../components/StatCard";

export default function TelecallerDashboard() {
  const [d, setD] = useState(null);

  useEffect(() => {
    api.get("/dashboards/telecaller").then((res) => setD(res.data));
  }, []);

  if (!d) return <p className="text-slate-500">Loading dashboard...</p>;

  return (
    <div>
      <h1 className="text-xl font-bold text-navy-900 mb-4">Telecaller Dashboard</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard label="Total Assigned Leads" value={d.total_assigned_leads} />
        <StatCard label="New Assigned Leads" value={d.new_assigned_leads} accent="gold" />
        <StatCard label="Today's Follow-ups" value={d.todays_followups} accent="gold" />
        <StatCard label="Overdue Follow-ups" value={d.overdue_followups} accent="red" />
        <StatCard label="Interested Leads" value={d.interested_leads} />
        <StatCard label="Demo Scheduled" value={d.demo_scheduled_leads} />
        <StatCard label="Converted Leads" value={d.converted_leads} accent="green" />
        <StatCard label="Not Interested" value={d.not_interested_leads} />
        <StatCard label="Monthly Conversions" value={d.month_conversion_count} accent="green" />
        <StatCard label="Conversion %" value={d.conversion_percentage} suffix="%" accent="green" />
      </div>
    </div>
  );
}
