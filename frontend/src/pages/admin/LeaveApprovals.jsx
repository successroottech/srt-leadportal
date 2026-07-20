import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "../../api/client";

export default function LeaveApprovals() {
  const [rows, setRows] = useState([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [error, setError] = useState("");

  async function load() {
    try {
      const { data } = await api.get("/leave", { params: statusFilter ? { status: statusFilter } : {} });
      setRows(data);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  async function decide(row, status) {
    const remarks = window.prompt(`Remarks for ${status} (optional):`) || "";
    try {
      await api.post(`/leave/${row.id}/decision`, { status, approval_remarks: remarks });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-navy-900">Leave & Permission Approvals</h1>
        <select className="input !w-40" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
      {error && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="card overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr><th>Requester</th><th>Kind</th><th>Type</th><th>From</th><th>To</th><th>Reason</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="text-center text-slate-400 py-6">No requests</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.user_id ? `Staff #${r.user_id}` : `Student #${r.student_id}`}</td>
                  <td>{r.request_kind}</td>
                  <td>{r.leave_type || r.permission_type || "—"}</td>
                  <td>{r.start_date}</td>
                  <td>{r.end_date}</td>
                  <td>{r.reason}</td>
                  <td><span className="badge bg-slate-200 text-slate-700">{r.status}</span></td>
                  <td className="whitespace-nowrap space-x-2">
                    {r.status === "pending" && (
                      <>
                        <button className="text-emerald-700 hover:underline text-xs font-medium" onClick={() => decide(r, "approved")}>Approve</button>
                        <button className="text-red-600 hover:underline text-xs font-medium" onClick={() => decide(r, "rejected")}>Reject</button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
