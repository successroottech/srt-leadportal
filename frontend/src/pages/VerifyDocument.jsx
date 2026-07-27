import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { useSettings } from "../context/SettingsContext";
import SrtLogo from "../assets/SrtLogo";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";
const publicApi = axios.create({ baseURL: API_URL });

const DOC_TYPE_LABELS = {
  joining_letter: "Joining Letter",
  invoice: "Invoice",
  certificate: "Certificate",
};

export default function VerifyDocument() {
  const { code } = useParams();
  const { settings } = useSettings();
  const [result, setResult] = useState(null);

  useEffect(() => {
    publicApi
      .get(`/public/verify/${code}`)
      .then((res) => setResult(res.data))
      .catch(() => setResult({ valid: false }));
  }, [code]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-950 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          {settings.logo_path ? (
            <img src={settings.logo_path} alt={settings.portal_name} className="h-16 w-16 rounded-xl object-contain bg-white/5" />
          ) : (
            <SrtLogo size={64} />
          )}
          <h1 className="mt-3 text-xl font-bold text-white text-center">{settings.portal_name}</h1>
          <p className="text-sm text-gold-400">Document Verification</p>
        </div>

        {!result ? (
          <div className="card p-6 text-center text-slate-500">Checking...</div>
        ) : result.valid ? (
          <div className="card p-6 text-center">
            <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl">✓</div>
            <h2 className="text-lg font-bold text-navy-900 mb-1">Document Verified</h2>
            <p className="text-sm text-slate-600 mb-3">This is a genuine document issued by {settings.organization_name}.</p>
            <div className="text-left text-sm space-y-1 border-t border-slate-100 pt-3">
              <p><span className="text-slate-500">Type:</span> <strong>{DOC_TYPE_LABELS[result.document_type] || result.document_type}</strong></p>
              <p><span className="text-slate-500">Title:</span> <strong>{result.title}</strong></p>
              <p><span className="text-slate-500">Student:</span> <strong>{result.student_name} ({result.student_code})</strong></p>
              <p><span className="text-slate-500">Issued:</span> <strong>{result.issue_date}</strong></p>
            </div>
          </div>
        ) : (
          <div className="card p-6 text-center">
            <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-2xl">✕</div>
            <h2 className="text-lg font-bold text-navy-900 mb-1">Not Verified</h2>
            <p className="text-sm text-slate-600">We could not find a document matching this code. It may be invalid or has been revoked.</p>
          </div>
        )}
      </div>
    </div>
  );
}
