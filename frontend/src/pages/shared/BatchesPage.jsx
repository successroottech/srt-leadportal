import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "../../api/client";
import { exportCsv } from "../../utils/exportCsv";
import Modal from "../../components/Modal";

const MODES = ["offline", "online", "hybrid"];
const STATUSES = ["upcoming", "active", "on_hold", "completed", "cancelled"];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function BatchesPage({ allowManage = false }) {
  const [rows, setRows] = useState([]);
  const [courses, setCourses] = useState([]);
  const [trainers, setTrainers] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    name: "", course_id: "", trainer_id: "", start_date: "", expected_completion_date: "",
    batch_start_time: "", batch_end_time: "", class_days: "", batch_mode: "offline", location: "",
  });

  const [detailBatch, setDetailBatch] = useState(null);
  const [topics, setTopics] = useState([]);
  const [progress, setProgress] = useState(null);
  const [students, setStudents] = useState([]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/batches");
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
    if (allowManage) {
      api.get("/staff", { params: { role: "trainer" } }).then((res) => setTrainers(res.data)).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitAdd(e) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/batches", { ...addForm, trainer_id: addForm.trainer_id || null });
      setAddOpen(false);
      setAddForm({
        name: "", course_id: "", trainer_id: "", start_date: "", expected_completion_date: "",
        batch_start_time: "", batch_end_time: "", class_days: "", batch_mode: "offline", location: "",
      });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function updateStatus(row, status) {
    try {
      await api.put(`/batches/${row.id}`, { status });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function openDetail(row) {
    setDetailBatch(row);
    try {
      const [t, p, s] = await Promise.all([
        api.get(`/batches/${row.id}/topics`),
        api.get(`/batches/${row.id}/progress`),
        api.get(`/batches/${row.id}/students`),
      ]);
      setTopics(t.data);
      setProgress(p.data);
      setStudents(s.data);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function updateTopic(topic, updates) {
    try {
      await api.put(`/batches/${detailBatch.id}/topics/${topic.id}`, updates);
      const [t, p] = await Promise.all([
        api.get(`/batches/${detailBatch.id}/topics`),
        api.get(`/batches/${detailBatch.id}/progress`),
      ]);
      setTopics(t.data);
      setProgress(p.data);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-xl font-bold text-navy-900">{allowManage ? "Batches" : "My Batches"}</h1>
        {allowManage && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="btn-secondary"
              onClick={() =>
                exportCsv(
                  rows,
                  [
                    { key: "batch_code", label: "Code" }, { key: "name", label: "Name" }, { key: "batch_mode", label: "Mode" },
                    { key: "start_date", label: "Start Date" }, { key: "expected_completion_date", label: "Expected Completion" },
                    { key: "batch_start_time", label: "Start Time" }, { key: "batch_end_time", label: "End Time" }, { key: "status", label: "Status" },
                  ],
                  "batches"
                )
              }
            >
              Export
            </button>
            <button className="btn-gold" onClick={() => setAddOpen(true)}>+ New Batch</button>
          </div>
        )}
      </div>
      {error && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <p className="text-center text-slate-400 py-6">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-center text-slate-400 py-6">No batches found</p>
      ) : (
        <>
          <div className="hidden sm:block card overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr><th>Code</th><th>Name</th><th>Mode</th><th>Start Date</th><th>Status</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.id}>
                    <td>{b.batch_code}</td>
                    <td className="font-medium">{b.name}</td>
                    <td>{b.batch_mode}</td>
                    <td>{b.start_date || "—"}</td>
                    <td>
                      {allowManage ? (
                        <select className="input !w-32 !py-1" value={b.status} onChange={(e) => updateStatus(b, e.target.value)}>
                          {STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
                        </select>
                      ) : (
                        <span className="badge bg-slate-200 text-slate-700">{b.status}</span>
                      )}
                    </td>
                    <td>
                      <button className="text-navy-700 hover:underline text-xs font-medium" onClick={() => openDetail(b)}>
                        View Progress
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sm:hidden space-y-2">
            {rows.map((b) => (
              <div key={b.id} className="card p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-navy-900">{b.name}</p>
                  {allowManage ? (
                    <select className="input !w-28 !py-1 !text-xs" value={b.status} onChange={(e) => updateStatus(b, e.target.value)}>
                      {STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
                    </select>
                  ) : (
                    <span className="badge bg-slate-200 text-slate-700">{b.status}</span>
                  )}
                </div>
                <p className="text-sm text-slate-500">{b.batch_code}</p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>Mode: {b.batch_mode}</span>
                  <span>Start: {b.start_date || "—"}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 border-t border-slate-100 pt-2">
                  <button className="text-navy-700 hover:underline text-xs font-medium" onClick={() => openDetail(b)}>
                    View Progress
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal open={addOpen} title="New Batch" onClose={() => setAddOpen(false)}>
        <form onSubmit={submitAdd} className="space-y-3">
          <div><label className="label">Batch Name</label><input className="input" required value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} /></div>
          <div>
            <label className="label">Course</label>
            <select className="input" required value={addForm.course_id} onChange={(e) => setAddForm({ ...addForm, course_id: e.target.value })}>
              <option value="">Select course</option>
              {courses.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>
          <div>
            <label className="label">Trainer</label>
            <select className="input" value={addForm.trainer_id} onChange={(e) => setAddForm({ ...addForm, trainer_id: e.target.value })}>
              <option value="">Select trainer</option>
              {trainers.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div><label className="label">Start Date</label><input className="input" type="date" value={addForm.start_date} onChange={(e) => setAddForm({ ...addForm, start_date: e.target.value })} /></div>
            <div><label className="label">Expected Completion</label><input className="input" type="date" value={addForm.expected_completion_date} onChange={(e) => setAddForm({ ...addForm, expected_completion_date: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div><label className="label">Batch Start Time</label><input className="input" type="time" value={addForm.batch_start_time} onChange={(e) => setAddForm({ ...addForm, batch_start_time: e.target.value })} /></div>
            <div><label className="label">Batch End Time</label><input className="input" type="time" value={addForm.batch_end_time} onChange={(e) => setAddForm({ ...addForm, batch_end_time: e.target.value })} /></div>
          </div>
          <div><label className="label">Class Days</label><input className="input" placeholder="e.g. Mon,Wed,Fri" value={addForm.class_days} onChange={(e) => setAddForm({ ...addForm, class_days: e.target.value })} /></div>
          <div>
            <label className="label">Mode</label>
            <select className="input" value={addForm.batch_mode} onChange={(e) => setAddForm({ ...addForm, batch_mode: e.target.value })}>
              {MODES.map((m) => (<option key={m} value={m}>{m}</option>))}
            </select>
          </div>
          <div><label className="label">Location</label><input className="input" value={addForm.location} onChange={(e) => setAddForm({ ...addForm, location: e.target.value })} /></div>
          <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button><button type="submit" className="btn-primary">Save</button></div>
        </form>
      </Modal>

      <Modal open={!!detailBatch} title={`Batch: ${detailBatch?.name || ""}`} onClose={() => setDetailBatch(null)} wide>
        {progress && (
          <div className="mb-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
            <div className="card p-2"><p className="font-bold text-lg">{progress.total_topics}</p><p>Total Topics</p></div>
            <div className="card p-2"><p className="font-bold text-lg text-emerald-600">{progress.completed_topics}</p><p>Completed</p></div>
            <div className="card p-2"><p className="font-bold text-lg text-amber-600">{progress.pending_topics}</p><p>Pending</p></div>
            <div className="card p-2"><p className="font-bold text-lg">{progress.completion_percentage}%</p><p>Progress</p></div>
          </div>
        )}
        <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Students ({students.length})</p>
        <div className="flex flex-wrap gap-1 mb-3">
          {students.map((s) => (
            <span key={s.id} className="badge bg-slate-100 text-slate-700">{s.name}</span>
          ))}
        </div>
        <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Syllabus Progress</p>
        <div className="max-h-64 overflow-y-auto space-y-1">
          {topics.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 text-sm bg-slate-50 rounded px-2 py-1">
              <span>{t.module_name} — {t.topic_name}</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  className="input !w-36 !py-1 !text-xs"
                  value={t.actual_completion_date || ""}
                  onChange={(e) => updateTopic(t, { actual_completion_date: e.target.value || null })}
                  title="Completion date"
                />
                <select
                  className="input !w-36 !py-1 !text-xs"
                  value={t.status}
                  onChange={(e) =>
                    updateTopic(t, {
                      status: e.target.value,
                      completion_percentage: e.target.value === "completed" ? 100 : t.completion_percentage,
                      actual_completion_date: e.target.value === "completed" ? (t.actual_completion_date || todayStr()) : t.actual_completion_date,
                    })
                  }
                >
                  <option value="not_started">not started</option>
                  <option value="in_progress">in progress</option>
                  <option value="completed">completed</option>
                  <option value="rescheduled">rescheduled</option>
                  <option value="skipped">skipped</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
