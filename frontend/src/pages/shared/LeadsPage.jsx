import { useEffect, useMemo, useState } from "react";
import { api, apiErrorMessage } from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import Modal from "../../components/Modal";

const STATUS_OPTIONS = [
  "new", "assigned", "contacted", "interested", "follow_up", "demo_scheduled", "demo_completed",
  "admission_confirmed", "converted", "not_interested", "invalid_number", "no_response", "closed",
];
const SOURCE_OPTIONS = [
  "website", "google_ads", "facebook", "instagram", "linkedin", "whatsapp", "walk_in",
  "reference", "justdial", "indiamart", "other",
];

const STATUS_COLORS = {
  new: "bg-slate-200 text-slate-700",
  assigned: "bg-blue-100 text-blue-700",
  contacted: "bg-indigo-100 text-indigo-700",
  interested: "bg-amber-100 text-amber-700",
  follow_up: "bg-amber-100 text-amber-700",
  demo_scheduled: "bg-purple-100 text-purple-700",
  demo_completed: "bg-purple-100 text-purple-700",
  admission_confirmed: "bg-emerald-100 text-emerald-700",
  converted: "bg-emerald-200 text-emerald-800",
  not_interested: "bg-red-100 text-red-700",
  invalid_number: "bg-red-100 text-red-700",
  no_response: "bg-slate-200 text-slate-700",
  closed: "bg-slate-200 text-slate-700",
};

export default function LeadsPage({ todayOnly = false, allowManage = false }) {
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [courses, setCourses] = useState([]);
  const [telecallers, setTelecallers] = useState([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: "", mobile: "", email: "", interested_course_id: "", source: "website", remarks: "" });
  const [duplicateInfo, setDuplicateInfo] = useState(null);

  const [detailLead, setDetailLead] = useState(null);
  const [followupForm, setFollowupForm] = useState({ status: "", followup_date: "", followup_time: "", remarks: "" });
  const [followups, setFollowups] = useState([]);

  const [assignLead, setAssignLead] = useState(null);
  const [assignTo, setAssignTo] = useState("");

  const [convertLead, setConvertLead] = useState(null);
  const [convertForm, setConvertForm] = useState({ total_course_fee: 0, discount: 0, initial_payment: 0, number_of_emis: 0, password: "" });

  async function load() {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const { data } = await api.get("/leads", { params });
      setLeads(data);
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
      api.get("/staff", { params: { role: "telecaller" } }).then((res) => setTelecallers(res.data)).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const visibleLeads = useMemo(() => {
    if (!todayOnly) return leads;
    const today = new Date().toISOString().slice(0, 10);
    return leads.filter((l) => l.follow_up_date === today || (l.follow_up_date && l.follow_up_date < today));
  }, [leads, todayOnly]);

  async function checkDuplicate() {
    if (!addForm.mobile) return;
    try {
      const { data } = await api.get("/leads/duplicate-check", { params: { mobile: addForm.mobile, email: addForm.email || undefined } });
      setDuplicateInfo(data.duplicate ? data.lead : null);
    } catch {
      /* ignore */
    }
  }

  async function submitAdd(e) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/leads", { ...addForm, interested_course_id: addForm.interested_course_id || null });
      setAddOpen(false);
      setAddForm({ name: "", mobile: "", email: "", interested_course_id: "", source: "website", remarks: "" });
      setDuplicateInfo(null);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function openDetail(lead) {
    setDetailLead(lead);
    setFollowupForm({ status: lead.status, followup_date: lead.follow_up_date || "", followup_time: lead.follow_up_time || "", remarks: "" });
    try {
      const { data } = await api.get(`/leads/${lead.id}/followups`);
      setFollowups(data);
    } catch {
      setFollowups([]);
    }
  }

  async function submitFollowup(e) {
    e.preventDefault();
    try {
      await api.post(`/leads/${detailLead.id}/followups`, followupForm);
      setDetailLead(null);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function submitAssign(e) {
    e.preventDefault();
    try {
      await api.post(`/leads/${assignLead.id}/assign`, { telecaller_id: Number(assignTo) });
      setAssignLead(null);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function submitConvert(e) {
    e.preventDefault();
    try {
      await api.post(`/leads/${convertLead.id}/convert`, convertForm);
      setConvertLead(null);
      await load();
      alert("Lead converted to student successfully.");
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-xl font-bold text-navy-900">{todayOnly ? "Today's Follow-ups" : "Leads"}</h1>
        <div className="flex items-center gap-2">
          <select className="input !w-44" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <input className="input !w-48" placeholder="Search name/mobile" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
          <button className="btn-secondary" onClick={load}>
            Search
          </button>
          <button className="btn-gold" onClick={() => setAddOpen(true)}>
            + New Lead
          </button>
        </div>
      </div>

      {error && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="card overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>Name</th>
              <th>Mobile</th>
              <th>Source</th>
              <th>Status</th>
              <th>Follow-up</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center text-slate-400 py-6">Loading...</td></tr>
            ) : visibleLeads.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-slate-400 py-6">No leads found</td></tr>
            ) : (
              visibleLeads.map((l) => (
                <tr key={l.id}>
                  <td className="font-medium">{l.name}</td>
                  <td>{l.mobile}</td>
                  <td>{l.source}</td>
                  <td><span className={`badge ${STATUS_COLORS[l.status] || "bg-slate-200"}`}>{l.status.replace(/_/g, " ")}</span></td>
                  <td>{l.follow_up_date || "—"}</td>
                  <td className="whitespace-nowrap space-x-2">
                    <button className="text-navy-700 hover:underline text-xs font-medium" onClick={() => openDetail(l)}>
                      Update
                    </button>
                    {allowManage && (
                      <button className="text-amber-700 hover:underline text-xs font-medium" onClick={() => { setAssignLead(l); setAssignTo(""); }}>
                        Assign
                      </button>
                    )}
                    {l.status !== "converted" && (
                      <button
                        className="text-emerald-700 hover:underline text-xs font-medium"
                        onClick={() => { setConvertLead(l); setConvertForm({ total_course_fee: 0, discount: 0, initial_payment: 0, number_of_emis: 0, password: "" }); }}
                      >
                        Convert
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={addOpen} title="New Lead" onClose={() => setAddOpen(false)}>
        <form onSubmit={submitAdd} className="space-y-3">
          <div>
            <label className="label">Name</label>
            <input className="input" required value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Mobile</label>
            <input className="input" required value={addForm.mobile} onChange={(e) => setAddForm({ ...addForm, mobile: e.target.value })} onBlur={checkDuplicate} />
          </div>
          {duplicateInfo && (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              A lead with this mobile already exists: <strong>{duplicateInfo.name}</strong> (status: {duplicateInfo.status})
            </div>
          )}
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} />
          </div>
          <div>
            <label className="label">Interested Course</label>
            <select className="input" value={addForm.interested_course_id} onChange={(e) => setAddForm({ ...addForm, interested_course_id: e.target.value })}>
              <option value="">Select course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Lead Source</label>
            <select className="input" value={addForm.source} onChange={(e) => setAddForm({ ...addForm, source: e.target.value })}>
              {SOURCE_OPTIONS.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Remarks</label>
            <textarea className="input" rows={2} value={addForm.remarks} onChange={(e) => setAddForm({ ...addForm, remarks: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setAddOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary">Save Lead</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!detailLead} title={`Lead: ${detailLead?.name || ""}`} onClose={() => setDetailLead(null)}>
        {detailLead && (
          <div>
            <div className="text-sm text-slate-600 mb-3 space-y-1">
              <p><strong>Mobile:</strong> {detailLead.mobile}</p>
              <p><strong>Email:</strong> {detailLead.email || "—"}</p>
              <p><strong>Current status:</strong> {detailLead.status.replace(/_/g, " ")}</p>
            </div>
            <form onSubmit={submitFollowup} className="space-y-3 border-t border-slate-200 pt-3">
              <div>
                <label className="label">Update Status</label>
                <select className="input" value={followupForm.status} onChange={(e) => setFollowupForm({ ...followupForm, status: e.target.value })}>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Follow-up Date</label>
                  <input className="input" type="date" value={followupForm.followup_date} onChange={(e) => setFollowupForm({ ...followupForm, followup_date: e.target.value })} />
                </div>
                <div>
                  <label className="label">Follow-up Time</label>
                  <input className="input" type="time" value={followupForm.followup_time} onChange={(e) => setFollowupForm({ ...followupForm, followup_time: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Remarks</label>
                <textarea className="input" rows={2} value={followupForm.remarks} onChange={(e) => setFollowupForm({ ...followupForm, remarks: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setDetailLead(null)}>Close</button>
                <button type="submit" className="btn-primary">Save Update</button>
              </div>
            </form>
            {followups.length > 0 && (
              <div className="mt-4 border-t border-slate-200 pt-3">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Follow-up History</p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {followups.map((f) => (
                    <div key={f.id} className="text-xs bg-slate-50 rounded p-2">
                      <p className="font-medium">{f.status_at_time?.replace(/_/g, " ")} — {f.followup_date || "no date"}</p>
                      <p className="text-slate-500">{f.remarks}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={!!assignLead} title={`Assign: ${assignLead?.name || ""}`} onClose={() => setAssignLead(null)}>
        <form onSubmit={submitAssign} className="space-y-3">
          <div>
            <label className="label">Telecaller</label>
            <select className="input" required value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
              <option value="">Select telecaller</option>
              {telecallers.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setAssignLead(null)}>Cancel</button>
            <button type="submit" className="btn-primary">Assign</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!convertLead} title={`Convert to Student: ${convertLead?.name || ""}`} onClose={() => setConvertLead(null)}>
        <form onSubmit={submitConvert} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Total Course Fee</label>
              <input className="input" type="number" value={convertForm.total_course_fee} onChange={(e) => setConvertForm({ ...convertForm, total_course_fee: e.target.valueAsNumber })} />
            </div>
            <div>
              <label className="label">Discount</label>
              <input className="input" type="number" value={convertForm.discount} onChange={(e) => setConvertForm({ ...convertForm, discount: e.target.valueAsNumber })} />
            </div>
            <div>
              <label className="label">Initial Payment</label>
              <input className="input" type="number" value={convertForm.initial_payment} onChange={(e) => setConvertForm({ ...convertForm, initial_payment: e.target.valueAsNumber })} />
            </div>
            <div>
              <label className="label">Number of EMIs</label>
              <input className="input" type="number" value={convertForm.number_of_emis} onChange={(e) => setConvertForm({ ...convertForm, number_of_emis: e.target.valueAsNumber })} />
            </div>
          </div>
          <div>
            <label className="label">Student Login Password</label>
            <input className="input" value={convertForm.password} onChange={(e) => setConvertForm({ ...convertForm, password: e.target.value })} placeholder="Default: Welcome@123" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setConvertLead(null)}>Cancel</button>
            <button type="submit" className="btn-primary">Convert</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
