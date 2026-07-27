import { useEffect, useState } from "react";
import { api } from "../../api/client";

const DOC_TYPE_LABELS = {
  joining_letter: "Joining Letter",
  invoice: "Invoice",
  certificate: "Certificate",
};

export default function MyDocuments() {
  const [docs, setDocs] = useState(null);

  useEffect(() => {
    api.get("/documents/me").then((res) => setDocs(res.data));
  }, []);

  if (!docs) return <p className="text-slate-500">Loading...</p>;

  return (
    <div>
      <h1 className="text-xl font-bold text-navy-900 mb-4">My Documents</h1>
      <div className="card overflow-x-auto">
        <table className="data-table w-full">
          <thead>
            <tr><th>Type</th><th>Title</th><th>Invoice #</th><th>Amount</th><th>Due Date</th><th>Issued</th><th></th></tr>
          </thead>
          <tbody>
            {docs.length === 0 ? (
              <tr><td colSpan={7} className="text-center text-slate-400 py-6">No documents yet</td></tr>
            ) : (
              docs.map((d) => (
                <tr key={d.id}>
                  <td><span className="badge bg-slate-200 text-slate-700">{DOC_TYPE_LABELS[d.document_type] || d.document_type}</span></td>
                  <td className="font-medium">{d.title}</td>
                  <td>{d.invoice_number || "—"}</td>
                  <td>{d.amount != null ? `₹${Number(d.amount).toLocaleString()}` : "—"}</td>
                  <td>{d.due_date || "—"}</td>
                  <td>{d.issue_date}</td>
                  <td>
                    {d.file_path && (
                      <a href={d.file_path} target="_blank" rel="noreferrer" className="text-navy-700 hover:underline text-xs font-medium">
                        Download
                      </a>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-400">
        Each document includes a QR code you or anyone else can scan to verify it was genuinely issued by us.
      </p>
    </div>
  );
}
