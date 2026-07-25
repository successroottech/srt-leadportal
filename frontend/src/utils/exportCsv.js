function csvCell(value) {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * columns: [{ key, label }] — key may be a dot path ("a.b") or a function(row).
 */
export function exportCsv(rows, columns, filename) {
  const header = columns.map((c) => csvCell(c.label)).join(",");
  const lines = rows.map((row) =>
    columns
      .map((c) => csvCell(typeof c.key === "function" ? c.key(row) : row[c.key]))
      .join(",")
  );
  const csv = [header, ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
