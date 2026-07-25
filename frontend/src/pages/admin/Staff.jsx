import { useEffect, useState } from "react";
import { api, apiErrorMessage } from "../../api/client";
import ResourceCrud from "../../components/ResourceCrud";

export default function Staff() {
  const [roles, setRoles] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/roles")
      .then((res) => setRoles(res.data.filter((r) => r.name !== "student")))
      .catch((err) => setError(apiErrorMessage(err)));
  }, []);

  const roleOptions = roles.map((r) => ({ value: r.id, label: r.name }));

  const columns = [
    { key: "staff_code", label: "Code" },
    { key: "name", label: "Name" },
    { key: "email", label: "Email" },
    { key: "mobile", label: "Mobile" },
    { key: "department", label: "Department" },
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
    { name: "name", label: "Full Name", required: true },
    { name: "email", label: "Email", type: "email" },
    { name: "mobile", label: "Mobile Number" },
    { name: "alt_mobile", label: "Alternative Mobile" },
    { name: "role_id", label: "Role", type: "select", required: true, options: roleOptions },
    { name: "department", label: "Department" },
    { name: "joining_date", label: "Joining Date", type: "date" },
    { name: "salary", label: "Salary", type: "number" },
    { name: "address", label: "Address", type: "textarea" },
    { name: "password", label: "Password (set on create)" },
  ];

  return (
    <div>
      {error && <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <ResourceCrud
        title="Staff"
        endpoint="/staff"
        columns={columns}
        formFields={formFields}
        toggleActiveField="is_active"
        exportFilename="staff"
      />
    </div>
  );
}
