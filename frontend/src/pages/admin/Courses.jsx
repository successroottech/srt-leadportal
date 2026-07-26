import { useEffect, useRef, useState } from "react";
import { api, apiErrorMessage } from "../../api/client";
import ResourceCrud from "../../components/ResourceCrud";
import Modal from "../../components/Modal";

function MaterialsManager({ courseId, onClose }) {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [linkForm, setLinkForm] = useState({ title: "", external_link: "" });

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get(`/courses/${courseId}/materials`);
      setMaterials(data);
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

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data: uploaded } = await api.post("/uploads", formData, { headers: { "Content-Type": "multipart/form-data" } });
      const ext = (file.name.split(".").pop() || "").toLowerCase();
      const type = ["pdf"].includes(ext) ? "pdf" : ["doc", "docx"].includes(ext) ? "word" : ["xls", "xlsx"].includes(ext) ? "excel" : ["mp4"].includes(ext) ? "video" : "other";
      await api.post(`/courses/${courseId}/materials`, { title: file.name, material_type: type, file_path: uploaded.file_path });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function addLink(e) {
    e.preventDefault();
    if (!linkForm.title || !linkForm.external_link) return;
    try {
      await api.post(`/courses/${courseId}/materials`, { title: linkForm.title, material_type: "link", external_link: linkForm.external_link });
      setLinkForm({ title: "", external_link: "" });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function remove(materialId) {
    if (!window.confirm("Delete this material?")) return;
    try {
      await api.delete(`/courses/${courseId}/materials/${materialId}`);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div>
      {error && <div className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {loading ? (
        <p className="text-sm text-slate-400">Loading...</p>
      ) : materials.length === 0 ? (
        <p className="text-sm text-slate-400 mb-3">No materials uploaded yet.</p>
      ) : (
        <div className="space-y-1 mb-3 max-h-48 overflow-y-auto">
          {materials.map((m) => (
            <div key={m.id} className="flex items-center justify-between text-sm bg-slate-50 rounded px-2 py-1.5">
              <span>
                <span className="badge bg-slate-200 text-slate-700 mr-2">{m.material_type}</span>
                {m.file_path ? (
                  <a href={m.file_path} target="_blank" rel="noreferrer" className="text-navy-700 hover:underline">{m.title}</a>
                ) : (
                  <a href={m.external_link} target="_blank" rel="noreferrer" className="text-navy-700 hover:underline">{m.title}</a>
                )}
              </span>
              <button className="text-red-600 hover:underline text-xs font-medium" onClick={() => remove(m.id)}>Delete</button>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-slate-200 pt-3 space-y-3">
        <div>
          <label className="label">Upload File</label>
          <input ref={fileInputRef} type="file" className="input" onChange={handleFileUpload} disabled={uploading} />
        </div>
        <form onSubmit={addLink} className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-end">
          <div><label className="label">Or Add Link — Title</label><input className="input" value={linkForm.title} onChange={(e) => setLinkForm({ ...linkForm, title: e.target.value })} /></div>
          <div><label className="label">URL</label><input className="input" value={linkForm.external_link} onChange={(e) => setLinkForm({ ...linkForm, external_link: e.target.value })} /></div>
          <div className="sm:col-span-2"><button type="submit" className="btn-secondary">Add Link</button></div>
        </form>
      </div>
      <div className="flex justify-end pt-3">
        <button className="btn-secondary" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

const columns = [
  { key: "course_code", label: "Code" },
  { key: "name", label: "Name" },
  { key: "category", label: "Category" },
  { key: "duration_weeks", label: "Duration (weeks)" },
  { key: "regular_fee", label: "Regular Fee" },
  { key: "offer_fee", label: "Offer Fee" },
  {
    key: "is_active",
    label: "Status",
    render: (row) => (
      <span className={`badge ${row.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
        {row.is_active ? "Active" : "Inactive"}
      </span>
    ),
  },
];

const formFields = [
  { name: "name", label: "Course Name", required: true },
  { name: "category", label: "Category" },
  { name: "duration_weeks", label: "Duration (weeks)", type: "number" },
  { name: "regular_fee", label: "Regular Fee", type: "number", required: true },
  { name: "offer_fee", label: "Offer Fee", type: "number" },
  { name: "description", label: "Description", type: "textarea" },
];

function SyllabusFileManager({ course, onUpdated }) {
  const [file, setFile] = useState(course.syllabus_file || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  async function handleUpload(e) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", picked);
      const { data: uploaded } = await api.post("/uploads", formData, { headers: { "Content-Type": "multipart/form-data" } });
      await api.put(`/courses/${course.id}`, { syllabus_file: uploaded.file_path });
      setFile(uploaded.file_path);
      onUpdated?.(uploaded.file_path);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemove() {
    if (!window.confirm("Remove the uploaded syllabus file?")) return;
    try {
      await api.put(`/courses/${course.id}`, { syllabus_file: null });
      setFile(null);
      onUpdated?.(null);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  function shareOnWhatsApp() {
    const link = `${window.location.origin}${file}`;
    const message = `Hi! Here is the syllabus for ${course.name}: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noreferrer");
  }

  return (
    <div className="border-b border-slate-200 pb-4 mb-4">
      <p className="label mb-2">Syllabus File</p>
      {error && <div className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {file ? (
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <a href={file} target="_blank" rel="noreferrer" className="text-navy-700 hover:underline text-sm">View current file</a>
          <button className="btn-secondary !py-1 !px-2 text-xs" onClick={shareOnWhatsApp}>Share via WhatsApp</button>
          <button className="text-red-600 hover:underline text-xs font-medium" onClick={handleRemove}>Remove</button>
        </div>
      ) : (
        <p className="text-sm text-slate-400 mb-2">No syllabus file uploaded yet.</p>
      )}
      <input ref={fileInputRef} type="file" className="input" accept=".pdf,.doc,.docx" onChange={handleUpload} disabled={uploading} />
    </div>
  );
}

function SyllabusEditor({ courseId, onClose }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.get(`/courses/${courseId}/syllabus`).then((res) => {
      const lines = res.data
        .map((m) => `${m.module_name}\n${m.topics.map((t) => `  - ${t.topic_name}`).join("\n")}`)
        .join("\n");
      setText(lines);
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function parse(input) {
    const lines = input.split("\n");
    const modules = [];
    let current = null;
    let seq = 0;
    for (const raw of lines) {
      if (!raw.trim()) continue;
      if (raw.startsWith("  ") || raw.trim().startsWith("-")) {
        if (current) {
          current.topics.push({ topic_name: raw.replace(/^\s*-\s*/, "").trim(), sequence: current.topics.length + 1 });
        }
      } else {
        seq += 1;
        current = { module_name: raw.trim(), sequence: seq, topics: [] };
        modules.push(current);
      }
    }
    return modules;
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      await api.put(`/courses/${courseId}/syllabus`, parse(text));
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <p className="text-xs text-slate-500 mb-2">
        One module per line. Indent topics with two spaces or a leading dash, one per line, under the module.
      </p>
      {!loaded ? (
        <p className="text-sm text-slate-400">Loading...</p>
      ) : (
        <textarea className="input font-mono" rows={12} value={text} onChange={(e) => setText(e.target.value)} />
      )}
      {error && <div className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="flex justify-end gap-2 mt-3">
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? "Saving..." : "Save Syllabus"}
        </button>
      </div>
    </div>
  );
}

export default function Courses() {
  const [syllabusCourse, setSyllabusCourse] = useState(null);
  const [materialsCourse, setMaterialsCourse] = useState(null);

  return (
    <div>
      <ResourceCrud
        title="Courses"
        endpoint="/courses"
        columns={columns}
        formFields={formFields}
        toggleActiveField="is_active"
        exportFilename="courses"
        extraActions={(row) => (
          <span key="course-actions">
            <button
              className="text-navy-700 hover:underline text-xs font-medium mr-2"
              onClick={() => setSyllabusCourse(row)}
            >
              Syllabus
            </button>
            <button
              className="text-navy-700 hover:underline text-xs font-medium"
              onClick={() => setMaterialsCourse(row)}
            >
              Materials
            </button>
          </span>
        )}
      />
      <Modal open={!!syllabusCourse} title={`Syllabus: ${syllabusCourse?.name || ""}`} onClose={() => setSyllabusCourse(null)} wide>
        {syllabusCourse && (
          <>
            <SyllabusFileManager
              course={syllabusCourse}
              onUpdated={(syllabus_file) => setSyllabusCourse({ ...syllabusCourse, syllabus_file })}
            />
            <SyllabusEditor courseId={syllabusCourse.id} onClose={() => setSyllabusCourse(null)} />
          </>
        )}
      </Modal>
      <Modal open={!!materialsCourse} title={`Materials: ${materialsCourse?.name || ""}`} onClose={() => setMaterialsCourse(null)} wide>
        {materialsCourse && <MaterialsManager courseId={materialsCourse.id} onClose={() => setMaterialsCourse(null)} />}
      </Modal>
    </div>
  );
}
