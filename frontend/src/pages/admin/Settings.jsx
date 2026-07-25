import { useEffect, useRef, useState } from "react";
import { api, apiErrorMessage } from "../../api/client";
import { useSettings } from "../../context/SettingsContext";
import SrtLogo from "../../assets/SrtLogo";

export default function Settings() {
  const { settings, refresh } = useSettings();
  const [form, setForm] = useState(settings);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    setSuccess("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data: uploaded } = await api.post("/uploads", formData, { headers: { "Content-Type": "multipart/form-data" } });
      await api.put("/settings", { logo_path: uploaded.file_path });
      await refresh();
      setSuccess("Logo updated.");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemoveLogo() {
    setError("");
    setSuccess("");
    try {
      await api.put("/settings", { logo_path: null });
      await refresh();
      setSuccess("Logo removed.");
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.put("/settings", {
        portal_name: form.portal_name,
        organization_name: form.organization_name,
        work_start_hour: Number(form.work_start_hour),
        work_end_hour: Number(form.work_end_hour),
        support_email: form.support_email || null,
        support_phone: form.support_phone || null,
        address: form.address || null,
      });
      await refresh();
      setSuccess("Settings saved.");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-bold text-navy-900 mb-4">Settings</h1>
      {error && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {success && <div className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{success}</div>}

      <div className="card p-4 mb-4">
        <h2 className="font-semibold text-navy-900 mb-3">Portal Logo</h2>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
            {settings.logo_path ? (
              <img src={settings.logo_path} alt="Current logo" className="h-full w-full object-contain" />
            ) : (
              <SrtLogo size={48} />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={handleLogoUpload} />
            <button type="button" className="btn-secondary" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
              {uploading ? "Uploading..." : "Upload New Logo"}
            </button>
            {settings.logo_path && (
              <button type="button" className="text-red-600 hover:underline text-sm font-medium" onClick={handleRemoveLogo}>
                Remove logo
              </button>
            )}
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-400">PNG, JPG, or WEBP. Shown in the sidebar, the login page, and the browser tab icon.</p>
      </div>

      <form onSubmit={handleSave} className="card p-4 space-y-4">
        <h2 className="font-semibold text-navy-900">Portal Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Portal Name</label>
            <input className="input" value={form.portal_name || ""} onChange={(e) => setForm({ ...form, portal_name: e.target.value })} required />
          </div>
          <div>
            <label className="label">Organization Name</label>
            <input className="input" value={form.organization_name || ""} onChange={(e) => setForm({ ...form, organization_name: e.target.value })} required />
          </div>
        </div>

        <h2 className="font-semibold text-navy-900 pt-2 border-t border-slate-100">Working Hours</h2>
        <p className="text-xs text-slate-400 -mt-2">Used to flag late logins and early logouts on the attendance module.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Work Start Hour (24h)</label>
            <input className="input" type="number" min="0" max="23" value={form.work_start_hour ?? 9} onChange={(e) => setForm({ ...form, work_start_hour: e.target.value })} required />
          </div>
          <div>
            <label className="label">Work End Hour (24h)</label>
            <input className="input" type="number" min="0" max="23" value={form.work_end_hour ?? 18} onChange={(e) => setForm({ ...form, work_end_hour: e.target.value })} required />
          </div>
        </div>

        <h2 className="font-semibold text-navy-900 pt-2 border-t border-slate-100">Contact Details</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Support Email</label>
            <input className="input" type="email" value={form.support_email || ""} onChange={(e) => setForm({ ...form, support_email: e.target.value })} />
          </div>
          <div>
            <label className="label">Support Phone</label>
            <input className="input" value={form.support_phone || ""} onChange={(e) => setForm({ ...form, support_phone: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Address</label>
            <textarea className="input" rows={2} value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
