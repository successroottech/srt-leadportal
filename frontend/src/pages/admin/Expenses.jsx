import { api, apiErrorMessage } from "../../api/client";
import ResourceCrud from "../../components/ResourceCrud";

const CATEGORY_OPTIONS = [
  "Staff Salary", "Office Rent", "Electricity Bill", "Internet Bill", "Laptop Purchase",
  "Computer Accessories", "Chairs/Tables", "Office Maintenance", "Marketing Expenses",
  "Advertisement Expenses", "Software Subscription", "Trainer Payment", "Travel Expenses",
  "Refreshments", "Other Expenses",
].map((c) => ({ value: c, label: c }));

const PAYMENT_MODES = ["cash", "upi", "bank_transfer", "debit_card", "credit_card", "cheque", "online"].map((m) => ({
  value: m,
  label: m.replace("_", " "),
}));

const columns = [
  { key: "expense_date", label: "Date" },
  { key: "category", label: "Category" },
  { key: "amount", label: "Amount" },
  { key: "payment_mode", label: "Mode" },
  { key: "paid_to", label: "Paid To" },
  {
    key: "approval_status",
    label: "Status",
    render: (row) => {
      const colors = { pending: "bg-amber-100 text-amber-700", approved: "bg-emerald-100 text-emerald-700", rejected: "bg-red-100 text-red-700" };
      return <span className={`badge ${colors[row.approval_status]}`}>{row.approval_status}</span>;
    },
  },
];

const formFields = [
  { name: "expense_date", label: "Expense Date", type: "date", required: true },
  { name: "category", label: "Category", type: "select", required: true, options: CATEGORY_OPTIONS },
  { name: "amount", label: "Amount", type: "number", required: true },
  { name: "payment_mode", label: "Payment Mode", type: "select", options: PAYMENT_MODES },
  { name: "paid_to", label: "Paid To" },
  { name: "description", label: "Description", type: "textarea" },
  { name: "remarks", label: "Remarks", type: "textarea" },
];

export default function Expenses() {
  async function decide(row, status, reload) {
    try {
      await api.post(`/expenses/${row.id}/decision`, { approval_status: status });
      await reload();
    } catch (err) {
      alert(apiErrorMessage(err));
    }
  }

  return (
    <ResourceCrud
      title="Expenses"
      endpoint="/expenses"
      columns={columns}
      formFields={formFields}
      exportFilename="expenses"
      extraActions={(row, reload) =>
        row.approval_status === "pending" ? (
          <span key="decision">
            <button className="text-emerald-700 hover:underline text-xs font-medium mr-2" onClick={() => decide(row, "approved", reload)}>
              Approve
            </button>
            <button className="text-red-600 hover:underline text-xs font-medium" onClick={() => decide(row, "rejected", reload)}>
              Reject
            </button>
          </span>
        ) : null
      }
    />
  );
}
