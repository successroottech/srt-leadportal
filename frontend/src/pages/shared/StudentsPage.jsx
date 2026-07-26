import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "../../api/client";
import { exportCsv } from "../../utils/exportCsv";
import Modal from "../../components/Modal";

const ADMISSION_TYPES = [
  { value: "course", label: "Course" },
  { value: "job_service", label: "Job" },
  { value: "both", label: "Course + Job" },
];
const COURSE_STATUSES = ["ongoing", "completed", "dropped", "on_hold"];
const PLACEMENT_STATUSES = ["not_applicable", "pending", "in_progress", "placed", "not_placed"];
const EMI_QUICK_PICKS = [
  { value: 0, label: "Full" },
  { value: 2, label: "2 EMIs" },
  { value: 3, label: "3 EMIs" },
  { value: 4, label: "4 EMIs" },
  { value: 5, label: "5 EMIs" },
  { value: 6, label: "6 EMIs" },
];
const PAYMENT_MODES = ["cash", "upi", "bank_transfer", "debit_card", "credit_card", "cheque", "online"];

const FEE_STATUS_LABELS = {
  paid: { label: "Paid up", color: "bg-emerald-100 text-emerald-700" },
  upcoming: { label: "Upcoming", color: "bg-slate-200 text-slate-700" },
  due_soon: { label: "Due soon", color: "bg-amber-100 text-amber-700" },
  overdue: { label: "Overdue", color: "bg-red-100 text-red-700" },
};

function feeBadge(status) {
  if (!status) return <span className="badge bg-slate-100 text-slate-400">No fee record</span>;
  const meta = FEE_STATUS_LABELS[status] || FEE_STATUS_LABELS.upcoming;
  return <span className={`badge ${meta.color}`}>{meta.label}</span>;
}

export default function StudentsPage() {
  const [rows, setRows] = useState([]);
  const [courses, setCourses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "", mobile: "", email: "", admission_type: "course", course_id: "", batch_id: "",
    expected_completion_date: "",
    total_course_fee: 0, discount: 0, initial_payment: 0, number_of_emis: 0, password: "",
  });

  const [transferRow, setTransferRow] = useState(null);
  const [transferBatch, setTransferBatch] = useState("");

  const [editRow, setEditRow] = useState(null);
  const [editForm, setEditForm] = useState({});

  const [feesRow, setFeesRow] = useState(null);
  const [feeSummary, setFeeSummary] = useState(null);
  const [feeEmis, setFeeEmis] = useState([]);
  const [payEmi, setPayEmi] = useState(null);
  const [payForm, setPayForm] = useState({ amount: 0, payment_mode: "cash", transaction_number: "", remarks: "" });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/students", { params: search ? { search } : {} });
      setRows(data);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    api.get("/courses").then((res) => setCourses(res.data)).catch(() => {});
    api.get("/batches").then((res) => setBatches(res.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitAdd(e) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/students", { ...addForm, course_id: addForm.course_id || null, batch_id: addForm.batch_id || null, create_login: true });
      setAddOpen(false);
      setAddForm({ name: "", mobile: "", email: "", admission_type: "course", course_id: "", batch_id: "", expected_completion_date: "", total_course_fee: 0, discount: 0, initial_payment: 0, number_of_emis: 0, password: "" });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function submitTransfer(e) {
    e.preventDefault();
    try {
      await api.post(`/students/${transferRow.id}/transfer-batch`, { new_batch_id: Number(transferBatch) });
      setTransferRow(null);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  function openEdit(row) {
    setEditRow(row);
    setEditForm({
      course_status: row.course_status || "ongoing",
      placement_status: row.placement_status || "not_applicable",
      expected_completion_date: row.expected_completion_date || "",
      actual_completion_date: row.actual_completion_date || "",
      job_role: row.job_role || "",
      selected_company: row.selected_company || "",
      job_joining_date: row.job_joining_date || "",
      salary_package: row.salary_package || "",
    });
  }

  async function submitEdit(e) {
    e.preventDefault();
    try {
      await api.put(`/students/${editRow.id}`, editForm);
      setEditRow(null);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function openFees(row) {
    setFeesRow(row);
    setFeeSummary(null);
    setFeeEmis([]);
    try {
      const [summaryRes, emisRes] = await Promise.all([
        api.get(`/fees/student/${row.id}`),
        api.get(`/fees/student/${row.id}/emis`),
      ]);
      setFeeSummary(summaryRes.data);
      setFeeEmis(emisRes.data);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function refreshFees() {
    if (!feesRow) return;
    const [summaryRes, emisRes] = await Promise.all([
      api.get(`/fees/student/${feesRow.id}`),
      api.get(`/fees/student/${feesRow.id}/emis`),
    ]);
    setFeeSummary(summaryRes.data);
    setFeeEmis(emisRes.data);
    await load();
  }

  function openPay(emi) {
    setPayEmi(emi);
    setPayForm({ amount: emi.amount - emi.paid_amount, payment_mode: "cash", transaction_number: "", remarks: "" });
  }

  async function submitPay(e) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/fees/payments", { student_id: feesRow.id, emi_id: payEmi.id, ...payForm });
      setPayEmi(null);
      await refreshFees();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  function handleExport() {
    exportCsv(
      rows,
      [
        { key: "student_code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "mobile", label: "Mobile" },
        { key: "email", label: "Email" },
        { key: "admission_type", label: "Type" },
        { key: "course_status", label: "Course Status" },
        { key: "placement_status", label: "Placement" },
        { key: "balance_fee", label: "Balance Fee" },
        { key: "next_fee_due_date", label: "Next Fee Due" },
        { key: "expected_completion_date", label: "Expected Completion" },
        { key: "job_joining_date", label: "Job Joining Date" },
      ],
      "students"
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-xl font-bold text-navy-900">Students</h1>
        <div className="flex flex-wrap items-center gap-2">
          <input className="input w-full sm:!w-56" placeholder="Search name/mobile/code" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
          <button className="btn-secondary" onClick={load}>Search</button>
          <button className="btn-secondary" onClick={handleExport}>Export</button>
          <button className="btn-gold" onClick={() => setAddOpen(true)}>+ Add Student</button>
        </div>
      </div>
      {error && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <p className="text-center text-slate-400 py-6">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-center text-slate-400 py-6">No students found</p>
      ) : (
        <>
          <div className="hidden sm:block card overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr><th>Code</th><th>Name</th><th>Mobile</th><th>Balance Fee</th><th>Next Due</th><th>Fee Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td>{s.student_code}</td>
                    <td className="font-medium">{s.name}</td>
                    <td>{s.mobile}</td>
                    <td className="font-medium">{s.balance_fee != null ? `₹${s.balance_fee.toLocaleString()}` : "—"}</td>
                    <td>{s.next_fee_due_date || "—"}</td>
                    <td>{feeBadge(s.fee_status)}</td>
                    <td className="whitespace-nowrap space-x-2">
                      <button className="text-emerald-700 hover:underline text-xs font-medium" onClick={() => openFees(s)}>
                        Fees
                      </button>
                      <button className="text-navy-700 hover:underline text-xs font-medium" onClick={() => openEdit(s)}>
                        Edit
                      </button>
                      <button className="text-navy-700 hover:underline text-xs font-medium" onClick={() => { setTransferRow(s); setTransferBatch(""); }}>
                        Transfer Batch
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sm:hidden space-y-2">
            {rows.map((s) => (
              <div key={s.id} className="card p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-navy-900">{s.name}</p>
                  {feeBadge(s.fee_status)}
                </div>
                <p className="text-sm text-slate-500">{s.mobile} <span className="text-slate-400">({s.student_code})</span></p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span className="font-medium text-navy-900">Balance: {s.balance_fee != null ? `₹${s.balance_fee.toLocaleString()}` : "—"}</span>
                  <span>Next due: {s.next_fee_due_date || "—"}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 border-t border-slate-100 pt-2">
                  <button className="text-emerald-700 hover:underline text-xs font-medium" onClick={() => openFees(s)}>
                    Fees
                  </button>
                  <button className="text-navy-700 hover:underline text-xs font-medium" onClick={() => openEdit(s)}>
                    Edit
                  </button>
                  <button className="text-navy-700 hover:underline text-xs font-medium" onClick={() => { setTransferRow(s); setTransferBatch(""); }}>
                    Transfer Batch
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal open={addOpen} title="Add Student" onClose={() => setAddOpen(false)} wide error={error}>
        <form onSubmit={submitAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><label className="label">Name</label><input className="input" required value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} /></div>
          <div><label className="label">Mobile</label><input className="input" required value={addForm.mobile} onChange={(e) => setAddForm({ ...addForm, mobile: e.target.value })} /></div>
          <div><label className="label">Email</label><input className="input" type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} /></div>
          <div>
            <label className="label">Admission Type</label>
            <select className="input" value={addForm.admission_type} onChange={(e) => setAddForm({ ...addForm, admission_type: e.target.value })}>
              {ADMISSION_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
            </select>
          </div>
          <div>
            <label className="label">Course</label>
            <select className="input" value={addForm.course_id} onChange={(e) => setAddForm({ ...addForm, course_id: e.target.value })}>
              <option value="">Select course</option>
              {courses.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>
          <div>
            <label className="label">Batch</label>
            <select className="input" value={addForm.batch_id} onChange={(e) => setAddForm({ ...addForm, batch_id: e.target.value })}>
              <option value="">Select batch</option>
              {batches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
            </select>
          </div>
          <div><label className="label">Expected Completion Date</label><input className="input" type="date" value={addForm.expected_completion_date} onChange={(e) => setAddForm({ ...addForm, expected_completion_date: e.target.value })} /></div>
          <div><label className="label">Total Course Fee</label><input className="input" type="number" value={addForm.total_course_fee} onChange={(e) => setAddForm({ ...addForm, total_course_fee: e.target.valueAsNumber })} /></div>
          <div><label className="label">Discount</label><input className="input" type="number" value={addForm.discount} onChange={(e) => setAddForm({ ...addForm, discount: e.target.valueAsNumber })} /></div>
          <div><label className="label">Initial Payment</label><input className="input" type="number" value={addForm.initial_payment} onChange={(e) => setAddForm({ ...addForm, initial_payment: e.target.valueAsNumber })} /></div>
          <div className="sm:col-span-2">
            <label className="label">Balance Payment Plan</label>
            <div className="flex flex-wrap items-center gap-2">
              {EMI_QUICK_PICKS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={addForm.number_of_emis === o.value ? "btn-primary !py-1 !text-xs" : "btn-secondary !py-1 !text-xs"}
                  onClick={() => setAddForm({ ...addForm, number_of_emis: o.value })}
                >
                  {o.label}
                </button>
              ))}
              <input
                className="input !w-28"
                type="number"
                min="0"
                max="12"
                placeholder="Custom"
                value={addForm.number_of_emis}
                onChange={(e) => setAddForm({ ...addForm, number_of_emis: e.target.valueAsNumber || 0 })}
              />
            </div>
            <p className="mt-1 text-xs text-slate-400">0 = pay in full now. Otherwise choose any number of monthly EMIs (up to 12).</p>
          </div>
          <div className="sm:col-span-2"><label className="label">Student Login Password</label><input className="input" value={addForm.password} onChange={(e) => setAddForm({ ...addForm, password: e.target.value })} placeholder="Default: Welcome@123" /></div>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Save Student</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!transferRow} title={`Transfer Batch: ${transferRow?.name || ""}`} onClose={() => setTransferRow(null)} error={error}>
        <form onSubmit={submitTransfer} className="space-y-3">
          <select className="input" required value={transferBatch} onChange={(e) => setTransferBatch(e.target.value)}>
            <option value="">Select new batch</option>
            {batches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
          </select>
          <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setTransferRow(null)}>Cancel</button><button type="submit" className="btn-primary">Transfer</button></div>
        </form>
      </Modal>

      <Modal open={!!editRow} title={`Edit: ${editRow?.name || ""}`} onClose={() => setEditRow(null)} wide error={error}>
        <form onSubmit={submitEdit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Course Status</label>
            <select className="input" value={editForm.course_status} onChange={(e) => setEditForm({ ...editForm, course_status: e.target.value })}>
              {COURSE_STATUSES.map((s) => (<option key={s} value={s}>{s.replace(/_/g, " ")}</option>))}
            </select>
          </div>
          <div>
            <label className="label">Placement Status</label>
            <select className="input" value={editForm.placement_status} onChange={(e) => setEditForm({ ...editForm, placement_status: e.target.value })}>
              {PLACEMENT_STATUSES.map((s) => (<option key={s} value={s}>{s.replace(/_/g, " ")}</option>))}
            </select>
          </div>
          <div><label className="label">Expected Completion Date</label><input className="input" type="date" value={editForm.expected_completion_date} onChange={(e) => setEditForm({ ...editForm, expected_completion_date: e.target.value })} /></div>
          <div><label className="label">Actual Completion Date</label><input className="input" type="date" value={editForm.actual_completion_date} onChange={(e) => setEditForm({ ...editForm, actual_completion_date: e.target.value })} /></div>
          <div><label className="label">Job Role</label><input className="input" value={editForm.job_role} onChange={(e) => setEditForm({ ...editForm, job_role: e.target.value })} /></div>
          <div><label className="label">Selected Company</label><input className="input" value={editForm.selected_company} onChange={(e) => setEditForm({ ...editForm, selected_company: e.target.value })} /></div>
          <div><label className="label">Job Joining Date</label><input className="input" type="date" value={editForm.job_joining_date} onChange={(e) => setEditForm({ ...editForm, job_joining_date: e.target.value })} /></div>
          <div><label className="label">Salary Package</label><input className="input" type="number" value={editForm.salary_package} onChange={(e) => setEditForm({ ...editForm, salary_package: e.target.valueAsNumber })} /></div>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setEditRow(null)}>Cancel</button>
            <button type="submit" className="btn-primary">Save</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!feesRow} title={`Fees: ${feesRow?.name || ""}`} onClose={() => setFeesRow(null)} wide error={error}>
        {!feeSummary ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : (
          <div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 text-center text-xs">
              <div className="card p-2"><p className="font-bold text-base">₹{feeSummary.total_course_fee.toLocaleString()}</p><p>Total Fee</p></div>
              <div className="card p-2"><p className="font-bold text-base text-emerald-600">₹{(feeSummary.final_fee - feeSummary.balance_fee).toLocaleString()}</p><p>Paid</p></div>
              <div className="card p-2"><p className="font-bold text-base text-red-600">₹{feeSummary.balance_fee.toLocaleString()}</p><p>Pending</p></div>
              <div className="card p-2"><p className="font-bold text-base">{feeSummary.number_of_emis}</p><p>EMI Plan</p></div>
            </div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">EMI Schedule</p>
            <div className="max-h-72 overflow-y-auto space-y-1">
              {feeEmis.length === 0 ? (
                <p className="text-sm text-slate-400">No EMI schedule — balance was fully covered by the initial payment.</p>
              ) : (
                feeEmis.map((emi) => {
                  const overdue = emi.status !== "paid" && emi.due_date < new Date().toISOString().slice(0, 10);
                  return (
                    <div key={emi.id} className="flex flex-wrap items-center justify-between gap-2 text-sm bg-slate-50 rounded px-3 py-2">
                      <span>
                        EMI #{emi.emi_number} — ₹{emi.amount.toLocaleString()}
                        <span className="text-slate-400"> (paid ₹{emi.paid_amount.toLocaleString()})</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Due {emi.due_date}</span>
                        <span className={`badge ${emi.status === "paid" ? "bg-emerald-100 text-emerald-700" : overdue ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                          {overdue && emi.status !== "paid" ? "overdue" : emi.status}
                        </span>
                        {emi.status !== "paid" && (
                          <button className="text-navy-700 hover:underline text-xs font-medium" onClick={() => openPay(emi)}>
                            Record Payment
                          </button>
                        )}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
            <div className="flex justify-end pt-3">
              <button className="btn-secondary" onClick={() => setFeesRow(null)}>Close</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!payEmi} title={`Record Payment: EMI #${payEmi?.emi_number ?? ""}`} onClose={() => setPayEmi(null)} error={error}>
        <form onSubmit={submitPay} className="space-y-3">
          <div><label className="label">Amount</label><input className="input" type="number" required value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.valueAsNumber })} /></div>
          <div>
            <label className="label">Payment Mode</label>
            <select className="input" value={payForm.payment_mode} onChange={(e) => setPayForm({ ...payForm, payment_mode: e.target.value })}>
              {PAYMENT_MODES.map((m) => (<option key={m} value={m}>{m.replace("_", " ")}</option>))}
            </select>
          </div>
          <div><label className="label">Transaction Number</label><input className="input" value={payForm.transaction_number} onChange={(e) => setPayForm({ ...payForm, transaction_number: e.target.value })} /></div>
          <div><label className="label">Remarks</label><textarea className="input" rows={2} value={payForm.remarks} onChange={(e) => setPayForm({ ...payForm, remarks: e.target.value })} /></div>
          <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setPayEmi(null)}>Cancel</button><button type="submit" className="btn-primary">Save Payment</button></div>
        </form>
      </Modal>
    </div>
  );
}
