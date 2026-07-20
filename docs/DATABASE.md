# Database Design

**Engine:** PostgreSQL 13+
**Canonical DDL:** [`database/schema.sql`](../database/schema.sql) — this file is the
single source of truth for the schema. The backend's Alembic migration
(`backend/alembic/versions/0001_initial_schema.py`) simply executes it, so the
schema is never defined twice.

## How to create the database and tables

```bash
# Option A: run the SQL file directly (fastest, no Python needed)
psql "postgresql://srtdb:PASSWORD@HOST:5432/srt-leadportal" -f database/schema.sql

# Option B: via Alembic (recommended once the backend is deployed —
# tracks future migrations too)
cd backend
cp .env.example .env   # fill in real DATABASE_URL / SECRET_KEY
alembic upgrade head
python seed.py          # creates default roles' permissions + admin login + a sample course
```

Both paths are idempotent — `schema.sql` uses `CREATE TABLE IF NOT EXISTS` /
`CREATE INDEX IF NOT EXISTS` and can be re-run safely.

## Entity overview

**Identity & access**
- `roles`, `role_permissions` — role-based access control; the five system roles
  (`admin`, `hr`, `telecaller`, `trainer`, `student`) are seeded automatically and
  cannot be deleted. Custom roles can be added by the Admin.
- `users` — every staff login (Admin/HR/Telecaller/Trainer) **and** every student
  login. Students carry an optional `students.user_id` back-reference to their
  `users` row.
- `login_history` — every login/logout event, staff or student.

**Courses & batches**
- `courses`, `course_materials`, `course_syllabus_modules`, `course_syllabus_topics`
  — the course catalog and its reusable syllabus template.
- `batches`, `batch_topics`, `class_sessions` — a batch clones the course's syllabus
  into its own `batch_topics` rows at creation time so each batch tracks its own
  progress independently of the course template.

**Students & fees**
- `students`, `student_batch_history`, `student_documents`
- `student_fees`, `fee_emis`, `payments` — `student_fees.balance_fee` is always
  recalculated server-side from `final_fee - (initial_payment + sum(emi.paid_amount))`,
  never trusted from client input.

**Leads, candidates & telecalling**
- `leads`, `lead_followups` — `leads.mobile` and the partial unique index on
  `leads.email` enforce duplicate prevention at the database level (the API also
  checks proactively and returns the existing lead on conflict).
- `candidates`, `candidate_interviews` — same duplicate-prevention pattern.

**Attendance & leave**
- `staff_attendance`, `student_attendance`
- `leave_requests` — a single table for both "leave" and "permission" requests,
  for both staff (`user_id`) and students (`student_id`), enforced mutually
  exclusive by a `CHECK` constraint.

**Finance**
- `expenses` — category + approval workflow (`pending` → `approved`/`rejected`).

**Notifications, feedback, audit**
- `notifications` — per-user or per-student, `unread`/`read`/`dismissed`.
- `feedback_complaints` — student-submitted, admin-resolved.
- `audit_logs` — every create/update/delete/approve/reject/assign/login/logout
  records `user_id` or `student_id`, `action`, `module`, `record_id`, and (where
  applicable) `previous_value`/`updated_value` as JSONB.

## Key business rules enforced at the data layer

1. `leads.mobile` is `UNIQUE`; `leads.email` has a partial unique index (ignores
   NULLs) — duplicate leads cannot be inserted.
2. Same pattern on `candidates` and `students`.
3. `fee_emis` and `staff_attendance`/`student_attendance` have composite unique
   constraints so the same EMI number or the same day can't be double-recorded.
4. All money columns are `NUMERIC(12,2)` — never floating point.
5. `updated_at` columns are maintained by a shared `set_updated_at()` trigger,
   not application code, so it's impossible to forget to bump it.

## Extending the schema

Add new tables/columns to `database/schema.sql`, add a matching SQLAlchemy model
under `backend/app/models/`, then create a normal Alembic migration for the diff:

```bash
cd backend
alembic revision --autogenerate -m "describe the change"
alembic upgrade head
```
