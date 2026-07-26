import { useEffect, useState } from "react";
import axios from "axios";
import { useSettings } from "../context/SettingsContext";
import SrtLogo from "../assets/SrtLogo";
import { apiErrorMessage } from "../api/client";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";
const publicApi = axios.create({ baseURL: API_URL });

const PAYMENT_MODES = ["cash", "upi", "bank_transfer", "debit_card", "credit_card", "cheque", "online"];

const initialForm = {
  name: "",
  mobile: "",
  email: "",
  course_id: "",
  address: "",
  father_name: "",
  initial_payment: "",
  payment_mode: "cash",
  portal_ref: "",
};

export default function PublicRegister() {
  const { settings } = useSettings();
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [paymentProof, setPaymentProof] = useState(null);
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    publicApi.get("/public/courses").then((res) => setCourses(res.data)).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([key, value]) => formData.append(key, value));
      if (paymentProof) formData.append("payment_proof", paymentProof);
      if (profilePhoto) formData.append("profile_photo", profilePhoto);
      const { data } = await publicApi.post("/public/register", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(data);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-950 px-4">
        <div className="w-full max-w-md card p-6 text-center">
          <h1 className="text-lg font-bold text-navy-900 mb-2">Registration Successful</h1>
          <p className="text-sm text-slate-600 mb-1">Student ID: <strong>{result.student_code}</strong></p>
          <p className="text-sm text-slate-600">{result.detail}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-950 px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="flex flex-col items-center mb-6">
          {settings.logo_path ? (
            <img src={settings.logo_path} alt={settings.portal_name} className="h-16 w-16 rounded-xl object-contain bg-white/5" />
          ) : (
            <SrtLogo size={64} />
          )}
          <h1 className="mt-3 text-xl font-bold text-white text-center">{settings.portal_name}</h1>
          <p className="text-sm text-gold-400">Student Registration</p>
        </div>
        <form onSubmit={handleSubmit} className="card p-6 space-y-3">
          <div>
            <label className="label">Name (with initial) *</label>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="label">Mobile *</label><input className="input" required value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></div>
            <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <div>
            <label className="label">Course *</label>
            <select className="input" required value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })}>
              <option value="">Select course</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.offer_fee ? `— ₹${c.offer_fee.toLocaleString()}` : c.regular_fee ? `— ₹${c.regular_fee.toLocaleString()}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div><label className="label">Address</label><input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div><label className="label">Father's Name</label><input className="input" value={form.father_name} onChange={(e) => setForm({ ...form, father_name: e.target.value })} /></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="label">Initial Payment *</label><input className="input" type="number" min="0" required value={form.initial_payment} onChange={(e) => setForm({ ...form, initial_payment: e.target.value })} /></div>
            <div>
              <label className="label">Mode of Payment *</label>
              <select className="input" required value={form.payment_mode} onChange={(e) => setForm({ ...form, payment_mode: e.target.value })}>
                {PAYMENT_MODES.map((m) => (<option key={m} value={m}>{m.replace(/_/g, " ")}</option>))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Payment Proof (screenshot/receipt)</label>
            <input className="input" type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={(e) => setPaymentProof(e.target.files?.[0] || null)} />
          </div>
          <div>
            <label className="label">Profile Photo</label>
            <input className="input" type="file" accept=".jpg,.jpeg,.png,.webp" onChange={(e) => setProfilePhoto(e.target.files?.[0] || null)} />
          </div>
          <div><label className="label">Portal Reference (if any)</label><input className="input" value={form.portal_ref} onChange={(e) => setForm({ ...form, portal_ref: e.target.value })} /></div>
          {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <button type="submit" className="btn-gold w-full" disabled={submitting}>
            {submitting ? "Submitting..." : "Submit Registration"}
          </button>
        </form>
      </div>
    </div>
  );
}
