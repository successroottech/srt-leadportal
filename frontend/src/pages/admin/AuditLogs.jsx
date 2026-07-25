import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "../../api/client";

export default function AuditLogs() {
  const [rows, setRows] = useState([]);
  const [module, setModule] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const { data } = await api.get("/audit-logs", { params: module ? { module } : {} });
      setRows(data);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-xl font-bold text-navy-900">Audit Logs</h1>
        <input className="input w-full sm:!w-48" placeholder="Filter by module" value={module} onChange={(e) => setModule(e.target.value)} />
      </div>
      {error && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="card overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr><th>When</th><th>User</th><th>Action</th><th>Module</th><th>Record</th><th>IP</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-slate-400 py-6">No audit entries</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.created_at).toLocaleString()}</td>
                  <td>{r.user_id ? `Staff #${r.user_id}` : r.student_id ? `Student #${r.student_id}` : "—"}</td>
                  <td><span className="badge bg-slate-200 text-slate-700">{r.action}</span></td>
                  <td>{r.module}</td>
                  <td>{r.record_id ?? "—"}</td>
                  <td>{r.ip_address ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
