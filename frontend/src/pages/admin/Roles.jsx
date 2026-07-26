import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "../../api/client";
import { exportCsv } from "../../utils/exportCsv";
import Modal from "../../components/Modal";

const MODULES = [
  "roles", "staff", "leads", "candidates", "students", "courses", "batches",
  "attendance", "fees", "expenses", "leave_requests", "feedback_complaints",
  "notifications", "reports", "audit_logs",
];
const PERM_KEYS = ["can_view", "can_create", "can_edit", "can_delete", "can_export", "can_approve", "can_assign", "can_status_update"];

function emptyPermissions() {
  return MODULES.map((m) => ({ module: m, ...Object.fromEntries(PERM_KEYS.map((k) => [k, false])) }));
}

export default function Roles() {
  const [roles, setRoles] = useState([]);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permissions, setPermissions] = useState(emptyPermissions());
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const params = {};
      if (statusFilter) params.is_active = statusFilter === "active";
      if (search) params.search = search;
      const { data } = await api.get("/roles", { params });
      setRoles(data);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  function handleExport() {
    exportCsv(
      roles,
      [
        { key: "name", label: "Name" },
        { key: "description", label: "Description" },
        { key: (r) => (r.is_system ? "Yes" : "No"), label: "System" },
        { key: (r) => (r.is_active ? "Active" : "Inactive"), label: "Status" },
      ],
      "roles"
    );
  }

  function openCreate() {
    setEditing(null);
    setName("");
    setDescription("");
    setPermissions(emptyPermissions());
    setModalOpen(true);
  }

  function openEdit(role) {
    setEditing(role);
    setName(role.name);
    setDescription(role.description || "");
    const merged = MODULES.map((m) => {
      const existing = role.permissions.find((p) => p.module === m);
      return existing || { module: m, ...Object.fromEntries(PERM_KEYS.map((k) => [k, false])) };
    });
    setPermissions(merged);
    setModalOpen(true);
  }

  function togglePerm(moduleName, key) {
    setPermissions((prev) => prev.map((p) => (p.module === moduleName ? { ...p, [key]: !p[key] } : p)));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editing) {
        await api.put(`/roles/${editing.id}`, { description, permissions });
      } else {
        await api.post("/roles", { name, description, permissions });
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(role) {
    try {
      await api.post(`/roles/${role.id}/toggle-active`);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function handleDelete(role) {
    if (!window.confirm("Delete this role?")) return;
    try {
      await api.delete(`/roles/${role.id}`);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-xl font-bold text-navy-900">Roles & Permissions</h1>
        <div className="flex flex-wrap items-center gap-2">
          <select className="input w-full sm:!w-36" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <input className="input w-full sm:!w-48" placeholder="Search name" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
          <button className="btn-secondary" onClick={load}>Search</button>
          <button className="btn-secondary" onClick={handleExport}>Export</button>
          <button className="btn-gold" onClick={openCreate}>
            + Add Role
          </button>
        </div>
      </div>
      {error && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {roles.length === 0 ? (
        <p className="text-center text-slate-400 py-6">No roles found</p>
      ) : (
        <>
          <div className="hidden sm:block card overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>System</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.name}</td>
                    <td>{r.description}</td>
                    <td>{r.is_system ? "Yes" : "No"}</td>
                    <td>
                      <span className={`badge ${r.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                        {r.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap space-x-2">
                      <button className="text-navy-700 hover:underline text-xs font-medium" onClick={() => openEdit(r)}>
                        Edit
                      </button>
                      <button className="text-amber-700 hover:underline text-xs font-medium" onClick={() => handleToggleActive(r)}>
                        {r.is_active ? "Deactivate" : "Activate"}
                      </button>
                      {!r.is_system && (
                        <button className="text-red-600 hover:underline text-xs font-medium" onClick={() => handleDelete(r)}>
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sm:hidden space-y-2">
            {roles.map((r) => (
              <div key={r.id} className="card p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-navy-900">{r.name}</p>
                  <span className={`badge ${r.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                    {r.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="text-sm text-slate-500">{r.description || "—"}</p>
                <p className="mt-1 text-xs text-slate-500">System role: {r.is_system ? "Yes" : "No"}</p>
                <div className="mt-2 flex flex-wrap gap-3 border-t border-slate-100 pt-2">
                  <button className="text-navy-700 hover:underline text-xs font-medium" onClick={() => openEdit(r)}>
                    Edit
                  </button>
                  <button className="text-amber-700 hover:underline text-xs font-medium" onClick={() => handleToggleActive(r)}>
                    {r.is_active ? "Deactivate" : "Activate"}
                  </button>
                  {!r.is_system && (
                    <button className="text-red-600 hover:underline text-xs font-medium" onClick={() => handleDelete(r)}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <Modal open={modalOpen} title={editing ? `Edit Role: ${editing.name}` : "Add Role"} onClose={() => setModalOpen(false)} wide error={error}>
        <form onSubmit={handleSave} className="space-y-4">
          {!editing && (
            <div>
              <label className="label">Role Name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}
          <div>
            <label className="label">Description</label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="overflow-x-auto">
            <table className="data-table w-full text-xs">
              <thead>
                <tr>
                  <th>Module</th>
                  {PERM_KEYS.map((k) => (
                    <th key={k}>{k.replace("can_", "")}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissions.map((p) => (
                  <tr key={p.module}>
                    <td className="font-medium">{p.module}</td>
                    {PERM_KEYS.map((k) => (
                      <td key={k} className="text-center">
                        <input type="checkbox" checked={!!p[k]} onChange={() => togglePerm(p.module, k)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
