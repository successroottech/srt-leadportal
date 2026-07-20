import { useEffect, useState } from "react";
import { api } from "../../api/client";

const STATUS_COLORS = {
  not_started: "bg-slate-200 text-slate-700",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  rescheduled: "bg-purple-100 text-purple-700",
  skipped: "bg-red-100 text-red-700",
};

export default function MyCourse() {
  const [student, setStudent] = useState(null);
  const [topics, setTopics] = useState([]);

  useEffect(() => {
    api.get("/students/me").then(async (res) => {
      setStudent(res.data);
      if (res.data.batch_id) {
        const t = await api.get(`/batches/${res.data.batch_id}/topics`);
        setTopics(t.data);
      }
    });
  }, []);

  if (!student) return <p className="text-slate-500">Loading...</p>;

  const grouped = topics.reduce((acc, t) => {
    (acc[t.module_name] ||= []).push(t);
    return acc;
  }, {});

  return (
    <div>
      <h1 className="text-xl font-bold text-navy-900 mb-1">My Course</h1>
      <p className="text-sm text-slate-500 mb-4">
        Status: <span className="badge bg-slate-200 text-slate-700">{student.course_status}</span>
      </p>
      <div className="space-y-3">
        {Object.keys(grouped).length === 0 ? (
          <p className="text-slate-400 text-sm">No syllabus available yet for your batch.</p>
        ) : (
          Object.entries(grouped).map(([moduleName, items]) => (
            <div key={moduleName} className="card p-4">
              <h2 className="font-semibold text-navy-900 mb-2">{moduleName}</h2>
              <ul className="space-y-1 text-sm">
                {items.map((t) => (
                  <li key={t.id} className="flex items-center justify-between">
                    <span>{t.topic_name}</span>
                    <span className={`badge ${STATUS_COLORS[t.status]}`}>{t.status.replace("_", " ")}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
