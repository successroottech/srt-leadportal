export default function StatCard({ label, value, accent = "navy", suffix = "" }) {
  const accentClasses = {
    navy: "text-navy-900",
    gold: "text-gold-600",
    red: "text-red-600",
    green: "text-emerald-600",
  };
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accentClasses[accent] || accentClasses.navy}`}>
        {value ?? "—"}
        {suffix}
      </p>
    </div>
  );
}
