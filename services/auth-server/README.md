# TREMPIST Auth Server (Render Private Service)

Raw TCP authentication server. **Not public** — only the FastAPI web service connects to it over Render's private network.

## Architecture

```
Browser  --HTTPS-->  trempist-api (FastAPI)  --TCP-->  trempist-auth (this service)
                                                      |
                                                      v
                                                 Supabase Postgres
```

- Register/login logic: `app/user_manager.py` (via `app/auth_socket_server.py`)
- Passwords stored with `hash_password()`; JWT signed with `SECRET_KEY`
- FastAPI exposes `POST /auth/register` and `POST /auth/login` and proxies here

## Render setup

### 1. Create Private Service

In [Render Dashboard](https://dashboard.render.com) → **New** → **Private Service**:

| Field | Value |
|--------|--------|
| Name | `trempist-auth` |
| Root Directory | *(leave empty — repo root)* |
| Build Command | `pip install -r requirements.txt` |
| Start Command | `sh services/auth-server/start.sh` |
| Plan | Starter or higher (private services require a paid plan) |

### 2. Environment variables (auth service)

| Key | Value |
|-----|--------|
| `DATABASE_URL` | Supabase Postgres URI (same as API) |
| `SECRET_KEY` | Same as API service |
| `AUTH_SOCKET_HOST` | `0.0.0.0` |
| `TOKEN_EXPIRE_HOURS` | `24` |
| `AUTH_PEPPER` | Optional, same as API if set |

Render sets `PORT` automatically — `start.sh` uses it.

### 3. API web service env vars

On **trempist-api** add:

| Key | Value |
|-----|--------|
| `AUTH_SOCKET_HOST` | `trempist-auth` (private service name) |
| `AUTH_SOCKET_PORT` | `10000` (default Render private service port) |

Both services must be in the **same region**.

### 4. Blueprint (optional)

Root `render.yaml` includes both services. Deploy with **New Blueprint** or merge into your existing stack.

## Local development

Terminal A — auth server:

```powershell
.\services\auth-server\start.ps1
```

Terminal B — API:

```powershell
py -m uvicorn app.main:app --reload
```

Default: API connects to `127.0.0.1:9000`. Set in repo root `.env`:

```
AUTH_SOCKET_HOST=127.0.0.1
AUTH_SOCKET_PORT=9000
```

## CLI (optional)

Direct TCP client (bypasses FastAPI):

```powershell
py -m app.auth_socket_client login
```

## Health check

When running, logs show:

```
[AuthServer] Listening on 0.0.0.0:10000
```
