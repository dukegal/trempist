# TREMPIST MVP (Python)

Minimal FastAPI backend scaffold based on the provided design and guidelines.

## Local run

1. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

2. Start API server (from repo root `d:\2.Shani\Project`, not `frontend/`):

   ```bash
   py -m pip install -r requirements.txt
   py -m uvicorn app.main:app --reload
   ```

   On Windows use **`py`**, not `python` — the `python` command often opens the Microsoft Store stub.
   On macOS/Linux use `python3` instead of `py`.

3. Open docs:
   - http://127.0.0.1:8000/docs

## Local auth (TCP client → server) → paste JWT in browser

Registration and login are **not** in FastAPI. Use the local TCP auth stack:

1. `.env` in repo root with the **same** `DATABASE_URL` and `SECRET_KEY` as Render (Supabase Postgres).
2. Terminal A — TCP auth server only (not bundled with FastAPI):

   ```powershell
   .\tools\run_local_auth.ps1
   ```

   Or: `py -m app.auth_socket_server`

3. Terminal B — register or login:

   ```powershell
   py -m app.auth_socket_client register
   py -m app.auth_socket_client login
   ```

4. Copy `token` from the JSON output → paste in the web login screen.

5. Frontend `.env`: `VITE_API_BASE_URL=https://your-trempist-api.onrender.com`

The auth server stores users in Supabase (via `DATABASE_URL`) using `hash_password` and returns a JWT. Render FastAPI only validates that JWT for rides/matches — no local `uvicorn` required for the app itself.

## Deploy on Render + Supabase

1. Create a Supabase project and copy the Postgres connection string.
2. In Render, create a Web Service connected to this repo.
3. Use:
   - Build command: `pip install -r requirements.txt`
   - Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Add environment variables in Render:
   - `DATABASE_URL` = Supabase Postgres URI
   - `SECRET_KEY` = long random secret string
   - `TOKEN_EXPIRE_HOURS` = `24` (or your preferred value)
   - `CORS_ORIGINS` = comma-separated origins, for example:
     - `https://your-frontend.onrender.com,https://your-domain.com`

### Notes

- For local development, the app still falls back to SQLite if `DATABASE_URL` is missing.
- In production, always set `DATABASE_URL` and `SECRET_KEY`.
- If your Supabase URL starts with `postgres://`, the app auto-converts it to `postgresql://`.

## Implemented MVP endpoints

- **User registration / login:** local TCP client → TCP auth server (`py -m app.auth_socket_server`, port 9000).
  - Client: `py -m app.auth_socket_client register|login`
  - Server writes to Supabase/Postgres (`hash_password` + JWT); paste token in browser
  - **No** HTTP auth endpoints on FastAPI; auth server is **not** started by FastAPI
- `GET /users/me` (JWT validation only)
- `POST /rides`
- `POST /rides/search`
- `GET /rides/mine`
- `GET /users/{user_id}/rides`
- `POST /matches/request`
- `POST /matches/accept`
- `POST /matches/reject`
- `POST /matches/cancel`
- `POST /matches/complete`
- `POST /matches/confirm` (backward-compatible alias)
- `GET /matches/my-requests`
- `GET /matches/driver-pending`
- `GET /matches/driver-active`
- `POST /ratings`
- `POST /admin/block/{user_id}`

## Frontend (React)

The `frontend` folder contains a React + Vite MVP connected to this backend.

1. Set API URL:

   - Create `frontend/.env` with:
     - `VITE_API_BASE_URL=https://your-render-api.onrender.com`
     - `VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key`

2. Run frontend:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

### Google Maps setup

- In Google Cloud, enable:
  - Maps JavaScript API
  - Places API
- Add your frontend domain (Render URL) to API key restrictions.
- Set `VITE_GOOGLE_MAPS_API_KEY` in your frontend Render environment variables.
