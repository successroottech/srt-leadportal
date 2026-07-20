import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "../../api/client";
import Modal from "../../components/Modal";

const STATUS_OPTIONS = [
  "new", "assigned", "contacted", "documents_pending", "training_required", "training_in_progress",
  "ready_for_interview", "interview_scheduled", "selected", "rejected", "joined", "on_hold", "closed",
];

export default function CandidatesPage({ allowManage = false }) {
  const [rows, setRows] = useState([]);
  const [telecallers, setTelecallers] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", mobile: "", email: "", qualification: "", skills: "", preferred_job_role: "", preferred_location: "" });

  const [editRow, setEditRow] = useState(null);
  const [editForm, setEditForm] = useState({});

  const [assignRow, setAssignRow] = useState(null);
  const [assignTo, setAssignTo] = useState("");

  const [interviewRow, setInterviewRow] = useState(null);
  const [interviewForm, setInterviewForm] = useState({ interview_date: "", company: "", job_role: "", status: "scheduled" });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/candidates", { params: statusFilter ? { status: statusFilter } : {} });
      setRows(data);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    if (allowManage) {
      api.get("/staff", { params: { role: "telecaller" } }).then((res) => setTelecallers(res.data)).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function submitAdd(e) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/candidates", addForm);
      setAddOpen(false);
      setAddForm({ name: "", mobile: "", email: "", qualification: "", skills: "", preferred_job_role: "", preferred_location: "" });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  function openEdit(row) {
    setEditRow(row);
    setEditForm({ status: row.status, follow_up_date: row.follow_up_date || "", remarks: row.remarks || "" });
  }

  async function submitEdit(e) {
    e.preventDefault();
    try {
      await api.put(`/candidates/${editRow.id}`, editForm);
      setEditRow(null);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function submitAssign(e) {
    e.preventDefault();
    try {
      await api.post("/candidates/bulk-assign", { candidate_ids: [assignRow.id], telecaller_id: Number(assignTo) });
      setAssignRow(null);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function submitInterview(e) {
    e.preventDefault();
    try {
      await api.post(`/candidates/${interviewRow.id}/interviews`, interviewForm);
      setInterviewRow(null);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-xl font-bold text-navy-900">Candidates</h1>
        <div className="flex items-center gap-2">
          <select className="input !w-48" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
          <button className="btn-gold" onClick={() => setAddOpen(true)}>+ New Candidate</button>
        </div>
      </div>
      {error && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="card overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>Code</th><th>Name</th><th>Mobile</th><th>Preferred Role</th><th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center text-slate-400 py-6">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-slate-400 py-6">No candidates found</td></tr>
            ) : (
              rows.map((c) => (
                <tr key={c.id}>
                  <td>{c.candidate_code}</td>
                  <td className="font-medium">{c.name}</td>
                  <td>{c.mobile}</td>
                  <td>{c.preferred_job_role || "—"}</td>
                  <td><span className="badge bg-slate-200 text-slate-700">{c.status.replace(/_/g, " ")}</span></td>
                  <td className="whitespace-nowrap space-x-2">
                    <button className="text-navy-700 hover:underline text-xs font-medium" onClick={() => openEdit(c)}>Update</button>
                    {allowManage && (
                      <button className="text-amber-700 hover:underline text-xs font-medium" onClick={() => { setAssignRow(c); setAssignTo(""); }}>Assign</button>
                    )}
                    <button className="text-navy-700 hover:underline text-xs font-medium" onClick={() => { setInterviewRow(c); setInterviewForm({ interview_date: "", company: "", job_role: "", status: "scheduled" }); }}>
                      Interview
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={addOpen} title="New Candidate" onClose={() => setAddOpen(false)}>
        <form onSubmit={submitAdd} className="space-y-3">
          <div><label className="label">Name</label><input className="input" required value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} /></div>
          <div><label className="label">Mobile</label><input className="input" required value={addForm.mobile} onChange={(e) => setAddForm({ ...addForm, mobile: e.target.value })} /></div>
          <div><label className="label">Email</label><input className="input" type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} /></div>
          <div><label className="label">Qualification</label><input className="input" value={addForm.qualification} onChange={(e) => setAddForm({ ...addForm, qualification: e.target.value })} /></div>
          <div><label className="label">Skills</label><input className="input" value={addForm.skills} onChange={(e) => setAddForm({ ...addForm, skills: e.target.value })} /></div>
          <div><label className="label">Preferred Job Role</label><input className="input" value={addForm.preferred_job_role} onChange={(e) => setAddForm({ ...addForm, preferred_job_role: e.target.value })} /></div>
          <div><label className="label">Preferred Location</label><input className="input" value={addForm.preferred_location} onChange={(e) => setAddForm({ ...addForm, preferred_location: e.target.value })} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Save</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editRow} title={`Update: ${editRow?.name || ""}`} onClose={() => setEditRow(null)}>
        <form onSubmit={submitEdit} className="space-y-3">
          <div>
            <label className="label">Status</label>
            <select className="input" value={editForm.status || ""} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
              {STATUS_OPTIONS.map((s) => (<option key={s} value={s}>{s.replace(/_/g, " ")}</option>))}
            </select>
          </div>
          <div><label className="label">Follow-up Date</label><input className="input" type="date" value={editForm.follow_up_date || ""} onChange={(e) => setEditForm({ ...editForm, follow_up_date: e.target.value })} /></div>
          <div><label className="label">Remarks</label><textarea className="input" rows={2} value={editForm.remarks || ""} onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })} /></div>
          <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setEditRow(null)}>Cancel</button><button type="submit" className="btn-primary">Save</button></div>
        </form>
      </Modal>

      <Modal open={!!assignRow} title={`Assign: ${assignRow?.name || ""}`} onClose={() => setAssignRow(null)}>
        <form onSubmit={submitAssign} className="space-y-3">
          <select className="input" required value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
            <option value="">Select telecaller</option>
            {telecallers.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
          </select>
          <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setAssignRow(null)}>Cancel</button><button type="submit" className="btn-primary">Assign</button></div>
        </form>
      </Modal>

      <Modal open={!!interviewRow} title={`Schedule Interview: ${interviewRow?.name || ""}`} onClose={() => setInterviewRow(null)}>
        <form onSubmit={submitInterview} className="space-y-3">
          <div><label className="label">Interview Date</label><input className="input" type="date" value={interviewForm.interview_date} onChange={(e) => setInterviewForm({ ...interviewForm, interview_date: e.target.value })} /></div>
          <div><label className="label">Company</label><input className="input" value={interviewForm.company} onChange={(e) => setInterviewForm({ ...interviewForm, company: e.target.value })} /></div>
          <div><label className="label">Job Role</label><input className="input" value={interviewForm.job_role} onChange={(e) => setInterviewForm({ ...interviewForm, job_role: e.target.value })} /></div>
          <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setInterviewRow(null)}>Cancel</button><button type="submit" className="btn-primary">Save</button></div>
        </form>
      </Modal>
    </div>
  );
}
