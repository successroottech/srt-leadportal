# Deployment Guide — Hostinger VPS

This covers a manual (non-Docker) deployment, since Docker + CI/CD is explicitly
planned as a later phase. Everything here also works unchanged once that phase
adds containers — the app itself doesn't need to change, only how it's run.

## 0. What you need on the VPS

- Ubuntu 22.04+ (or similar) VPS from Hostinger
- Python 3.11+, `pip`, `venv`
- Node.js 20+ and `npm` (build-time only — the built frontend is static files)
- Nginx
- PostgreSQL client (`psql`) — the database itself is the managed instance at
  `200.97.171.228:5432`, so you don't need to install PostgreSQL server on the VPS
- A domain (optional but recommended) pointed at the VPS IP for HTTPS via Let's Encrypt

## 1. Create the database schema

From any machine that can reach the DB (including your local machine or the VPS):

```bash
psql "postgresql://srtdb:<PASSWORD>@200.97.171.228:5432/srt-leadportal" -f database/schema.sql
```

This is idempotent — safe to re-run. See `docs/DATABASE.md` for details and the
Alembic alternative.

## 2. Backend (FastAPI)

```bash
cd /var/www/srt-leadportal/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# edit .env:
#   DATABASE_URL=postgresql+psycopg2://srtdb:<PASSWORD>@200.97.171.228:5432/srt-leadportal
#   SECRET_KEY=<generate with: python3 -c "import secrets; print(secrets.token_hex(32))">
#   CORS_ORIGINS=https://your-domain.com

alembic upgrade head   # or skip if you already ran schema.sql directly
python seed.py          # creates default admin login + role permissions — change the password immediately after first login
```

### Run with Gunicorn + systemd

`/etc/systemd/system/srt-backend.service`:

```ini
[Unit]
Description=SRT Management Portal API
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/srt-leadportal/backend
Environment="PATH=/var/www/srt-leadportal/backend/.venv/bin"
ExecStart=/var/www/srt-leadportal/backend/.venv/bin/gunicorn app.main:app \
    -k uvicorn.workers.UvicornWorker \
    --workers 3 \
    --bind 127.0.0.1:8000 \
    --access-logfile - --error-logfile -
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
pip install gunicorn   # inside the venv, add to requirements.txt too
sudo systemctl daemon-reload
sudo systemctl enable --now srt-backend
sudo systemctl status srt-backend
```

## 3. Frontend (React, built as static files)

```bash
cd /var/www/srt-leadportal/frontend
cp .env.example .env
# set VITE_API_URL=https://your-domain.com/api/v1
npm install
npm run build     # outputs to frontend/dist
```

Serve `frontend/dist` as static files via Nginx (below) — there is no Node
server needed in production, it's a pure static build.

## 4. Nginx reverse proxy

`/etc/nginx/sites-available/srt-leadportal`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/srt-leadportal/frontend/dist;
    index index.html;

    # React SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Uploaded files (resumes, receipts, course materials)
    location /uploads/ {
        proxy_pass http://127.0.0.1:8000;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/srt-leadportal /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 5. HTTPS

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## 6. Firewall

Only expose 80/443 (and 22 for SSH) publicly. The backend (8000) and database
(5432) should never be reached directly from the internet — Nginx proxies to
the backend over localhost, and the database has its own credentials/firewall.

```bash
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

## 7. Backups

Take regular `pg_dump` backups of the PostgreSQL database (this is a Security
Requirement in the SRS):

```bash
pg_dump "postgresql://srtdb:<PASSWORD>@200.97.171.228:5432/srt-leadportal" \
    -F c -f "srt_backup_$(date +%F).dump"
```

Schedule this with `cron` and copy the dumps off-VPS (e.g. to object storage)
on a regular cadence.

## 8. Updating the app

```bash
cd /var/www/srt-leadportal
git pull

cd backend && source .venv/bin/activate && pip install -r requirements.txt
alembic upgrade head
sudo systemctl restart srt-backend

cd ../frontend && npm install && npm run build
# nginx serves the new dist/ immediately, no restart needed
```

## Later: Docker + CI/CD

This deployment intentionally stays plain (systemd + Nginx) for now, per the
project owner's instruction to add Docker and a CI/CD pipeline in a later pass.
When that happens:
- `backend/` gets a `Dockerfile` running the existing `app.main:app` via gunicorn
- `frontend/` gets a multi-stage `Dockerfile` (build with Node, serve with Nginx
  or copy `dist/` into the backend's static mount)
- A `docker-compose.yml` ties backend + frontend + (optionally) a local Postgres
  for dev, while production keeps using the managed Postgres instance
- CI runs `pytest`/build checks on push, CD deploys via SSH or a registry pull
  on the VPS

Nothing about the application code needs to change for this — the `.env`-driven
config already matches container-friendly 12-factor conventions.
