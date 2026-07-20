import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "../../api/client";
import ResourceCrud from "../../components/ResourceCrud";
import Modal from "../../components/Modal";

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

  return (
    <div>
      <ResourceCrud
        title="Courses"
        endpoint="/courses"
        columns={columns}
        formFields={formFields}
        toggleActiveField="is_active"
        extraActions={(row) => (
          <button
            key="syllabus"
            className="text-navy-700 hover:underline text-xs font-medium"
            onClick={() => setSyllabusCourse(row)}
          >
            Syllabus
          </button>
        )}
      />
      <Modal open={!!syllabusCourse} title={`Syllabus: ${syllabusCourse?.name || ""}`} onClose={() => setSyllabusCourse(null)} wide>
        {syllabusCourse && <SyllabusEditor courseId={syllabusCourse.id} onClose={() => setSyllabusCourse(null)} />}
      </Modal>
    </div>
  );
}
