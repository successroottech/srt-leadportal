import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "../../api/client";
import Modal from "../../components/Modal";

const TYPES = ["course_feedback", "trainer_feedback", "facility_feedback", "general_complaint", "technical_complaint", "fee_complaint"];

export default function MyFeedback() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: "course_feedback", subject: "", description: "", rating: 5 });

  async function load() {
    const { data } = await api.get("/feedback/me");
    setRows(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/feedback", form);
      setOpen(false);
      setForm({ type: "course_feedback", subject: "", description: "", rating: 5 });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-xl font-bold text-navy-900">Feedback & Complaints</h1>
        <button className="btn-gold" onClick={() => setOpen(true)}>+ Submit</button>
      </div>
      {error && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-slate-400 text-sm">You haven't submitted any feedback yet.</p>
        ) : (
          rows.map((f) => (
            <div key={f.id} className="card p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium text-navy-900">{f.subject}</p>
                <span className="badge bg-slate-200 text-slate-700">{f.status.replace("_", " ")}</span>
              </div>
              <p className="text-sm text-slate-500">{f.description}</p>
              {f.admin_response && <p className="text-xs mt-1 text-emerald-700">Response: {f.admin_response}</p>}
            </div>
          ))
        )}
      </div>

      <Modal open={open} title="Submit Feedback / Complaint" onClose={() => setOpen(false)}>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {TYPES.map((t) => (<option key={t} value={t}>{t.replace(/_/g, " ")}</option>))}
            </select>
          </div>
          <div><label className="label">Subject</label><input className="input" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
          <div><label className="label">Description</label><textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div>
            <label className="label">Rating</label>
            <select className="input" value={form.rating} onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}>
              {[5, 4, 3, 2, 1].map((r) => (<option key={r} value={r}>{"★".repeat(r)}</option>))}
            </select>
          </div>
          <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button><button type="submit" className="btn-primary">Submit</button></div>
        </form>
      </Modal>
    </div>
  );
}
