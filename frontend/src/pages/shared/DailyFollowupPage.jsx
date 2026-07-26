import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "../../api/client";
import Modal from "../../components/Modal";

const STUDENT_STATUS = ["present", "absent", "late", "leave"];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function DailyFollowupPage({ allowManage = false }) {
  const [batches, setBatches] = useState([]);
  const [sessions, setSessions] = useState({}); // batch_id -> today's session or null
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [attendanceBatch, setAttendanceBatch] = useState(null);
  const [students, setStudents] = useState([]);
  const [attendanceForm, setAttendanceForm] = useState({});

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/batches", { params: { status: "active" } });
      setBatches(data);
      const today = todayStr();
      const results = {};
      await Promise.all(
        data.map(async (b) => {
          try {
            const { data: sess } = await api.get(`/batches/${b.id}/sessions`);
            results[b.id] = sess.find((s) => s.class_date === today) || null;
          } catch {
            results[b.id] = null;
          }
        })
      );
      setSessions(results);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function classState(batch) {
    const session = sessions[batch.id];
    if (!session) return "not_logged";
    if (session.status === "missed" || session.status === "cancelled") return "missed";
    if (session.actual_end_time) return "completed";
    if (session.actual_start_time) return "running";
    return "scheduled";
  }

  const STATE_LABELS = {
    not_logged: { label: "Not logged", color: "bg-slate-200 text-slate-700" },
    scheduled: { label: "Scheduled", color: "bg-slate-200 text-slate-700" },
    running: { label: "Running", color: "bg-emerald-100 text-emerald-700" },
    completed: { label: "Completed", color: "bg-navy-100 text-navy-800" },
    missed: { label: "Missed", color: "bg-red-100 text-red-700" },
  };

  async function ensureSession(batch) {
    let session = sessions[batch.id];
    if (session) return session;
    try {
      const { data } = await api.post(`/batches/${batch.id}/sessions`, {
        class_date: todayStr(),
        planned_start_time: batch.batch_start_time || null,
        planned_end_time: batch.batch_end_time || null,
      });
      setSessions((prev) => ({ ...prev, [batch.id]: data }));
      return data;
    } catch (err) {
      setError(apiErrorMessage(err));
      return null;
    }
  }

  async function startClass(batch) {
    const session = await ensureSession(batch);
    if (!session) return;
    try {
      const now = new Date().toTimeString().slice(0, 8);
      const { data } = await api.put(`/batches/${batch.id}/sessions/${session.id}`, { actual_start_time: now });
      setSessions((prev) => ({ ...prev, [batch.id]: data }));
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function endClass(batch) {
    const session = sessions[batch.id];
    if (!session) return;
    try {
      const now = new Date().toTimeString().slice(0, 8);
      const { data } = await api.put(`/batches/${batch.id}/sessions/${session.id}`, { actual_end_time: now, status: "completed" });
      setSessions((prev) => ({ ...prev, [batch.id]: data }));
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function markMissed(batch) {
    const session = await ensureSession(batch);
    if (!session) return;
    try {
      const { data } = await api.put(`/batches/${batch.id}/sessions/${session.id}`, { status: "missed" });
      setSessions((prev) => ({ ...prev, [batch.id]: data }));
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function openAttendance(batch) {
    setAttendanceBatch(batch);
    try {
      const { data } = await api.get(`/batches/${batch.id}/students`);
      setStudents(data);
      const initial = {};
      data.forEach((s) => (initial[s.id] = "present"));
      setAttendanceForm(initial);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function submitAttendance(e) {
    e.preventDefault();
    try {
      const session = sessions[attendanceBatch.id];
      await api.post("/attendance/students/mark", {
        batch_id: attendanceBatch.id,
        attendance_date: todayStr(),
        class_session_id: session?.id || null,
        records: students.map((s) => ({ student_id: s.id, status: attendanceForm[s.id] || "present" })),
      });
      setAttendanceBatch(null);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  function renderRowActions(b, state) {
    return (
      <>
        {(state === "not_logged" || state === "scheduled") && (
          <button className="text-emerald-700 hover:underline text-xs font-medium" onClick={() => startClass(b)}>Start Class</button>
        )}
        {state === "running" && (
          <button className="text-navy-700 hover:underline text-xs font-medium" onClick={() => endClass(b)}>End Class</button>
        )}
        {(state === "not_logged" || state === "scheduled") && (
          <button className="text-red-600 hover:underline text-xs font-medium" onClick={() => markMissed(b)}>Mark Missed</button>
        )}
        <button className="text-amber-700 hover:underline text-xs font-medium" onClick={() => openAttendance(b)}>Mark Attendance</button>
      </>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-navy-900 mb-4">Daily Batch Follow-up</h1>
      {error && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <p className="text-center text-slate-400 py-6">Loading...</p>
      ) : batches.length === 0 ? (
        <p className="text-center text-slate-400 py-6">No active batches today</p>
      ) : (
        <>
          <div className="hidden sm:block card overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Batch</th><th>Scheduled Time</th><th>Status</th>
                  {allowManage && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => {
                  const state = classState(b);
                  const meta = STATE_LABELS[state];
                  return (
                    <tr key={b.id}>
                      <td className="font-medium">{b.name}</td>
                      <td>{b.batch_start_time || "—"} - {b.batch_end_time || "—"}</td>
                      <td><span className={`badge ${meta.color}`}>{meta.label}</span></td>
                      {allowManage && (
                        <td className="whitespace-nowrap space-x-2">{renderRowActions(b, state)}</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="sm:hidden space-y-2">
            {batches.map((b) => {
              const state = classState(b);
              const meta = STATE_LABELS[state];
              return (
                <div key={b.id} className="card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-navy-900">{b.name}</p>
                    <span className={`badge ${meta.color}`}>{meta.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{b.batch_start_time || "—"} - {b.batch_end_time || "—"}</p>
                  {allowManage && (
                    <div className="mt-2 flex flex-wrap gap-3 border-t border-slate-100 pt-2">{renderRowActions(b, state)}</div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <Modal open={!!attendanceBatch} title={`Attendance: ${attendanceBatch?.name || ""}`} onClose={() => setAttendanceBatch(null)} wide error={error}>
        <form onSubmit={submitAttendance} className="space-y-3">
          <div className="max-h-80 overflow-y-auto space-y-1">
            {students.length === 0 ? (
              <p className="text-sm text-slate-400">No students in this batch.</p>
            ) : (
              students.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-sm bg-slate-50 rounded px-2 py-1.5">
                  <span>{s.name} <span className="text-slate-400">({s.student_code})</span></span>
                  <select
                    className="input !w-32 !py-1 !text-xs"
                    value={attendanceForm[s.id] || "present"}
                    onChange={(e) => setAttendanceForm({ ...attendanceForm, [s.id]: e.target.value })}
                  >
                    {STUDENT_STATUS.map((st) => (<option key={st} value={st}>{st}</option>))}
                  </select>
                </div>
              ))
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setAttendanceBatch(null)}>Cancel</button>
            <button type="submit" className="btn-primary">Save Attendance</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
