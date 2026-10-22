# WasteWise AI

The existing app is split into a React + TypeScript frontend and a FastAPI
backend. Its current local SQL Server configuration and full setup, auth, and
health-check instructions are in [backend/README.md](backend/README.md).

## Run locally

Configure `backend\.env` as described in the backend guide first. Start these
in separate PowerShell windows from this project directory.

Backend:

```powershell
.\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```

Frontend:

```powershell
Set-Location frontend
npm.cmd run dev
```

The frontend uses Vite's `/api` proxy to reach the backend. To check SQL Server,
open a third PowerShell window and run:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/v1/health/db
```

The database health route returns the connection status and mapped users table
name without exposing database credentials.