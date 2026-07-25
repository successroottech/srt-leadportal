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
                <tr><th>Code</th><th>Name</th><th>Mobile</th><th>Type</th><th>Course Status</th><th>Placement</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td>{s.student_code}</td>
                    <td className="font-medium">{s.name}</td>
                    <td>{s.mobile}</td>
                    <td className="capitalize">{s.admission_type}</td>
                    <td><span className="badge bg-slate-200 text-slate-700">{s.course_status}</span></td>
                    <td>{s.placement_status}</td>
                    <td className="whitespace-nowrap space-x-2">
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
                  <span className="badge bg-slate-200 text-slate-700">{s.course_status}</span>
                </div>
                <p className="text-sm text-slate-500">{s.mobile} <span className="text-slate-400">({s.student_code})</span></p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span className="capitalize">Type: {s.admission_type}</span>
                  <span>Placement: {s.placement_status}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 border-t border-slate-100 pt-2">
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

      <Modal open={addOpen} title="Add Student" onClose={() => setAddOpen(false)} wide>
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
          <div><label className="label">Number of EMIs</label><input className="input" type="number" value={addForm.number_of_emis} onChange={(e) => setAddForm({ ...addForm, number_of_emis: e.target.valueAsNumber })} /></div>
          <div className="sm:col-span-2"><label className="label">Student Login Password</label><input className="input" value={addForm.password} onChange={(e) => setAddForm({ ...addForm, password: e.target.value })} placeholder="Default: Welcome@123" /></div>
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Save Student</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!transferRow} title={`Transfer Batch: ${transferRow?.name || ""}`} onClose={() => setTransferRow(null)}>
        <form onSubmit={submitTransfer} className="space-y-3">
          <select className="input" required value={transferBatch} onChange={(e) => setTransferBatch(e.target.value)}>
            <option value="">Select new batch</option>
            {batches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
          </select>
          <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setTransferRow(null)}>Cancel</button><button type="submit" className="btn-primary">Transfer</button></div>
        </form>
      </Modal>

      <Modal open={!!editRow} title={`Edit: ${editRow?.name || ""}`} onClose={() => setEditRow(null)} wide>
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
    </div>
  );
}
