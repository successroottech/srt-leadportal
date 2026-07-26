import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "../../api/client";
import StatCard from "../../components/StatCard";
import Modal from "../../components/Modal";

const PAYMENT_MODES = ["cash", "upi", "bank_transfer", "debit_card", "credit_card", "cheque", "online"];

export default function Fees() {
  const [dash, setDash] = useState(null);
  const [tab, setTab] = useState("today");
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [payModal, setPayModal] = useState(null);
  const [payForm, setPayForm] = useState({ amount: 0, payment_mode: "cash", transaction_number: "", remarks: "" });

  async function loadDash() {
    const { data } = await api.get("/dashboards/fees");
    setDash(data);
  }

  async function loadDues(kind) {
    try {
      const { data } = await api.get(`/fees/dues/${kind}`);
      setRows(data);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  useEffect(() => {
    loadDash();
  }, []);

  useEffect(() => {
    loadDues(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function submitPayment(e) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/fees/payments", { student_id: payModal.student_id, emi_id: payModal.emi_id, ...payForm });
      setPayModal(null);
      await loadDues(tab);
      await loadDash();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-navy-900 mb-4">Fee Management</h1>
      {dash && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
          <StatCard label="Month Expected Fees" value={`₹${dash.month_expected_fees.toLocaleString()}`} />
          <StatCard label="Month Collected Fees" value={`₹${dash.month_collected_fees.toLocaleString()}`} accent="green" />
          <StatCard label="Prev Month Pending" value={`₹${dash.prev_month_pending_fees.toLocaleString()}`} />
          <StatCard label="Total Admission Fees" value={`₹${dash.total_admission_fees.toLocaleString()}`} />
          <StatCard label="Total Collected" value={`₹${dash.total_collected_amount.toLocaleString()}`} accent="green" />
          <StatCard label="Overall Remaining" value={`₹${dash.overall_remaining_amount.toLocaleString()}`} accent="red" />
          <StatCard label="Today's Dues" value={`₹${dash.todays_fee_dues.toLocaleString()}`} accent="gold" />
          <StatCard label="Overdue Fees" value={`₹${dash.overdue_fees.toLocaleString()}`} accent="red" />
        </div>
      )}

      <div className="flex gap-2 mb-3">
        {["today", "upcoming", "overdue"].map((k) => (
          <button key={k} className={tab === k ? "btn-primary" : "btn-secondary"} onClick={() => setTab(k)}>
            {k[0].toUpperCase() + k.slice(1)} Dues
          </button>
        ))}
      </div>
      {error && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="card overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr><th>Student</th><th>Due Date</th><th>Amount</th><th>Paid</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-slate-400 py-6">No records</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.emi_id}>
                  <td className="font-medium">{r.student_name}</td>
                  <td>{r.due_date}</td>
                  <td>{r.amount}</td>
                  <td>{r.paid_amount}</td>
                  <td><span className="badge bg-amber-100 text-amber-700">{r.status}</span></td>
                  <td>
                    <button
                      className="text-navy-700 hover:underline text-xs font-medium"
                      onClick={() => { setPayModal(r); setPayForm({ amount: r.amount - r.paid_amount, payment_mode: "cash", transaction_number: "", remarks: "" }); }}
                    >
                      Record Payment
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!payModal} title={`Record Payment: ${payModal?.student_name || ""}`} onClose={() => setPayModal(null)} error={error}>
        <form onSubmit={submitPayment} className="space-y-3">
          <div><label className="label">Amount</label><input className="input" type="number" required value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.valueAsNumber })} /></div>
          <div>
            <label className="label">Payment Mode</label>
            <select className="input" value={payForm.payment_mode} onChange={(e) => setPayForm({ ...payForm, payment_mode: e.target.value })}>
              {PAYMENT_MODES.map((m) => (<option key={m} value={m}>{m.replace("_", " ")}</option>))}
            </select>
          </div>
          <div><label className="label">Transaction Number</label><input className="input" value={payForm.transaction_number} onChange={(e) => setPayForm({ ...payForm, transaction_number: e.target.value })} /></div>
          <div><label className="label">Remarks</label><textarea className="input" rows={2} value={payForm.remarks} onChange={(e) => setPayForm({ ...payForm, remarks: e.target.value })} /></div>
          <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setPayModal(null)}>Cancel</button><button type="submit" className="btn-primary">Save Payment</button></div>
        </form>
      </Modal>
    </div>
  );
}
