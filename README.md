# TREMPIST MVP (Python)

Minimal FastAPI backend scaffold based on the provided design and guidelines.

## Local run

1. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

2. Start API server:

   ```bash
   uvicorn app.main:app --reload
   ```

3. Open docs:
   - http://127.0.0.1:8000/docs

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

- `POST /auth/register`
- `POST /auth/login`
- `GET /users/me`
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
