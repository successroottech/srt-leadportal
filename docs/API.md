# API Reference

Base URL: `http://<host>:8000/api/v1`

The full interactive reference (request/response schemas, try-it-out) is always
available once the backend is running:

- Swagger UI: `http://<host>:8000/docs`
- ReDoc: `http://<host>:8000/redoc`
- Raw OpenAPI JSON: `http://<host>:8000/api/v1/openapi.json`

## Authentication

All endpoints except `POST /auth/login` require a Bearer JWT:

```
Authorization: Bearer <access_token>
```

```
POST /auth/login          { "identifier": "email or mobile", "password": "..." }
                            -> { access_token, token_type, role, name, user_id }
POST /auth/logout
GET  /auth/me
POST /auth/change-password { old_password, new_password }
GET  /auth/login-history
```

Tokens are JWT (HS256), expire after `ACCESS_TOKEN_EXPIRE_MINUTES` (default 480),
and carry `user_id` + `role`. Role-based access control is enforced per-endpoint
via FastAPI dependencies (`require_roles(...)`), not just in the UI.

## Modules

| Module | Base path | Notes |
|---|---|---|
| Roles & permissions | `/roles` | Admin only |
| Staff | `/staff` | Admin/HR |
| Courses | `/courses` | incl. `/courses/{id}/syllabus` |
| Batches | `/batches` | incl. `/topics`, `/sessions`, `/progress`, `/students` |
| Students | `/students` | incl. `/transfer-batch`, `/batch-history`, `/me` (self) |
| Leads | `/leads` | incl. `/duplicate-check`, `/assign`, `/bulk-assign`, `/followups`, `/convert` |
| Candidates | `/candidates` | incl. `/bulk-assign`, `/interviews` |
| Attendance | `/attendance` | `/staff/login`, `/staff/logout`, `/students/mark`, `/students/batch/{id}` |
| Fees | `/fees` | `/payments`, `/dues/{today,upcoming,overdue}`, `/my/summary`, `/my/payments` |
| Expenses | `/expenses` | incl. `/decision` (approve/reject) |
| Leave & permission | `/leave` | `/staff`, `/student`, `/{id}/decision` |
| Notifications | `/notifications` | `/unread-count`, `/{id}/read`, `/{id}/dismiss`, `/mark-all-read` |
| Feedback & complaints | `/feedback` | student submits, admin/HR `/respond` |
| Dashboards | `/dashboards` | `/admin`, `/hr`, `/telecaller`, `/trainer`, `/student`, `/leads`, `/attendance`, `/fees`, `/profit`, `/batches` |
| Audit log | `/audit-logs` | Admin only, filterable by module/user/date |
| File uploads | `/uploads` | multipart upload, returns `/uploads/<file>` static path |

## Role-based access summary

- **Admin**: full access to every endpoint.
- **HR**: staff, attendance (view/report), leave approvals, candidates, students
  (view/create/edit), reports. Cannot delete the Admin account or approve
  financial records beyond what's explicitly granted.
- **Telecaller**: sees and edits only leads/candidates assigned to them
  (enforced server-side, not just hidden in the UI); cannot delete or export
  leads, cannot reassign ownership.
- **Trainer**: sees only their own assigned batches/students; can mark
  attendance and update syllabus topic status for those batches.
- **Student**: read-only self-service via `/students/me`, `/fees/my/*`,
  `/attendance/students/me`, plus creating their own leave requests and
  feedback/complaints.

## Duplicate prevention

`POST /leads` and `POST /candidates` check mobile + email before insert and
return **409 Conflict** with the existing record's id if a duplicate exists.
`GET /leads/duplicate-check?mobile=...&email=...` lets the UI check before
submitting a form (used by the "New Lead" screen).

## Business-rule endpoints worth knowing

- `POST /leads/{id}/convert` — creates a `Student` (+ optional login account +
  `StudentFee`/`FeeEmi` schedule) from a lead and marks it `converted`.
  `POST /students` does the same fee/EMI setup for a direct admission.
- `POST /fees/payments` — records a payment, applies it to the specified EMI (or
  auto-applies oldest-unpaid-first), and recalculates `balance_fee` server-side.
- `POST /batches` — clones the course's syllabus template into `batch_topics` so
  each batch tracks its own progress independently.
- Every mutating endpoint writes an `audit_logs` row via `services/audit.py`.
