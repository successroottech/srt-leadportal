import { useEffect, useRef, useState } from "react";
import { api, apiErrorMessage } from "../../api/client";
import { exportCsv } from "../../utils/exportCsv";
import Modal from "../../components/Modal";

const STATUS_OPTIONS = [
  "new", "assigned", "contacted", "documents_pending", "training_required", "training_in_progress",
  "ready_for_interview", "interview_scheduled", "selected", "rejected", "joined", "on_hold", "closed",
];

export default function CandidatesPage({ allowManage = false }) {
  const [rows, setRows] = useState([]);
  const [telecallers, setTelecallers] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", mobile: "", email: "", qualification: "", skills: "", preferred_job_role: "", preferred_location: "" });

  const [editRow, setEditRow] = useState(null);
  const [editForm, setEditForm] = useState({});

  const [assignRow, setAssignRow] = useState(null);
  const [assignTo, setAssignTo] = useState("");

  const [selectedIds, setSelectedIds] = useState([]);
  const [trainerAssignOpen, setTrainerAssignOpen] = useState(false);
  const [trainerAssignTo, setTrainerAssignTo] = useState("");

  const trainerById = Object.fromEntries(trainers.map((t) => [t.id, t.name]));

  function toggleSelect(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => (prev.length === rows.length ? [] : rows.map((r) => r.id)));
  }

  async function submitTrainerAssign(e) {
    e.preventDefault();
    try {
      await api.post("/candidates/bulk-assign-trainer", { candidate_ids: selectedIds, trainer_id: Number(trainerAssignTo) });
      setTrainerAssignOpen(false);
      setSelectedIds([]);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  const [interviewRow, setInterviewRow] = useState(null);
  const [interviewForm, setInterviewForm] = useState({ interview_date: "", company: "", job_role: "", status: "scheduled" });

  const fileInputRef = useRef(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploading, setUploading] = useState(false);

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
    api.get("/staff", { params: { role: "trainer" } }).then((res) => setTrainers(res.data)).catch(() => {});
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

  async function handleBulkUploadFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post("/candidates/bulk-upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
      setUploadResult(data);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleExport() {
    exportCsv(
      rows,
      [
        { key: "candidate_code", label: "Code" },
        { key: "name", label: "Name" },
        { key: "mobile", label: "Mobile" },
        { key: "email", label: "Email" },
        { key: "preferred_job_role", label: "Preferred Role" },
        { key: "status", label: "Status" },
        { key: "follow_up_date", label: "Follow-up Date" },
      ],
      "candidates"
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-xl font-bold text-navy-900">Candidates</h1>
        <div className="flex flex-wrap items-center gap-2">
          <select className="input w-full sm:!w-48" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
          {allowManage && (
            <>
              <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleBulkUploadFile} />
              <button className="btn-secondary" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                {uploading ? "Uploading..." : "Bulk Upload (CSV)"}
              </button>
              <button className="btn-secondary" onClick={handleExport}>Export</button>
            </>
          )}
          {selectedIds.length > 0 && (
            <button className="btn-secondary" onClick={() => { setTrainerAssignTo(""); setTrainerAssignOpen(true); }}>
              Bulk Assign Trainer ({selectedIds.length})
            </button>
          )}
          <button className="btn-gold" onClick={() => setAddOpen(true)}>+ New Candidate</button>
        </div>
      </div>
      {error && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {uploadResult && (
        <div className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Uploaded: {uploadResult.created} created, {uploadResult.skipped_duplicates} duplicates skipped.
          {uploadResult.errors?.length > 0 && ` ${uploadResult.errors.length} row(s) had errors: ${uploadResult.errors.slice(0, 3).join("; ")}`}
        </div>
      )}

      {loading ? (
        <p className="text-center text-slate-400 py-6">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-center text-slate-400 py-6">No candidates found</p>
      ) : (
        <>
          <div className="hidden sm:block card overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th><input type="checkbox" checked={rows.length > 0 && selectedIds.length === rows.length} onChange={toggleSelectAll} /></th>
                  <th>Code</th><th>Name</th><th>Mobile</th><th>Preferred Role</th><th>Status</th><th>Trainer</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td><input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggleSelect(c.id)} /></td>
                    <td>{c.candidate_code}</td>
                    <td className="font-medium">{c.name}</td>
                    <td>{c.mobile}</td>
                    <td>{c.preferred_job_role || "—"}</td>
                    <td><span className="badge bg-slate-200 text-slate-700">{c.status.replace(/_/g, " ")}</span></td>
                    <td>{trainerById[c.assigned_trainer_id] || "—"}</td>
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
                ))}
              </tbody>
            </table>
          </div>

          <div className="sm:hidden space-y-2">
            {rows.map((c) => (
              <div key={c.id} className="card p-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggleSelect(c.id)} />
                    <p className="font-medium text-navy-900">{c.name}</p>
                  </label>
                  <span className="badge bg-slate-200 text-slate-700">{c.status.replace(/_/g, " ")}</span>
                </div>
                <p className="text-sm text-slate-500">{c.mobile} <span className="text-slate-400">({c.candidate_code})</span></p>
                <p className="mt-1 text-xs text-slate-500">Preferred role: {c.preferred_job_role || "—"}</p>
                <p className="mt-1 text-xs text-slate-500">Trainer: {trainerById[c.assigned_trainer_id] || "—"}</p>
                <div className="mt-2 flex flex-wrap gap-3 border-t border-slate-100 pt-2">
                  <button className="text-navy-700 hover:underline text-xs font-medium" onClick={() => openEdit(c)}>Update</button>
                  {allowManage && (
                    <button className="text-amber-700 hover:underline text-xs font-medium" onClick={() => { setAssignRow(c); setAssignTo(""); }}>Assign</button>
                  )}
                  <button className="text-navy-700 hover:underline text-xs font-medium" onClick={() => { setInterviewRow(c); setInterviewForm({ interview_date: "", company: "", job_role: "", status: "scheduled" }); }}>
                    Interview
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal open={addOpen} title="New Candidate" onClose={() => setAddOpen(false)} error={error}>
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

      <Modal open={!!editRow} title={`Update: ${editRow?.name || ""}`} onClose={() => setEditRow(null)} error={error}>
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

      <Modal open={!!assignRow} title={`Assign: ${assignRow?.name || ""}`} onClose={() => setAssignRow(null)} error={error}>
        <form onSubmit={submitAssign} className="space-y-3">
          <select className="input" required value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
            <option value="">Select telecaller</option>
            {telecallers.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
          </select>
          <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setAssignRow(null)}>Cancel</button><button type="submit" className="btn-primary">Assign</button></div>
        </form>
      </Modal>

      <Modal open={trainerAssignOpen} title={`Bulk Assign Trainer (${selectedIds.length} candidate${selectedIds.length === 1 ? "" : "s"})`} onClose={() => setTrainerAssignOpen(false)} error={error}>
        <form onSubmit={submitTrainerAssign} className="space-y-3">
          <select className="input" required value={trainerAssignTo} onChange={(e) => setTrainerAssignTo(e.target.value)}>
            <option value="">Select trainer</option>
            {trainers.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
          </select>
          <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setTrainerAssignOpen(false)}>Cancel</button><button type="submit" className="btn-primary">Assign</button></div>
        </form>
      </Modal>

      <Modal open={!!interviewRow} title={`Schedule Interview: ${interviewRow?.name || ""}`} onClose={() => setInterviewRow(null)} error={error}>
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
