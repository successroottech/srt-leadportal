import { useEffect, useState } from "react";
import { api } from "../../api/client";
import StatCard from "../../components/StatCard";

export default function MyFees() {
  const [summary, setSummary] = useState(null);
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    api.get("/fees/my/summary").then((res) => setSummary(res.data));
    api.get("/fees/my/payments").then((res) => setPayments(res.data));
  }, []);

  if (!summary) return <p className="text-slate-500">Loading...</p>;

  return (
    <div>
      <h1 className="text-xl font-bold text-navy-900 mb-4">Fee Details</h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <StatCard label="Total Course Fee" value={`₹${(summary.total_course_fee || 0).toLocaleString()}`} />
        <StatCard label="Discount" value={`₹${(summary.discount || 0).toLocaleString()}`} />
        <StatCard label="Paid Amount" value={`₹${(summary.paid_amount || 0).toLocaleString()}`} accent="green" />
        <StatCard label="Balance Amount" value={`₹${(summary.balance_fee || 0).toLocaleString()}`} accent="red" />
        <StatCard label="Next Due Date" value={summary.next_due_date || "—"} accent="gold" />
      </div>

      <h2 className="font-semibold text-navy-900 mb-2">EMI Schedule</h2>
      <div className="card overflow-x-auto mb-6">
        <table className="data-table w-full">
          <thead><tr><th>EMI #</th><th>Amount</th><th>Due Date</th><th>Paid</th><th>Status</th></tr></thead>
          <tbody>
            {(summary.emis || []).map((e) => (
              <tr key={e.emi_number}>
                <td>{e.emi_number}</td>
                <td>{e.amount}</td>
                <td>{e.due_date}</td>
                <td>{e.paid_amount}</td>
                <td><span className="badge bg-slate-200 text-slate-700">{e.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="font-semibold text-navy-900 mb-2">Payment History</h2>
      <div className="card overflow-x-auto">
        <table className="data-table w-full">
          <thead><tr><th>Receipt #</th><th>Date</th><th>Amount</th><th>Mode</th></tr></thead>
          <tbody>
            {payments.length === 0 ? (
              <tr><td colSpan={4} className="text-center text-slate-400 py-6">No payments yet</td></tr>
            ) : (
              payments.map((p) => (
                <tr key={p.id}>
                  <td>{p.receipt_number}</td>
                  <td>{p.payment_date}</td>
                  <td>{p.amount}</td>
                  <td>{p.payment_mode}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
