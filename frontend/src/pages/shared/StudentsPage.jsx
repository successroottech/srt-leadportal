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

const DOC_TYPE_LABELS = {
  joining_letter: "Joining Letter",
  invoice: "Invoice",
  certificate: "Certificate",
};

function DocumentsManager({ student }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({ title: "", amount: "", due_date: "" });
  const [certTitle, setCertTitle] = useState("");
  const [certFile, setCertFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/documents/student/${student.id}`);
      setDocs(data);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generateJoiningLetter() {
    setGenerating(true);
    setError("");
    try {
      await api.post(`/documents/joining-letter/${student.id}`);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setGenerating(false);
    }
  }

  async function submitInvoice(e) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/documents/invoices", {
        student_id: student.id,
        title: invoiceForm.title,
        amount: Number(invoiceForm.amount),
        due_date: invoiceForm.due_date || null,
      });
      setInvoiceForm({ title: "", amount: "", due_date: "" });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function submitCertificate(e) {
    e.preventDefault();
    if (!certFile) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("student_id", student.id);
      formData.append("title", certTitle);
      formData.append("file", certFile);
      await api.post("/documents/certificates", formData, { headers: { "Content-Type": "multipart/form-data" } });
      setCertTitle("");
      setCertFile(null);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function removeDoc(id) {
    if (!window.confirm("Delete this document?")) return;
    try {
      await api.delete(`/documents/${id}`);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div>
      {error && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <p className="text-sm text-slate-400">Loading...</p>
      ) : docs.length === 0 ? (
        <p className="text-sm text-slate-400 mb-3">No documents yet.</p>
      ) : (
        <div className="space-y-1 mb-4 max-h-48 overflow-y-auto">
          {docs.map((d) => (
            <div key={d.id} className="flex items-center justify-between text-sm bg-slate-50 rounded px-2 py-1.5">
              <span>
                <span className="badge bg-slate-200 text-slate-700 mr-2">{DOC_TYPE_LABELS[d.document_type] || d.document_type}</span>
                {d.file_path ? (
                  <a href={d.file_path} target="_blank" rel="noreferrer" className="text-navy-700 hover:underline">{d.title}</a>
                ) : (
                  d.title
                )}
                {d.amount != null && <span className="ml-2 text-slate-500">₹{Number(d.amount).toLocaleString()}</span>}
                {d.due_date && <span className="ml-2 text-slate-400">due {d.due_date}</span>}
              </span>
              <button className="text-red-600 hover:underline text-xs font-medium" onClick={() => removeDoc(d.id)}>Delete</button>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-slate-200 pt-3 space-y-4">
        <div>
          <button className="btn-secondary" onClick={generateJoiningLetter} disabled={generating}>
            {generating ? "Generating..." : "Generate Joining Letter"}
          </button>
        </div>

        <form onSubmit={submitInvoice} className="space-y-2">
          <p className="label">Create Invoice</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input className="input" placeholder="Description" required value={invoiceForm.title} onChange={(e) => setInvoiceForm({ ...invoiceForm, title: e.target.value })} />
            <input className="input" type="number" placeholder="Amount" required value={invoiceForm.amount} onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })} />
            <input className="input" type="date" value={invoiceForm.due_date} onChange={(e) => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })} />
          </div>
          <button type="submit" className="btn-secondary">Create Invoice</button>
        </form>

        <form onSubmit={submitCertificate} className="space-y-2">
          <p className="label">Upload Certificate</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input className="input" placeholder="Title (e.g. Course Completion Certificate)" required value={certTitle} onChange={(e) => setCertTitle(e.target.value)} />
            <input className="input" type="file" accept=".pdf,.jpg,.jpeg,.png" required onChange={(e) => setCertFile(e.target.files?.[0] || null)} />
          </div>
          <button type="submit" className="btn-secondary" disabled={uploading}>{uploading ? "Uploading..." : "Upload Certificate"}</button>
        </form>
      </div>
    </div>
  );
}

export default function StudentsPage() {
  const [rows, setRows] = useState([]);
  const [courses, setCourses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", mobile: "", course_id: "", total_course_fee: 0 });
  const [addExpectedCompletion, setAddExpectedCompletion] = useState("");

  const [transferRow, setTransferRow] = useState(null);
  const [transferBatch, setTransferBatch] = useState("");

  const [editRow, setEditRow] = useState(null);
  const [editForm, setEditForm] = useState({});

  const [docsRow, setDocsRow] = useState(null);
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

  function computeExpectedCompletion(courseId) {
    const course = courses.find((c) => c.id === Number(courseId));
    if (!course || !course.duration_weeks) return "";
    const d = new Date();
    d.setDate(d.getDate() + course.duration_weeks * 7);
    return d.toISOString().slice(0, 10);
  }

  function handleAddCourseChange(courseId) {
    setAddForm({ ...addForm, course_id: courseId });
    setAddExpectedCompletion(computeExpectedCompletion(courseId));
  }

  async function submitAdd(e) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/students", {
        ...addForm,
        course_id: addForm.course_id || null,
        joining_date: new Date().toISOString().slice(0, 10),
        expected_completion_date: addExpectedCompletion || null,
        create_login: true,
      });
      setAddOpen(false);
      setAddForm({ name: "", mobile: "", course_id: "", total_course_fee: 0 });
      setAddExpectedCompletion("");
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
      name: row.name || "",
      mobile: row.mobile || "",
      alt_mobile: row.alt_mobile || "",
      email: row.email || "",
      dob: row.dob || "",
      gender: row.gender || "",
      address: row.address || "",
      qualification: row.qualification || "",
      college_name: row.college_name || "",
      graduation_year: row.graduation_year || "",
      admission_type: row.admission_type || "course",
      course_id: row.course_id || "",
      batch_id: row.batch_id || "",
      joining_date: row.joining_date || "",
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
      const payload = { ...editForm };
      for (const key of ["dob", "graduation_year", "course_id", "batch_id", "joining_date", "expected_completion_date", "actual_completion_date", "job_joining_date", "salary_package"]) {
        if (payload[key] === "" || Number.isNaN(payload[key])) payload[key] = null;
      }
      await api.put(`/students/${editRow.id}`, payload);
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
          <button
            className="btn-secondary"
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/register`);
              alert("Registration link copied! Share it with prospective students.");
            }}
          >
            Copy Registration Link
          </button>
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
                      <button className="text-navy-700 hover:underline text-xs font-medium" onClick={() => setDocsRow(s)}>
                        Documents
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
                  <button className="text-navy-700 hover:underline text-xs font-medium" onClick={() => setDocsRow(s)}>
                    Documents
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal open={addOpen} title="Add Student" onClose={() => setAddOpen(false)} error={error}>
        <form onSubmit={submitAdd} className="space-y-3">
          <div><label className="label">Name</label><input className="input" required value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} /></div>
          <div><label className="label">Mobile</label><input className="input" required value={addForm.mobile} onChange={(e) => setAddForm({ ...addForm, mobile: e.target.value })} /></div>
          <div>
            <label className="label">Course</label>
            <select className="input" required value={addForm.course_id} onChange={(e) => handleAddCourseChange(e.target.value)}>
              <option value="">Select course</option>
              {courses.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>
          <div><label className="label">Total Course Fee</label><input className="input" type="number" required value={addForm.total_course_fee} onChange={(e) => setAddForm({ ...addForm, total_course_fee: e.target.valueAsNumber })} /></div>
          {addExpectedCompletion && (
            <p className="text-xs text-slate-500">
              Expected course completion: <strong className="text-navy-900">{addExpectedCompletion}</strong> (admission date + course duration)
            </p>
          )}
          <p className="text-xs text-slate-400">
            A student login is created automatically (default password Welcome@123). Everything else — email, batch, EMI plan, job details — can be filled in later from Edit.
          </p>
          <div className="flex justify-end gap-2 pt-2">
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
          <div><label className="label">Name</label><input className="input" required value={editForm.name || ""} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div>
          <div><label className="label">Mobile</label><input className="input" required value={editForm.mobile || ""} onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })} /></div>
          <div><label className="label">Alt Mobile</label><input className="input" value={editForm.alt_mobile || ""} onChange={(e) => setEditForm({ ...editForm, alt_mobile: e.target.value })} /></div>
          <div><label className="label">Email</label><input className="input" type="email" value={editForm.email || ""} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></div>
          <div><label className="label">Date of Birth</label><input className="input" type="date" value={editForm.dob || ""} onChange={(e) => setEditForm({ ...editForm, dob: e.target.value })} /></div>
          <div>
            <label className="label">Gender</label>
            <select className="input" value={editForm.gender || ""} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}>
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="sm:col-span-2"><label className="label">Address</label><input className="input" value={editForm.address || ""} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} /></div>
          <div><label className="label">Qualification</label><input className="input" value={editForm.qualification || ""} onChange={(e) => setEditForm({ ...editForm, qualification: e.target.value })} /></div>
          <div><label className="label">College Name</label><input className="input" value={editForm.college_name || ""} onChange={(e) => setEditForm({ ...editForm, college_name: e.target.value })} /></div>
          <div><label className="label">Graduation Year</label><input className="input" type="number" value={editForm.graduation_year || ""} onChange={(e) => setEditForm({ ...editForm, graduation_year: e.target.valueAsNumber })} /></div>
          <div>
            <label className="label">Admission Type</label>
            <select className="input" value={editForm.admission_type || "course"} onChange={(e) => setEditForm({ ...editForm, admission_type: e.target.value })}>
              {ADMISSION_TYPES.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
            </select>
          </div>
          <div>
            <label className="label">Course</label>
            <select className="input" value={editForm.course_id || ""} onChange={(e) => setEditForm({ ...editForm, course_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Not set</option>
              {courses.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>
          <div>
            <label className="label">Batch</label>
            <select className="input" value={editForm.batch_id || ""} onChange={(e) => setEditForm({ ...editForm, batch_id: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Not set</option>
              {batches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
            </select>
          </div>
          <div><label className="label">Joining Date</label><input className="input" type="date" value={editForm.joining_date || ""} onChange={(e) => setEditForm({ ...editForm, joining_date: e.target.value })} /></div>
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

      <Modal open={!!docsRow} title={`Documents: ${docsRow?.name || ""}`} onClose={() => setDocsRow(null)} wide>
        {docsRow && <DocumentsManager student={docsRow} />}
      </Modal>
    </div>
  );
}
