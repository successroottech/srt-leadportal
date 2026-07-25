import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "../../api/client";
import Modal from "../../components/Modal";

const LEAVE_TYPES = ["casual", "sick", "paid", "unpaid", "emergency", "half_day"];
const PERMISSION_TYPES = ["late_arrival", "early_departure", "personal", "official"];

export default function StaffLeaveSelf({ studentMode = false }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ request_kind: "leave", leave_type: "casual", permission_type: "", start_date: "", end_date: "", reason: "" });

  const basePath = studentMode ? "/leave/student" : "/leave/staff";

  async function load() {
    try {
      const { data } = await api.get(`${basePath}/me`);
      setRows(data);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError("");
    try {
      const payload = { ...form };
      if (payload.request_kind === "leave") delete payload.permission_type;
      else delete payload.leave_type;
      await api.post(basePath, payload);
      setOpen(false);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  const STATUS_COLORS = { pending: "bg-amber-100 text-amber-700", approved: "bg-emerald-100 text-emerald-700", rejected: "bg-red-100 text-red-700" };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-xl font-bold text-navy-900">Leave & Permission</h1>
        <button className="btn-gold" onClick={() => setOpen(true)}>+ Apply</button>
      </div>
      {error && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="card overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr><th>Kind</th><th>Type</th><th>From</th><th>To</th><th>Reason</th><th>Status</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-slate-400 py-6">No requests yet</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.request_kind}</td>
                  <td>{r.leave_type || r.permission_type || "—"}</td>
                  <td>{r.start_date}</td>
                  <td>{r.end_date}</td>
                  <td>{r.reason}</td>
                  <td><span className={`badge ${STATUS_COLORS[r.status]}`}>{r.status}</span></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={open} title="Apply Leave / Permission" onClose={() => setOpen(false)}>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="label">Kind</label>
            <select className="input" value={form.request_kind} onChange={(e) => setForm({ ...form, request_kind: e.target.value })}>
              <option value="leave">Leave</option>
              <option value="permission">Permission</option>
            </select>
          </div>
          {form.request_kind === "leave" ? (
            <div>
              <label className="label">Leave Type</label>
              <select className="input" value={form.leave_type} onChange={(e) => setForm({ ...form, leave_type: e.target.value })}>
                {LEAVE_TYPES.map((t) => (<option key={t} value={t}>{t.replace("_", " ")}</option>))}
              </select>
            </div>
          ) : (
            <div>
              <label className="label">Permission Type</label>
              <select className="input" value={form.permission_type} onChange={(e) => setForm({ ...form, permission_type: e.target.value })}>
                <option value="">Select</option>
                {PERMISSION_TYPES.map((t) => (<option key={t} value={t}>{t.replace("_", " ")}</option>))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div><label className="label">Start Date</label><input className="input" type="date" required value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
            <div><label className="label">End Date</label><input className="input" type="date" required value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
          </div>
          <div><label className="label">Reason</label><textarea className="input" rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
          <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button><button type="submit" className="btn-primary">Submit</button></div>
        </form>
      </Modal>
    </div>
  );
}
