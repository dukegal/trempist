import re
from datetime import datetime, timedelta
import os
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import and_, delete, func, inspect, or_, select, text
from sqlalchemy.orm import Session

from app.auth import create_token, decode_token, hash_password, verify_password
from app.database import Base, engine, get_db
from app.models import CreditsLog, Match, MatchStatus, Rating, Ride, RideStatus, User
from app.schemas import (
    LoginIn,
    MatchConfirmIn,
    MatchRequestIn,
    RatingIn,
    RegisterIn,
    RideCreateIn,
    RideOut,
    RideSearchIn,
    TokenOut,
    UserOut,
)

Base.metadata.create_all(bind=engine)


def ensure_match_lifecycle_columns():
    with engine.begin() as conn:
        table_columns = {col["name"] for col in inspect(conn).get_columns("matches")}
        if "status" not in table_columns:
            conn.execute(text("ALTER TABLE matches ADD COLUMN status VARCHAR(20) DEFAULT 'PENDING'"))
            conn.execute(text("UPDATE matches SET status = 'PENDING' WHERE status IS NULL"))
        if "expires_at" not in table_columns:
            conn.execute(text("ALTER TABLE matches ADD COLUMN expires_at TIMESTAMP NULL"))
        if "responded_at" not in table_columns:
            conn.execute(text("ALTER TABLE matches ADD COLUMN responded_at TIMESTAMP NULL"))
        if "completed_at" not in table_columns:
            conn.execute(text("ALTER TABLE matches ADD COLUMN completed_at TIMESTAMP NULL"))


ensure_match_lifecycle_columns()

app = FastAPI(title="טרמפיסט — API")
MATCH_REQUEST_TTL_HOURS = int(os.getenv("MATCH_REQUEST_TTL_HOURS", "24"))


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, _exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "detail": {
                "code": "E422",
                "message": "הנתונים שנשלחו אינם תקינים (אורך, פורמט או ערכים חסרים).",
            }
        },
    )

CORS_ORIGINS = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "*").split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def api_error(http_status: int, code: str, message: str):
    raise HTTPException(status_code=http_status, detail={"code": code, "message": message})


def expire_stale_matches(db: Session):
    now = datetime.utcnow()
    stale_matches = db.scalars(
        select(Match).where(
            and_(
                Match.status == MatchStatus.PENDING,
                Match.expires_at.is_not(None),
                Match.expires_at < now,
            )
        )
    ).all()
    for match in stale_matches:
        match.status = MatchStatus.EXPIRED
        match.responded_at = now
    if stale_matches:
        db.commit()


def get_current_user(
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        api_error(status.HTTP_401_UNAUTHORIZED, "E401", "כותרת הרשאה חסרה או לא תקינה")
    token = authorization.split(" ", 1)[1].strip()
    user_id = decode_token(token)
    user = db.get(User, user_id)
    if not user:
        api_error(status.HTTP_401_UNAUTHORIZED, "E401", "משתמש לא נמצא")
    if user.is_blocked:
        api_error(status.HTTP_403_FORBIDDEN, "E012", "המשתמש חסום")
    return user


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/auth/register", response_model=TokenOut)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing:
        api_error(status.HTTP_400_BAD_REQUEST, "E002", "כתובת האימייל כבר רשומה במערכת")
    user = User(
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        password_hash=hash_password(payload.password),
        credits=0,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"token": create_token(user.id), "user_id": user.id}


@app.post("/auth/login", response_model=TokenOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email))
    if not user or not verify_password(payload.password, user.password_hash):
        api_error(status.HTTP_401_UNAUTHORIZED, "E001", "אימייל או סיסמה שגויים")
    if user.is_blocked:
        api_error(status.HTTP_403_FORBIDDEN, "E012", "המשתמש חסום")
    return {"token": create_token(user.id), "user_id": user.id}


@app.get("/users/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@app.post("/rides", response_model=RideOut)
def publish_ride(
    payload: RideCreateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ride = Ride(
        driver_id=current_user.id,
        origin=payload.origin,
        destination=payload.destination,
        departure_time=payload.departure_time,
        seats_total=payload.seats_total,
        seats_available=payload.seats_total,
        status=RideStatus.OPEN,
    )
    db.add(ride)
    db.commit()
    db.refresh(ride)
    return ride


def _destination_is_any(value: str) -> bool:
    v = (value or "").strip().lower()
    return v in ("", "any", "*", "all", "everywhere", "כל", "הכל")


def _search_tokens(text: str) -> list[str]:
    """Split on spaces/commas; keep non-empty parts for city-style matching."""
    parts = re.split(r"[\s,]+", (text or "").strip().lower())
    return [p for p in parts if p]


def _location_matches_column(column, query: str):
    """Flexible location matching for city/full address inputs from autocomplete."""
    q = (query or "").strip().lower()
    if not q:
        return True
    hay = func.lower(column)
    segments = [part.strip() for part in q.split(",") if part.strip()]
    tokens = _search_tokens(q)
    strong_tokens = [t for t in tokens if len(t) >= 3]
    if not segments and not tokens:
        return hay.contains(q)
    # Keep strong precision match, but also allow segment/token-level match.
    clauses = [hay.contains(q)]
    clauses.extend(hay.contains(segment) for segment in segments if len(segment) >= 2)
    clauses.extend(hay.contains(token) for token in strong_tokens)
    return or_(*clauses)


@app.post("/rides/search", response_model=list[RideOut])
def search_rides(payload: RideSearchIn, db: Session = Depends(get_db)):
    now_minus = datetime.utcnow() - timedelta(hours=1)
    filters = [
        Ride.status == RideStatus.OPEN,
        Ride.seats_available > 0,
        _location_matches_column(Ride.origin, payload.origin),
        Ride.departure_time >= now_minus,
    ]
    if not _destination_is_any(payload.destination):
        filters.append(_location_matches_column(Ride.destination, payload.destination))
    rides = db.scalars(select(Ride).where(and_(*filters))).all()
    return rides


@app.get("/rides/mine", response_model=list[RideOut])
def my_rides(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rides = db.scalars(
        select(Ride).where(Ride.driver_id == current_user.id).order_by(Ride.departure_time.desc())
    ).all()
    return rides


@app.delete("/rides/{ride_id}")
def delete_my_ride(ride_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ride = db.get(Ride, ride_id)
    if not ride:
        api_error(status.HTTP_404_NOT_FOUND, "E404", "הנסיעה לא נמצאה")
    if ride.driver_id != current_user.id:
        api_error(status.HTTP_403_FORBIDDEN, "E403", "רק נהג הנסיעה יכול למחוק אותה")
    has_accepted = db.scalar(
        select(Match.id).where(Match.ride_id == ride_id, Match.status == MatchStatus.ACCEPTED).limit(1)
    )
    if has_accepted:
        api_error(status.HTTP_400_BAD_REQUEST, "E400", "לא ניתן למחוק נסיעה שיש לה התאמה מאושרת")
    db.execute(delete(Match).where(Match.ride_id == ride_id))
    db.delete(ride)
    db.commit()
    return {"status": "OK", "ride_id": ride_id}


@app.get("/users/{user_id}/rides", response_model=list[RideOut])
def user_rides(user_id: int, db: Session = Depends(get_db)):
    rides = db.scalars(
        select(Ride).where(Ride.driver_id == user_id).order_by(Ride.departure_time.desc())
    ).all()
    return rides


@app.post("/matches/request")
def request_match(
    payload: MatchRequestIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    expire_stale_matches(db)
    ride = db.get(Ride, payload.ride_id)
    if not ride:
        api_error(status.HTTP_404_NOT_FOUND, "E404", "הנסיעה לא נמצאה")
    if ride.driver_id == current_user.id:
        api_error(status.HTTP_400_BAD_REQUEST, "E400", "נהג לא יכול לבקש להצטרף לנסיעה שלו")
    if ride.seats_available <= 0:
        api_error(status.HTTP_400_BAD_REQUEST, "E004", "אין מקומות פנויים")
    if current_user.credits < 1:
        api_error(status.HTTP_400_BAD_REQUEST, "E003", "אין מספיק נקודות זכות")
    existing_request = db.scalar(
        select(Match).where(
            and_(
                Match.ride_id == ride.id,
                Match.passenger_id == current_user.id,
                Match.status.in_([MatchStatus.PENDING, MatchStatus.ACCEPTED]),
            )
        )
    )
    if existing_request:
        api_error(status.HTTP_400_BAD_REQUEST, "E400", "בקשת התאמה לנסיעה זו כבר קיימת")

    match = Match(
        ride_id=ride.id,
        passenger_id=current_user.id,
        confirmed_by_passenger=True,
        status=MatchStatus.PENDING,
        expires_at=datetime.utcnow() + timedelta(hours=MATCH_REQUEST_TTL_HOURS),
    )
    db.add(match)
    db.commit()
    db.refresh(match)
    return {"match_id": match.id, "status": match.status}


@app.post("/matches/accept")
def accept_match(
    payload: MatchConfirmIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    expire_stale_matches(db)
    match = db.get(Match, payload.match_id)
    if not match:
        api_error(status.HTTP_404_NOT_FOUND, "E404", "ההתאמה לא נמצאה")

    ride = db.get(Ride, match.ride_id)
    if not ride:
        api_error(status.HTTP_404_NOT_FOUND, "E404", "הנסיעה לא נמצאה")
    if ride.driver_id != current_user.id:
        api_error(status.HTTP_403_FORBIDDEN, "E403", "רק הנהג יכול לאשר")
    if match.status != MatchStatus.PENDING:
        api_error(status.HTTP_400_BAD_REQUEST, "E400", "ההתאמה אינה במצב ממתין")
    if ride.seats_available <= 0:
        api_error(status.HTTP_400_BAD_REQUEST, "E004", "אין מקומות פנויים")

    passenger = db.get(User, match.passenger_id)
    if not passenger or passenger.credits < 1:
        api_error(status.HTTP_400_BAD_REQUEST, "E003", "לנוסע אין מספיק נקודות זכות")

    match.confirmed_by_driver = True
    match.status = MatchStatus.ACCEPTED
    match.responded_at = datetime.utcnow()
    ride.seats_available -= 1
    ride.status = RideStatus.MATCHED if ride.seats_available == 0 else RideStatus.OPEN

    db.commit()
    return {"status": match.status, "ride_id": ride.id}


@app.get("/matches/my-requests")
def my_match_requests(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    expire_stale_matches(db)
    requests = db.scalars(select(Match).where(Match.passenger_id == current_user.id).order_by(Match.id.desc())).all()
    return [
        {
            "match_id": match.id,
            "ride_id": match.ride_id,
            "status": match.status,
            "expires_at": match.expires_at.isoformat() if match.expires_at else None,
        }
        for match in requests
    ]


@app.get("/matches/driver-pending")
def driver_pending_matches(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    expire_stale_matches(db)
    pending = db.scalars(
        select(Match)
        .join(Ride, Ride.id == Match.ride_id)
        .where(
            and_(
                Ride.driver_id == current_user.id,
                Match.status == MatchStatus.PENDING,
            )
        )
        .order_by(Match.id.desc())
    ).all()
    return [
        {
            "match_id": match.id,
            "ride_id": match.ride_id,
            "passenger_id": match.passenger_id,
        }
        for match in pending
    ]


@app.get("/matches/driver-active")
def driver_active_matches(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    active = db.scalars(
        select(Match)
        .join(Ride, Ride.id == Match.ride_id)
        .where(
            and_(
                Ride.driver_id == current_user.id,
                Match.status == MatchStatus.ACCEPTED,
            )
        )
        .order_by(Match.id.desc())
    ).all()
    return [{"match_id": match.id, "ride_id": match.ride_id, "passenger_id": match.passenger_id} for match in active]


@app.post("/matches/reject")
def reject_match(payload: MatchConfirmIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    expire_stale_matches(db)
    match = db.get(Match, payload.match_id)
    if not match:
        api_error(status.HTTP_404_NOT_FOUND, "E404", "ההתאמה לא נמצאה")
    ride = db.get(Ride, match.ride_id)
    if not ride or ride.driver_id != current_user.id:
        api_error(status.HTTP_403_FORBIDDEN, "E403", "רק הנהג יכול לדחות")
    if match.status != MatchStatus.PENDING:
        api_error(status.HTTP_400_BAD_REQUEST, "E400", "ההתאמה אינה במצב ממתין")
    match.status = MatchStatus.REJECTED
    match.responded_at = datetime.utcnow()
    db.commit()
    return {"status": match.status, "match_id": match.id}


@app.post("/matches/cancel")
def cancel_match(payload: MatchConfirmIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    expire_stale_matches(db)
    match = db.get(Match, payload.match_id)
    if not match:
        api_error(status.HTTP_404_NOT_FOUND, "E404", "ההתאמה לא נמצאה")
    if match.passenger_id != current_user.id:
        api_error(status.HTTP_403_FORBIDDEN, "E403", "רק הנוסע יכול לבטל")
    if match.status not in [MatchStatus.PENDING, MatchStatus.ACCEPTED]:
        api_error(status.HTTP_400_BAD_REQUEST, "E400", "לא ניתן לבטל התאמה זו")
    ride = db.get(Ride, match.ride_id)
    if match.status == MatchStatus.ACCEPTED and ride:
        ride.seats_available += 1
        ride.status = RideStatus.OPEN
    match.status = MatchStatus.CANCELLED
    match.responded_at = datetime.utcnow()
    db.commit()
    return {"status": match.status, "match_id": match.id}


@app.post("/matches/complete")
def complete_match(payload: MatchConfirmIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    match = db.get(Match, payload.match_id)
    if not match:
        api_error(status.HTTP_404_NOT_FOUND, "E404", "ההתאמה לא נמצאה")
    ride = db.get(Ride, match.ride_id)
    if not ride or ride.driver_id != current_user.id:
        api_error(status.HTTP_403_FORBIDDEN, "E403", "רק הנהג יכול לסמן השלמה")
    if match.status != MatchStatus.ACCEPTED:
        api_error(status.HTTP_400_BAD_REQUEST, "E400", "ההתאמה לא אושרה")
    passenger = db.get(User, match.passenger_id)
    driver = db.get(User, ride.driver_id)
    if not passenger or passenger.credits < 1:
        api_error(status.HTTP_400_BAD_REQUEST, "E003", "לנוסע אין מספיק נקודות זכות")

    passenger.credits -= 1
    driver.credits += 1
    db.add(CreditsLog(user_id=passenger.id, delta=-1, reason="RIDE_TAKEN"))
    db.add(CreditsLog(user_id=driver.id, delta=1, reason="RIDE_GIVEN"))
    match.status = MatchStatus.COMPLETED
    match.completed_at = datetime.utcnow()
    ride.status = RideStatus.COMPLETED
    db.commit()
    return {"status": match.status, "match_id": match.id}


@app.post("/matches/confirm")
def confirm_match(
    payload: MatchConfirmIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Backward-compatible alias.
    return accept_match(payload, db, current_user)


@app.post("/ratings")
def add_rating(
    payload: RatingIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.rated_user_id == current_user.id:
        api_error(status.HTTP_400_BAD_REQUEST, "E400", "לא ניתן לדרג את עצמך")

    has_shared_ride = db.scalar(
        select(Match)
        .join(Ride, Ride.id == Match.ride_id)
        .where(
            and_(
                Match.confirmed_by_driver.is_(True),
                Match.confirmed_by_passenger.is_(True),
                or_(
                    and_(Match.passenger_id == current_user.id, Ride.driver_id == payload.rated_user_id),
                    and_(Match.passenger_id == payload.rated_user_id, Ride.driver_id == current_user.id),
                ),
            )
        )
    )
    if not has_shared_ride:
        api_error(status.HTTP_400_BAD_REQUEST, "E014", "לא ניתן לדרג משתמש ללא נסיעה משותפת")

    rating = Rating(
        rater_id=current_user.id,
        rated_user_id=payload.rated_user_id,
        stars=payload.stars,
        comment=payload.comment,
    )
    db.add(rating)
    db.commit()

    avg = db.scalar(select(func.avg(Rating.stars)).where(Rating.rated_user_id == payload.rated_user_id)) or 0.0
    rated_user = db.get(User, payload.rated_user_id)
    rated_user.rating_avg = round(float(avg), 2)
    db.commit()
    return {"status": "OK"}


@app.post("/admin/block/{user_id}")
def admin_block(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Temporary MVP rule: user with id=1 is admin.
    if current_user.id != 1:
        api_error(status.HTTP_403_FORBIDDEN, "E403", "פעולה למנהלים בלבד")
    user = db.get(User, user_id)
    if not user:
        api_error(status.HTTP_404_NOT_FOUND, "E404", "משתמש לא נמצא")
    user.is_blocked = True
    db.commit()
    return {"status": "OK", "user_id": user_id}
