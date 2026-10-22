# WasteWise API: local SQL Server setup

The API maps the existing `WasteWiseDB.dbo.Users` table; it does not create,
alter, seed, or migrate that table. The mapping matches its verified columns:
`UserID`, `Name`, `Email`, `PasswordHash`, `Role`, and `CreatedAt`. The
existing `Email` unique index protects against duplicate registrations.

## Verified local SQL Server settings

This Windows computer has SQL Server 2025 default instance `MSSQLSERVER`,
`WasteWiseDB`, and Microsoft ODBC Drivers 17 and 18 installed. The instance
accepted the current Windows identity (`DESKTOP-50UOFO0\DELL`) using integrated
authentication, and `dbo.Users` is present. Use `DB_SERVER=localhost` so
registration and API requests run under the same Windows account that
successfully connected in SSMS. The supplied `DESKTOP-50U0F00` hostname did not
resolve; the verified computer name is `DESKTOP-50UOFO0` (letter O).

The current `backend/.env` explicitly uses **Windows integrated
authentication**, with no database username or password in the frontend. The
application does not assume an authentication mode when `DB_AUTHENTICATION` is
missing; select `windows` or `sql` in `backend/.env` to match your SQL Server
connection. For SQL authentication, set `DB_USERNAME` and `DB_PASSWORD` there.
The development settings enable encryption and trust the local SQL Server
certificate. For a production SQL Server, configure a trusted certificate and
set `DB_TRUST_SERVER_CERTIFICATE=no`.

## Install and configure (PowerShell)

Run these commands from the `WasteWise-AI` project root. `uv` and the
Microsoft ODBC Driver 18 must be installed; ODBC Drivers 17 and 18 were found
on the development computer.

```powershell
uv venv backend\.venv
uv pip install --python backend\.venv\Scripts\python.exe -r backend\requirements.txt
if (-not (Test-Path backend\.env)) { Copy-Item backend\.env.example backend\.env }
$envFile = 'backend\.env'
notepad $envFile
$secret = & backend\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_urlsafe(48))"
$envPath = (Resolve-Path backend\.env).Path
$envText = [System.IO.File]::ReadAllText($envPath)
$envText = $envText.Replace("replace-with-a-random-secret-at-least-32-characters", $secret)
[System.IO.File]::WriteAllText($envPath, $envText, [System.Text.UTF8Encoding]::new($false))
```

`backend\.env` is ignored by Git. Keep it on the backend machine only; never
paste its contents into frontend configuration, source control, screenshots,
or support tickets. To use another verified ODBC driver, change `DB_DRIVER` in
`backend\.env` to the exact installed driver name.

Start the API in the first PowerShell window:

```powershell
backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```

Verify health and SQL connectivity in a second PowerShell window:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/healthz
Invoke-RestMethod http://127.0.0.1:8000/api/v1/health/db
```

The database check should return `status: connected`, `database: WasteWiseDB`,
the authentication mode you selected, and `users_table: dbo.Users`. An SQL/ODBC failure
returns HTTP 503; server-side logs contain the connection exception, while the
API response does not disclose connection strings or passwords.

## Run the frontend

From the project root, install frontend dependencies once, then start Vite in
a separate PowerShell window:

```powershell
Set-Location frontend
npm.cmd install
npm.cmd run dev
```

The development server proxies `/api` and `/healthz` to the local backend. Open
the URL printed by Vite (normally `http://localhost:5173`).

## Register and sign in

Registration creates a row in the already-existing `dbo.Users` table. Set a
real store-manager name, email, and password in the request below. Passwords
must contain 12-128 characters.

```powershell
$registration = Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8000/api/v1/auth/register `
  -ContentType 'application/json' `
  -Body (@{
    name = 'Alex Morgan'
    email = 'alex@example.com'
    password = 'replace-with-your-own-12-character-password'
  } | ConvertTo-Json)
$token = $registration.access_token
$registration.user
```

Verify that the JWT can retrieve the authenticated user:

```powershell
Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/api/v1/auth/me `
  -Headers @{ Authorization = "Bearer $token" }
```

Sign in again using the same email and password:

```powershell
$login = Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8000/api/v1/auth/login `
  -ContentType 'application/json' `
  -Body (@{
    email = 'alex@example.com'
    password = 'replace-with-your-own-12-character-password'
  } | ConvertTo-Json)
$token = $login.access_token
```

The React app persists only its short-lived bearer token in browser local
storage. It never receives a database connection string, database credential,
or JWT signing secret. Registration, login, session verification, and sign-out
are wired to the API; existing application pages remain behind the login gate.
The Vite development server proxies `/api` to `127.0.0.1:8000`.

## Run backend tests

```powershell
backend\.venv\Scripts\python.exe -m pytest backend\tests -q
```

Authentication tests use a temporary in-memory SQLite database and do not
write test accounts to `WasteWiseDB`.
