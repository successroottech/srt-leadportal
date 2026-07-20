import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "../../api/client";
import Modal from "../../components/Modal";

export default function StudentsPage() {
  const [rows, setRows] = useState([]);
  const [courses, setCourses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "", mobile: "", email: "", course_id: "", batch_id: "",
    total_course_fee: 0, discount: 0, initial_payment: 0, number_of_emis: 0, password: "",
  });

  const [transferRow, setTransferRow] = useState(null);
  const [transferBatch, setTransferBatch] = useState("");

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
      setAddForm({ name: "", mobile: "", email: "", course_id: "", batch_id: "", total_course_fee: 0, discount: 0, initial_payment: 0, number_of_emis: 0, password: "" });
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

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-xl font-bold text-navy-900">Students</h1>
        <div className="flex items-center gap-2">
          <input className="input !w-56" placeholder="Search name/mobile/code" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
          <button className="btn-secondary" onClick={load}>Search</button>
          <button className="btn-gold" onClick={() => setAddOpen(true)}>+ Add Student</button>
        </div>
      </div>
      {error && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="card overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr><th>Code</th><th>Name</th><th>Mobile</th><th>Course Status</th><th>Placement</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center text-slate-400 py-6">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-slate-400 py-6">No students found</td></tr>
            ) : (
              rows.map((s) => (
                <tr key={s.id}>
                  <td>{s.student_code}</td>
                  <td className="font-medium">{s.name}</td>
                  <td>{s.mobile}</td>
                  <td><span className="badge bg-slate-200 text-slate-700">{s.course_status}</span></td>
                  <td>{s.placement_status}</td>
                  <td className="whitespace-nowrap space-x-2">
                    <button className="text-navy-700 hover:underline text-xs font-medium" onClick={() => { setTransferRow(s); setTransferBatch(""); }}>
                      Transfer Batch
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={addOpen} title="Add Student" onClose={() => setAddOpen(false)} wide>
        <form onSubmit={submitAdd} className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="label">Name</label><input className="input" required value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} /></div>
          <div><label className="label">Mobile</label><input className="input" required value={addForm.mobile} onChange={(e) => setAddForm({ ...addForm, mobile: e.target.value })} /></div>
          <div><label className="label">Email</label><input className="input" type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} /></div>
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
          <div><label className="label">Total Course Fee</label><input className="input" type="number" value={addForm.total_course_fee} onChange={(e) => setAddForm({ ...addForm, total_course_fee: e.target.valueAsNumber })} /></div>
          <div><label className="label">Discount</label><input className="input" type="number" value={addForm.discount} onChange={(e) => setAddForm({ ...addForm, discount: e.target.valueAsNumber })} /></div>
          <div><label className="label">Initial Payment</label><input className="input" type="number" value={addForm.initial_payment} onChange={(e) => setAddForm({ ...addForm, initial_payment: e.target.valueAsNumber })} /></div>
          <div><label className="label">Number of EMIs</label><input className="input" type="number" value={addForm.number_of_emis} onChange={(e) => setAddForm({ ...addForm, number_of_emis: e.target.valueAsNumber })} /></div>
          <div className="col-span-2"><label className="label">Student Login Password</label><input className="input" value={addForm.password} onChange={(e) => setAddForm({ ...addForm, password: e.target.value })} placeholder="Default: Welcome@123" /></div>
          <div className="col-span-2 flex justify-end gap-2 pt-2">
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
    </div>
  );
}
