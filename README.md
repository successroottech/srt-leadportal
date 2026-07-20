# SRT Management Portal

A web-based, mobile-responsive management portal for **Success Root
Technologies** covering leads/telecalling, admissions, course & batch
management, trainer activities, staff & student attendance, fee collection
(with EMI schedules), expenses & profit reporting, candidate placement
tracking, leave/permission workflows, in-app notifications, and feedback &
complaints — with role-based dashboards for **Admin, HR, Telecaller, Trainer,
and Student**.

Built entirely on first-party code — no third-party SaaS/API dependencies
(no WhatsApp/SMS/payment-gateway integrations). See `docs/SRS.md` §19 for what
is and isn't implemented yet.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite, Tailwind CSS, React Router |
| Backend | Python, FastAPI, SQLAlchemy 2.0, Alembic |
| Database | PostgreSQL |
| Auth | JWT (HS256) + bcrypt password hashing, RBAC enforced server-side |

## Repository layout

```
database/    schema.sql — canonical DDL for every table (source of truth)
backend/     FastAPI app, SQLAlchemy models, Alembic migrations, seed script
frontend/    React + Vite + Tailwind SPA
docs/        SRS.md, DATABASE.md, API.md, DEPLOYMENT.md
```

## Quick start (local development)

### 1. Database

```bash
psql "postgresql://<user>:<password>@<host>:5432/<db>" -f database/schema.sql
```

(or use Alembic — see `docs/DATABASE.md`)

### 2. Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # fill in DATABASE_URL and SECRET_KEY
alembic upgrade head        # only if you didn't already run schema.sql directly
python seed.py               # default roles' permissions + admin login + sample course
uvicorn app.main:app --reload --port 8000
```

Default admin login created by `seed.py`:
- **Email:** `admin@srt.local` · **Mobile:** `9999999999` · **Password:** `Admin@12345`
- Change this password immediately after first login.

API docs: `http://localhost:8000/docs`

### 3. Frontend

```bash
cd frontend
cp .env.example .env        # VITE_API_URL=http://localhost:8000/api/v1
npm install
npm run dev
```

Open `http://localhost:5173`.

## Documentation

- [`docs/SRS.md`](docs/SRS.md) — full requirements spec + implementation status
- [`docs/DATABASE.md`](docs/DATABASE.md) — schema design, ERD overview, business rules
- [`docs/API.md`](docs/API.md) — REST API reference
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Hostinger VPS deployment (Docker/CI-CD to follow later)

## Security notes

- Passwords are bcrypt-hashed, never stored in plaintext.
- JWT tokens expire (`ACCESS_TOKEN_EXPIRE_MINUTES`, default 8h) and are
  validated server-side on every request.
- Role-based access control is enforced in the API layer (not just hidden in
  the UI) — e.g. a telecaller's JWT cannot fetch another telecaller's leads
  no matter what the frontend sends.
- Login lockout after repeated failed attempts (`MAX_LOGIN_ATTEMPTS` /
  `LOCKOUT_MINUTES`).
- Every create/update/delete/approve/assign/login/logout is written to
  `audit_logs`.
- `.env` files (real secrets/credentials) are git-ignored — never commit them.
