import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "../api/client";
import { exportCsv } from "../utils/exportCsv";
import Modal from "./Modal";

/**
 * Generic list + create/edit modal + delete for simple CRUD modules.
 *
 * columns: [{ key, label, render?(row) }]
 * formFields: [{ name, label, type: text|number|date|select|textarea|checkbox, options?, required? }]
 */
export default function ResourceCrud({
  title,
  endpoint,
  columns,
  formFields,
  canCreate = true,
  canEdit = true,
  canDelete = true,
  extraActions,
  toggleActiveField,
  exportFilename,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(endpoint, { params: search ? { search } : {} });
      setRows(data);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setEditing(null);
    const initial = {};
    formFields.forEach((f) => (initial[f.name] = f.type === "checkbox" ? false : ""));
    setForm(initial);
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    const initial = {};
    formFields.forEach((f) => (initial[f.name] = row[f.name] ?? (f.type === "checkbox" ? false : "")));
    setForm(initial);
    setModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editing) {
        await api.put(`${endpoint}/${editing.id}`, form);
      } else {
        await api.post(endpoint, form);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row) {
    if (!window.confirm("Delete this record? This cannot be undone.")) return;
    try {
      await api.delete(`${endpoint}/${row.id}`);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function handleToggleActive(row) {
    try {
      await api.post(`${endpoint}/${row.id}/toggle-active`);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h1 className="text-xl font-bold text-navy-900">{title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="input w-full sm:!w-56"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
          <button className="btn-secondary" onClick={load}>
            Search
          </button>
          {exportFilename && (
            <button
              className="btn-secondary"
              onClick={() => exportCsv(rows, columns.map((c) => ({ key: c.key, label: c.label })), exportFilename)}
            >
              Export
            </button>
          )}
          {canCreate && (
            <button className="btn-gold" onClick={openCreate}>
              + Add
            </button>
          )}
        </div>
      </div>

      {error && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="card overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length + 1} className="text-center text-slate-400 py-6">
                  Loading...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="text-center text-slate-400 py-6">
                  No records found
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  {columns.map((c) => (
                    <td key={c.key}>{c.render ? c.render(row) : String(row[c.key] ?? "")}</td>
                  ))}
                  <td className="whitespace-nowrap space-x-2">
                    {canEdit && (
                      <button className="text-navy-700 hover:underline text-xs font-medium" onClick={() => openEdit(row)}>
                        Edit
                      </button>
                    )}
                    {toggleActiveField && (
                      <button className="text-amber-700 hover:underline text-xs font-medium" onClick={() => handleToggleActive(row)}>
                        {row[toggleActiveField] ? "Deactivate" : "Activate"}
                      </button>
                    )}
                    {extraActions && extraActions(row, load)}
                    {canDelete && (
                      <button className="text-red-600 hover:underline text-xs font-medium" onClick={() => handleDelete(row)}>
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} title={editing ? `Edit ${title}` : `Add ${title}`} onClose={() => setModalOpen(false)}>
        <form onSubmit={handleSave} className="space-y-3">
          {formFields.map((f) => (
            <div key={f.name}>
              {f.type !== "checkbox" && <label className="label">{f.label}</label>}
              {f.type === "select" ? (
                <select
                  className="input"
                  required={f.required}
                  value={form[f.name] ?? ""}
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                >
                  <option value="">Select...</option>
                  {(f.options || []).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  className="input"
                  rows={3}
                  required={f.required}
                  value={form[f.name] ?? ""}
                  onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                />
              ) : f.type === "checkbox" ? (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!form[f.name]}
                    onChange={(e) => setForm({ ...form, [f.name]: e.target.checked })}
                  />
                  {f.label}
                </label>
              ) : (
                <input
                  className="input"
                  type={f.type || "text"}
                  required={f.required}
                  value={form[f.name] ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, [f.name]: f.type === "number" ? e.target.valueAsNumber : e.target.value })
                  }
                />
              )}
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-2">
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
