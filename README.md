# Attendix - Cloud-Based Attendance Management System

Attendix is a full-stack attendance workspace for campuses. Faculty mark class registers in
seconds, administrators manage rosters and policies, and students can see their own attendance
and shared class lists without ever seeing anyone else's data.

The application ships with **no demo accounts and no seeded records**. After migrations the
database is empty; the first administrator is created with a one-time CLI command. All dashboards
and reports read live PostgreSQL data.

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, React Router, React Hook Form + Zod,
  Recharts, Axios
- **Backend:** FastAPI, SQLAlchemy 2, Alembic, PostgreSQL (Neon-ready), Pydantic v2, Argon2, JWT
- **Tests:** Pytest + FastAPI TestClient (38 backend tests), Vitest + Testing Library (21 frontend
  tests)

## Feature overview

### Everyone
- Secure HttpOnly-cookie session with CSRF protection
- Light and dark appearance, responsive layouts, accessible dialogs and forms
- Toast notifications, inline validation, empty/loading/error states

### Administrators
- Dashboard scoped to the whole campus or a single class/subject
- Classes, subjects and faculty-class assignments
- Student roster management, CSV import, portal-account creation, activation
- User management: create faculty/admin/student accounts, edit roles, reset passwords
- Attendance policy (threshold, OD/leave counting) and immutable audit log
- Attendance registers, finalization/unlocking, CSV/XLSX exports
- Student, subject, class and session-history reports with charts and exports

### Faculty
- Dashboard limited to assigned classes
- Student roster, attendance sessions, custom lists and reports for assigned classes
- Mark present/absent/OD/leave with remarks, save drafts, finalize registers
- Custom lists with configurable status options, bulk updates, archive/restore, exports

### Students
- Personal attendance dashboard with subject-wise progress and threshold warnings
- Full session history with filters and pending-finalization indicators
- Shared custom lists with personal status and faculty remarks
- Profile, account security and appearance settings

## Attendance rules

- Only **finalized** sessions contribute to attendance percentages.
- `attended = present + (OD if policy allows) + (leave if policy allows)`.
- The default threshold is **75%** and can be changed by staff in Settings.
- A class with no eligible sessions reports **0%**, not 100%.
- Finalizing a session requires a status for every active student.
- Inactive students remain in historical registers but are excluded from new sessions.
- Sessions are unique per `(class, subject, date, session number)` and future dates are rejected.

## Repository layout

```text
.
|-- backend/
|   |-- alembic/                 # Migration environment and versions
|   |-- app/
|   |   |-- api/v1/              # Auth, classes, students, attendance, lists, reports, admin
|   |   |-- core/                # Config, security, dependencies
|   |   |-- db/                  # Engine, sessions, declarative base
|   |   |-- models/              # 11 SQLAlchemy models
|   |   |-- schemas/             # Pydantic request/response contracts
|   |   |-- services/            # Attendance math, reports, lists, exports, dashboard, audit
|   |   |-- main.py              # App factory, middleware, exception handlers
|   |   |-- check_db.py          # Connection and schema diagnostic command
|   |   `-- create_admin.py      # First-administrator bootstrap command
|   |-- tests/                   # Pytest suite
|   |-- Dockerfile
|   |-- requirements.txt
|   `-- requirements-dev.txt
|-- frontend/
|   |-- src/
|   |   |-- components/          # Design system, attendance selector, layout pieces
|   |   |-- contexts/            # Auth, theme, toasts
|   |   |-- layouts/             # Auth and authenticated application shells
|   |   |-- pages/               # auth, admin, staff, student
|   |   |-- services/            # Axios client, CSRF, grouped API endpoints
|   |   |-- hooks/               # Data fetching and debouncing
|   |   `-- lib/                 # Types helpers, formatting, Zod schemas
|   |-- vercel.json
|   `-- vite.config.ts
|-- render.yaml                  # Render API blueprint (uses Neon)
`-- .gitignore
```

## Option A: Neon PostgreSQL (recommended)

1. Create a project at [neon.tech](https://neon.tech) and open **Connect**.
2. Copy the **pooled** connection string. Its host contains `-pooler` and it ends with
   `?sslmode=require` (often also `&channel_binding=require`).
3. In `backend/.env`, set:

   ```dotenv
   APP_ENV=development
   DATABASE_URL=postgresql://USER:PASSWORD@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require
   JWT_SECRET_KEY=replace-with-a-long-random-secret-at-least-32-characters
   CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
   COOKIE_SECURE=false
   COOKIE_SAMESITE=lax
   ALLOW_PUBLIC_REGISTRATION=true
   ```

   The application accepts `postgres://`, `postgresql://` or `postgresql+psycopg://` and uses the
   psycopg 3 driver automatically. Keep the password URL-encoded if it contains special
   characters. You can copy `.env.example` as a starting point.

4. Install, migrate and verify the connection:

   ```powershell
   cd backend
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements-dev.txt
   alembic upgrade head
   python -m app.check_db
   ```

   On macOS/Linux use `source .venv/bin/activate`.
   `check_db` prints the host, database, provider, SSL state, table/migration status and the
   number of active administrators. It never prints the password.

5. Create the first administrator. The easiest way is through the UI: start the frontend and open
   `http://localhost:5173/setup` (the login page shows a **Create administrator account** link
   while no administrator exists). Alternatively use the CLI:

   ```powershell
   python -m app.create_admin --email admin@yourdomain.edu --name "Campus Administrator"
   ```

   The CLI prompts for the password twice. Password rules: at least 8 characters, with a letter
   and a number. The password is not stored in shell history. The one-time setup endpoint refuses
   to run again once an active administrator exists. After setup, use the **Users** page or the
   public **Create an account** link (faculty signup) to add people.

6. Start the API and frontend:

   ```powershell
   uvicorn app.main:app --reload
   ```

   ```powershell
   cd ..\frontend
   npm install
   npm run dev
   ```

The API runs at `http://127.0.0.1:8000` (`/health`, `/docs`, `/api/v1`). The frontend runs at
`http://localhost:5173` and proxies `/api` to the API in development.

### Neon notes

- Use the **pooled** hostname for the application (`-pooler`). The backend automatically disables
  psycopg server-side prepared statements for Neon pooling compatibility.
- SSL is required automatically for remote hosts and is read from `sslmode` in `DATABASE_URL`.
- Neon may suspend idle compute. The first request after a pause can take a few seconds; the
  connection pool uses `pool_pre_ping` and recycling to recover cleanly.
- Free-tier connection limits are small. Keep the default pool size (5) or lower
  `DB_POOL_SIZE`/`DB_MAX_OVERFLOW` when running multiple API instances.

## Option B: local PostgreSQL

Create the databases and role:

```sql
CREATE ROLE attendance LOGIN PASSWORD 'attendance_dev_pw';
CREATE DATABASE attendance OWNER attendance;
CREATE DATABASE attendance_test OWNER attendance;
```

Use `backend/.env.example`, set `DATABASE_URL` to
`postgresql+psycopg://attendance:attendance_dev_pw@localhost:5432/attendance`, then run
`alembic upgrade head` and `python -m app.check_db` as above. The schema is empty until real data
is entered; there is no seed command.

## Connection diagnostics

```powershell
cd backend
python -m app.check_db
```

Exit code `0` means the connection and all expected tables are present. Exit code `1` lists the
missing schema or connection error and the next command to run. Common fixes:

- `sslmode` errors: append `?sslmode=require` to `DATABASE_URL`.
- authentication errors: re-copy the Neon string and URL-encode special password characters.
- incomplete schema: run `alembic upgrade head`.
- zero admins: run `python -m app.create_admin ...`.

## Tests

Backend tests use a separate database and recreate/truncate their own tables:

```powershell
cd backend
$env:TEST_DATABASE_URL = "postgresql+psycopg://attendance:attendance_dev_pw@localhost:5432/attendance_test"
.\.venv\Scripts\python.exe -m pytest -q
```

Frontend:

```powershell
cd frontend
npm test
npm run build
```

The test database URL defaults to
`postgresql+psycopg://attendance:attendance_dev_pw@localhost:5432/attendance_test`. Override
`TEST_DATABASE_URL` if PostgreSQL runs on another port or uses different credentials. Never point
`TEST_DATABASE_URL` at your production database: the suite drops and truncates tables.

## API surface

| Area | Routes |
| --- | --- |
| Auth | `GET /auth/setup-status`, `POST /auth/setup`, `POST /auth/login`, `POST /auth/register`, `GET /auth/me`, `POST /auth/logout`, `POST /auth/change-password` |
| Classes & subjects | `GET/POST /classes`, `PATCH /classes/{id}`, `GET /classes/{id}/students`, `GET /classes/{id}/subjects`, `GET/POST/PATCH/DELETE /subjects` |
| Students | `GET/POST /students`, `PATCH /students/{id}`, `GET /students/me`, `POST /students/import`, `POST /students/{id}/account` |
| Attendance | `GET/POST /attendance/sessions`, `GET /attendance/sessions/{id}`, `PUT /attendance/sessions/{id}/records`, `PATCH /attendance/sessions/{id}/finalize`, session exports |
| Reports | `GET /attendance/reports/summary`, `/student/{id}`, `/student/me`, `/history`, `/subject`, `/class`, report exports |
| Custom lists | `GET/POST /custom-lists`, `GET /custom-lists/me`, `GET/PATCH /custom-lists/{id}`, entries, bulk status, summary, archive, exports |
| Dashboard & settings | `GET /dashboard`, `GET/PATCH /settings` |
| Administration | `GET /users`, `POST /users`, `PATCH /users/{id}`, `POST /users/{id}/reset-password`, `GET /admin/faculty`, `PUT /admin/faculty/{id}/classes`, `GET /audit-logs` |

All routes are prefixed with `/api/v1`. Only `GET`, `HEAD` and `OPTIONS` skip the CSRF check.

## Security notes

- Passwords are hashed with **Argon2**.
- Sessions use an **HttpOnly** JWT cookie plus a separate JS-readable CSRF cookie; unsafe requests
  must include `x-csrf-token`. Auth responses also expose the token in the `X-CSRF-Token` header,
  which lets the SPA work when the API and frontend are on different origins.
- Role and class-scope checks run in dependencies before data is returned.
- HTTP middleware adds security headers; production mode refuses the default development JWT
  secret and insecure `SameSite=None` cookies.
- CSV exports neutralize spreadsheet formula injection; XLSX exports convert timezone-aware values
  to UTC before writing.
- Administrative changes are recorded in `audit_logs`, including actor, entity and before/after
  values.
- The login page always exposes account creation when the backend allows it. While no
  administrator exists, it links to the one-time `/setup` flow; after that, it links to faculty
  self-signup. Set `ALLOW_PUBLIC_REGISTRATION=false` for invitation-only onboarding (the login
  page then tells new users to ask an administrator). The `/setup` endpoint is protected by an
  advisory lock and permanently disables itself once an active administrator exists.
- Store `DATABASE_URL`, `JWT_SECRET_KEY` and other secrets in the host's environment settings, not
  in source control. Rotate the JWT secret to invalidate all sessions.

## Deployment

### API on Render with Neon

1. Push the repository to GitHub.
2. In Render, create a **Blueprint** from `render.yaml`.
3. Set `DATABASE_URL` to the Neon pooled connection string, including `sslmode=require`.
4. After the first deploy, set `CORS_ORIGINS` to the exact frontend origin, for example
   `https://attendix.vercel.app`.
5. Open a Render shell and run `python -m app.check_db`. The start command already runs
   `alembic upgrade head`; if there are no administrators, use the deployed frontend's
   **Create administrator account** link or run `python -m app.create_admin ...`.
6. Copy the API URL, e.g. `https://attendix-api.onrender.com`.

The Dockerfile is also suitable for Fly.io, Railway, ECS or any container host. The container runs
`alembic upgrade head` before starting Uvicorn.

### Frontend on Vercel

1. Import the repository and set the **root directory** to `frontend`.
2. Framework preset: **Vite**. Build command: `npm run build`. Output directory: `dist`.
3. Add the environment variable:

   ```text
   VITE_API_BASE_URL=https://attendix-api.onrender.com/api/v1
   ```

4. Deploy. `frontend/vercel.json` adds SPA fallback routing and baseline security/cache headers.

Because the frontend and API are on different sites in production, the backend must use
`COOKIE_SECURE=true`, `COOKIE_SAMESITE=none`, and the frontend origin must be listed in
`CORS_ORIGINS`. Both sides must be served over HTTPS. The API exposes the CSRF token through the
`X-CSRF-Token` response header and the browser sends the session cookie with credentials, so no
same-origin proxy is required.

If browsers in your environment block third-party cookies, place the API behind a custom domain or
same-origin reverse proxy so cookies remain first-party.

## Environment variables

### Backend

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL URL; Neon pooled strings are supported, including `sslmode=require` |
| `JWT_SECRET_KEY` | Long random signing secret (32+ characters) |
| `CORS_ORIGINS` | Comma-separated allowed frontend origins |
| `COOKIE_SECURE` / `COOKIE_SAMESITE` / `COOKIE_DOMAIN` | Session cookie behavior |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Session lifetime (default 480) |
| `ALLOW_PUBLIC_REGISTRATION` | Enables public faculty signup after initial setup; set false for invitation-only |
| `DEFAULT_ATTENDANCE_THRESHOLD` | Initial policy threshold for a fresh database |
| `DB_SSLMODE` | Optional explicit SSL mode; remote hosts default to `require` |
| `DB_POOL_SIZE` / `DB_MAX_OVERFLOW` | SQLAlchemy pool sizing |
| `LOG_LEVEL` | Application log level |

### Frontend

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | API base URL, default `/api/v1` (Vite proxy in development) |

## Notes and limitations

- Attendance records are stored per student per session; edits before finalization are tracked in
  audit entries, and finalization locks the register for faculty.
- The public registration flow creates faculty accounts only. Administrators create student
  portal accounts and link them to an existing student record.
- Runtime production dependencies have a clean `npm audit --omit=dev`. Remaining npm advisories
  are confined to build/test tooling.
