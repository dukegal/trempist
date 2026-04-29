# TREMPIST MVP (Python)

Minimal FastAPI backend scaffold based on the provided design and guidelines.

## Run

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

## Implemented MVP endpoints

- `POST /auth/register`
- `POST /auth/login`
- `GET /users/me`
- `POST /rides`
- `POST /rides/search`
- `POST /matches/request`
- `POST /matches/confirm`
- `POST /ratings`
- `POST /admin/block/{user_id}`
