import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "../../api/client";
import Modal from "../../components/Modal";

const STATUSES = ["submitted", "under_review", "in_progress", "resolved", "closed"];

export default function FeedbackAdmin() {
  const [rows, setRows] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");
  const [respondRow, setRespondRow] = useState(null);
  const [form, setForm] = useState({ status: "under_review", admin_response: "" });

  async function load() {
    try {
      const { data } = await api.get("/feedback", { params: statusFilter ? { status: statusFilter } : {} });
      setRows(data);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function submit(e) {
    e.preventDefault();
    try {
      await api.post(`/feedback/${respondRow.id}/respond`, form);
      setRespondRow(null);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-xl font-bold text-navy-900">Feedback & Complaints</h1>
        <select className="input w-full sm:!w-44" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (<option key={s} value={s}>{s.replace("_", " ")}</option>))}
        </select>
      </div>
      {error && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="card overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr><th>Student</th><th>Type</th><th>Subject</th><th>Rating</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-slate-400 py-6">No feedback yet</td></tr>
            ) : (
              rows.map((f) => (
                <tr key={f.id}>
                  <td>#{f.student_id}</td>
                  <td>{f.type.replace(/_/g, " ")}</td>
                  <td>{f.subject}</td>
                  <td>{f.rating ? "★".repeat(f.rating) : "—"}</td>
                  <td><span className="badge bg-slate-200 text-slate-700">{f.status.replace("_", " ")}</span></td>
                  <td>
                    <button
                      className="text-navy-700 hover:underline text-xs font-medium"
                      onClick={() => { setRespondRow(f); setForm({ status: f.status, admin_response: f.admin_response || "" }); }}
                    >
                      Respond
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!respondRow} title="Respond to Feedback" onClose={() => setRespondRow(null)}>
        {respondRow && (
          <div className="mb-3 text-sm text-slate-600">
            <p className="font-medium">{respondRow.subject}</p>
            <p>{respondRow.description}</p>
          </div>
        )}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STATUSES.map((s) => (<option key={s} value={s}>{s.replace("_", " ")}</option>))}
            </select>
          </div>
          <div><label className="label">Response</label><textarea className="input" rows={3} value={form.admin_response} onChange={(e) => setForm({ ...form, admin_response: e.target.value })} /></div>
          <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setRespondRow(null)}>Cancel</button><button type="submit" className="btn-primary">Save</button></div>
        </form>
      </Modal>
    </div>
  );
}
