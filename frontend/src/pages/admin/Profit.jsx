import { useEffect, useState } from "react";
import { api } from "../../api/client";
import StatCard from "../../components/StatCard";

export default function Profit() {
  const [d, setD] = useState(null);

  useEffect(() => {
    api.get("/dashboards/profit").then((res) => setD(res.data));
  }, []);

  if (!d) return <p className="text-slate-500">Loading...</p>;

  return (
    <div>
      <h1 className="text-xl font-bold text-navy-900 mb-4">Profit & Loss</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Daily Income" value={`₹${d.daily_income.toLocaleString()}`} accent="green" />
        <StatCard label="Monthly Income" value={`₹${d.monthly_income.toLocaleString()}`} accent="green" />
        <StatCard label="Yearly Income" value={`₹${d.yearly_income.toLocaleString()}`} accent="green" />
        <StatCard label="Daily Expenses" value={`₹${d.daily_expenses.toLocaleString()}`} accent="red" />
        <StatCard label="Monthly Expenses" value={`₹${d.monthly_expenses.toLocaleString()}`} accent="red" />
        <StatCard label="Yearly Expenses" value={`₹${d.yearly_expenses.toLocaleString()}`} accent="red" />
        <StatCard label="Monthly Profit" value={`₹${d.monthly_profit.toLocaleString()}`} accent="gold" />
        <StatCard label="Yearly Profit" value={`₹${d.yearly_profit.toLocaleString()}`} accent="gold" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-4">
          <h2 className="font-semibold text-navy-900 mb-2">Course-wise Revenue</h2>
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(d.course_wise_revenue).map(([k, v]) => (
                <tr key={k} className="border-b border-slate-100">
                  <td className="py-1">{k}</td>
                  <td className="py-1 text-right font-medium">₹{v.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card p-4">
          <h2 className="font-semibold text-navy-900 mb-2">Expense Category Report</h2>
          <table className="w-full text-sm">
            <tbody>
              {Object.entries(d.expense_category_report).map(([k, v]) => (
                <tr key={k} className="border-b border-slate-100">
                  <td className="py-1">{k}</td>
                  <td className="py-1 text-right font-medium">₹{v.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
