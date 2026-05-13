# ===============================================================
# main.py — הלוגיקה המרכזית של שרת TREMPIST
# כולל: הגדרות, middleware, endpoints, utilities
# ===============================================================

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

# יצירת כל הטבלאות אם לא קיימות — SQLAlchemy עושה זאת אוטומטית
Base.metadata.create_all(bind=engine)


def ensure_match_lifecycle_columns():
    """
    מוסיף עמודות חסרות לטבלאות אם קיימת גרסה ישנה של ה-DB.
    זה מאפשר upgrade בלי לאבד נתונים קיימים.
    """
    with engine.begin() as conn:
        match_cols = {col["name"] for col in inspect(conn).get_columns("matches")}
        if "status" not in match_cols:
            conn.execute(text("ALTER TABLE matches ADD COLUMN status VARCHAR(20) DEFAULT 'PENDING'"))
            conn.execute(text("UPDATE matches SET status = 'PENDING' WHERE status IS NULL"))
        if "expires_at" not in match_cols:
            conn.execute(text("ALTER TABLE matches ADD COLUMN expires_at TIMESTAMP NULL"))
        if "responded_at" not in match_cols:
            conn.execute(text("ALTER TABLE matches ADD COLUMN responded_at TIMESTAMP NULL"))
        if "completed_at" not in match_cols:
            conn.execute(text("ALTER TABLE matches ADD COLUMN completed_at TIMESTAMP NULL"))

        user_cols = {col["name"] for col in inspect(conn).get_columns("users")}
        if "is_admin" not in user_cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT FALSE"))


ensure_match_lifecycle_columns()

# יצירת אפליקציית FastAPI עם שם לתיעוד Swagger
app = FastAPI(title="טרמפיסט — API")

# TTL לבקשות ממתינות — ניתן לשינוי דרך משתני סביבה
MATCH_REQUEST_TTL_HOURS = int(os.getenv("MATCH_REQUEST_TTL_HOURS", "24"))


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_request: Request, _exc: RequestValidationError):
    """
    מטפל בשגיאות ולידציה של Pydantic.
    מחזיר הודעת שגיאה אחידה בעברית במקום הפורמט הדיפולטי.
    """
    return JSONResponse(
        status_code=422,
        content={
            "detail": {
                "code": "E422",
                "message": "הנתונים שנשלחו אינם תקינים (אורך, פורמט או ערכים חסרים).",
            }
        },
    )


# CORS — מאפשר גישה מהדומיין של ה-Frontend
# בייצור CORS_ORIGINS מוגדר לדומיין הספציפי בלבד
CORS_ORIGINS = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "*").split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def api_error(http_status: int, code: str, message: str):
    """עוזר לזרוק שגיאות HTTP מובנות עם קוד ועברית"""
    raise HTTPException(status_code=http_status, detail={"code": code, "message": message})


def expire_stale_matches(db: Session):
    """
    מסמן בקשות שפג תוקפן (24 שעות ללא תגובה) כ-EXPIRED.
    מופעל לפני כל פעולה על matches לשמירת עקביות.
    """
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
    """
    Dependency: בודק JWT ומחזיר את המשתמש המחובר.
    משמש כ-Depends(get_current_user) בכל endpoint מאובטח.
    """
    if not authorization or not authorization.startswith("Bearer "):
        api_error(status.HTTP_401_UNAUTHORIZED, "E401", "כותרת הרשאה חסרה או לא תקינה")
    token = authorization.split(" ", 1)[1].strip()
    user_id = decode_token(token)  # פענוח JWT → user_id
    user = db.get(User, user_id)
    if not user:
        api_error(status.HTTP_401_UNAUTHORIZED, "E401", "משתמש לא נמצא")
    if user.is_blocked:
        api_error(status.HTTP_403_FORBIDDEN, "E012", "המשתמש חסום")
    return user


# ---------------------------------------------------------------
# Health Check — בדיקת חיות השרת
# ---------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok"}


# ---------------------------------------------------------------
# אימות — הרשמה וכניסה
# ---------------------------------------------------------------

@app.post("/auth/register", response_model=TokenOut)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    """
    הרשמת משתמש חדש.
    בודק שהאימייל לא קיים, מצפין סיסמה, יוצר משתמש ומחזיר JWT.
    """
    # בדיקת כפילות אימייל
    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing:
        api_error(status.HTTP_400_BAD_REQUEST, "E002", "כתובת האימייל כבר רשומה במערכת")

    # יצירת משתמש חדש עם סיסמה מוצפנת
    user = User(
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        password_hash=hash_password(payload.password),  # הצפנה!
        credits=0,  # משתמש חדש מתחיל ב-0 קרדיטים
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    # מחזירים JWT מיידית — המשתמש מחובר אוטומטית לאחר הרשמה
    return {"token": create_token(user.id), "user_id": user.id}


@app.post("/auth/login", response_model=TokenOut)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    """
    כניסת משתמש קיים.
    בודק אימייל, מאמת סיסמה, מחזיר JWT.
    """
    user = db.scalar(select(User).where(User.email == payload.email))
    # שגיאה זהה לאימייל שגוי וסיסמה שגויה — מונע User Enumeration
    if not user or not verify_password(payload.password, user.password_hash):
        api_error(status.HTTP_401_UNAUTHORIZED, "E001", "אימייל או סיסמה שגויים")
    if user.is_blocked:
        api_error(status.HTTP_403_FORBIDDEN, "E012", "המשתמש חסום")
    return {"token": create_token(user.id), "user_id": user.id}


@app.get("/users/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    """מחזיר את פרטי המשתמש המחובר"""
    return current_user


# ---------------------------------------------------------------
# נסיעות — פרסום, חיפוש, מחיקה
# ---------------------------------------------------------------

@app.post("/rides", response_model=RideOut)
def publish_ride(
    payload: RideCreateIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),  # דורש JWT
):
    """פרסום נסיעה חדשה. seats_available = seats_total בהתחלה."""
    ride = Ride(
        driver_id=current_user.id,
        origin=payload.origin,
        destination=payload.destination,
        departure_time=payload.departure_time,
        seats_total=payload.seats_total,
        seats_available=payload.seats_total,  # כל המקומות פנויים בהתחלה
        status=RideStatus.OPEN,
    )
    db.add(ride)
    db.commit()
    db.refresh(ride)
    return ride


def _destination_is_any(value: str) -> bool:
    """בודק אם המשתמש חיפש "כל היעדים" — ריק, any, * וכו'"""
    v = (value or "").strip().lower()
    return v in ("", "any", "*", "all", "everywhere", "כל", "הכל")


def _search_tokens(text: str) -> list[str]:
    """מפצל שאילתת חיפוש לאסימונות (מילים)"""
    parts = re.split(r"[\s,]+", (text or "").strip().lower())
    return [p for p in parts if p]


def _location_matches_column(column, query: str):
    """
    בונה תנאי SQL גמיש לחיפוש כתובת.
    בודק: התאמה מלאה | לפי segment | לפי token בודד.
    """
    q = (query or "").strip().lower()
    if not q:
        return True  # ריק = אין סינון
    hay = func.lower(column)
    segments = [part.strip() for part in q.split(",") if part.strip()]
    tokens = _search_tokens(q)
    strong_tokens = [t for t in tokens if len(t) >= 3]
    if not segments and not tokens:
        return hay.contains(q)
    clauses = [hay.contains(q)]  # התאמה מלאה
    clauses.extend(hay.contains(segment) for segment in segments if len(segment) >= 2)
    clauses.extend(hay.contains(token) for token in strong_tokens)
    return or_(*clauses)  # כל אחד מספיק


@app.post("/rides/search", response_model=list[RideOut])
def search_rides(payload: RideSearchIn, db: Session = Depends(get_db)):
    """
    חיפוש נסיעות פתוחות.
    אין צורך באימות — חיפוש זמין לכולם.
    """
    now_minus = datetime.utcnow() - timedelta(hours=1)  # כולל נסיעות שהתחילו עכשיו

    # בניית רשימת פילטרים
    filters = [
        Ride.status == RideStatus.OPEN,           # רק נסיעות פתוחות
        Ride.seats_available > 0,                  # עם מקומות פנויים
        _location_matches_column(Ride.origin, payload.origin),  # מוצא מתאים
        Ride.departure_time >= now_minus,          # לא נסיעות עבר
    ]

    # יעד — אופציונלי
    if not _destination_is_any(payload.destination):
        filters.append(_location_matches_column(Ride.destination, payload.destination))

    # פילטרי שעה — אופציונליים
    if payload.departure_from:
        filters.append(Ride.departure_time >= payload.departure_from)
    if payload.departure_to:
        filters.append(Ride.departure_time <= payload.departure_to)
    if payload.leaving_soon_hours:
        filters.append(Ride.departure_time <= datetime.utcnow() + timedelta(hours=payload.leaving_soon_hours))

    # מיון דינמי לפי בחירת המשתמש
    sort_key = (payload.sort_by or "departure_asc").strip().lower()
    sort_map = {
        "departure_desc": Ride.departure_time.desc(),
        "seats_desc": Ride.seats_available.desc(),
        "seats_asc": Ride.seats_available.asc(),
        "departure_asc": Ride.departure_time.asc(),
    }
    order_by_clause = sort_map.get(sort_key, Ride.departure_time.asc())

    rides = db.scalars(select(Ride).where(and_(*filters)).order_by(order_by_clause)).all()
    return rides


@app.get("/rides/mine", response_model=list[RideOut])
def my_rides(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """מחזיר את כל הנסיעות שפרסמתי כנהג"""
    rides = db.scalars(
        select(Ride).where(Ride.driver_id == current_user.id).order_by(Ride.departure_time.desc())
    ).all()
    return rides


@app.delete("/rides/{ride_id}")
def delete_my_ride(ride_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    מחיקת נסיעה שפרסמתי.
    לא ניתן למחוק אם יש התאמה מאושרת.
    """
    ride = db.get(Ride, ride_id)
    if not ride:
        api_error(status.HTTP_404_NOT_FOUND, "E404", "הנסיעה לא נמצאה")
    if ride.driver_id != current_user.id:
        api_error(status.HTTP_403_FORBIDDEN, "E403", "רק נהג הנסיעה יכול למחוק אותה")

    # מניעת מחיקה אם יש התאמה מאושרת
    has_accepted = db.scalar(
        select(Match.id).where(Match.ride_id == ride_id, Match.status == MatchStatus.ACCEPTED).limit(1)
    )
    if has_accepted:
        api_error(status.HTTP_400_BAD_REQUEST, "E400", "לא ניתן למחוק נסיעה שיש לה התאמה מאושרת")

    # מחיקת כל הבקשות הממתינות ואז הנסיעה עצמה
    db.execute(delete(Match).where(Match.ride_id == ride_id))
    db.delete(ride)
    db.commit()
    return {"status": "OK", "ride_id": ride_id}


@app.get("/users/{user_id}/rides", response_model=list[RideOut])
def user_rides(user_id: int, db: Session = Depends(get_db)):
    """מחזיר נסיעות של משתמש ספציפי — לפרופיל ציבורי"""
    rides = db.scalars(
        select(Ride).where(Ride.driver_id == user_id).order_by(Ride.departure_time.desc())
    ).all()
    return rides


# ---------------------------------------------------------------
# התאמות — שליחה, אישור, דחייה, ביטול, השלמה
# ---------------------------------------------------------------

@app.post("/matches/request")
def request_match(
    payload: MatchRequestIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """שליחת בקשת הצטרפות לנסיעה"""
    expire_stale_matches(db)
    ride = db.get(Ride, payload.ride_id)
    if not ride:
        api_error(status.HTTP_404_NOT_FOUND, "E404", "הנסיעה לא נמצאה")
    if ride.driver_id == current_user.id:
        api_error(status.HTTP_400_BAD_REQUEST, "E400", "נהג לא יכול לבקש להצטרף לנסיעה שלו")
    if ride.seats_available <= 0:
        api_error(status.HTTP_400_BAD_REQUEST, "E004", "אין מקומות פנויים")
    if current_user.credits < 1:
        # הגנה מרכזית — בדיקת קרדיטים לפני שליחה
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
    """אישור בקשה על ידי הנהג + הפחתת מקום"""
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
    ride.seats_available -= 1  # הפחתת מקום פנוי
    # אם אין יותר מקומות — סגירת הנסיעה
    ride.status = RideStatus.MATCHED if ride.seats_available == 0 else RideStatus.OPEN

    db.commit()
    return {"status": match.status, "ride_id": ride.id}


@app.get("/matches/my-requests")
def my_match_requests(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """מחזיר את כל הבקשות שלי כנוסע — לטאב 'הבקשות שלי'"""
    expire_stale_matches(db)
    requests = db.scalars(select(Match).where(Match.passenger_id == current_user.id).order_by(Match.id.desc())).all()
    result = []
    for match in requests:
        ride = db.get(Ride, match.ride_id)
        driver = db.get(User, ride.driver_id) if ride else None
        passenger = db.get(User, match.passenger_id)
        result.append(
            {
                "match_id": match.id,
                "ride_id": match.ride_id,
                "status": match.status,
                "expires_at": match.expires_at.isoformat() if match.expires_at else None,
                "origin": ride.origin if ride else None,
                "destination": ride.destination if ride else None,
                "driver_id": ride.driver_id if ride else None,
                "driver_name": driver.name if driver else None,
                "passenger_id": match.passenger_id,
                "passenger_name": passenger.name if passenger else None,
            }
        )
    return result


@app.get("/matches/driver-pending")
def driver_pending_matches(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """מחזיר בקשות ממתינות לאישורי — לטאב 'בקשות' של הנהג"""
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
    result = []
    for match in pending:
        ride = db.get(Ride, match.ride_id)
        passenger = db.get(User, match.passenger_id)
        driver = db.get(User, ride.driver_id) if ride else None
        result.append(
            {
                "match_id": match.id,
                "ride_id": match.ride_id,
                "passenger_id": match.passenger_id,
                "passenger_name": passenger.name if passenger else None,
                "driver_id": ride.driver_id if ride else None,
                "driver_name": driver.name if driver else None,
                "origin": ride.origin if ride else None,
                "destination": ride.destination if ride else None,
            }
        )
    return result


@app.get("/matches/driver-active")
def driver_active_matches(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """מחזיר נסיעות פעילות שאישרתי — לסימון השלמה"""
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
    result = []
    for match in active:
        ride = db.get(Ride, match.ride_id)
        passenger = db.get(User, match.passenger_id)
        driver = db.get(User, ride.driver_id) if ride else None
        result.append(
            {
                "match_id": match.id,
                "ride_id": match.ride_id,
                "passenger_id": match.passenger_id,
                "passenger_name": passenger.name if passenger else None,
                "driver_id": ride.driver_id if ride else None,
                "driver_name": driver.name if driver else None,
                "origin": ride.origin if ride else None,
                "destination": ride.destination if ride else None,
                "status": match.status,
            }
        )
    return result


@app.get("/credits/me-logs")
def my_credits_log(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """מחזיר היסטוריית קרדיטים — 50 הרשומות האחרונות"""
    logs = db.scalars(
        select(CreditsLog).where(CreditsLog.user_id == current_user.id).order_by(CreditsLog.created_at.desc()).limit(50)
    ).all()
    return [
        {
            "id": row.id,
            "delta": row.delta,
            "reason": row.reason,
            "created_at": row.created_at.isoformat(),
        }
        for row in logs
    ]


@app.post("/matches/reject")
def reject_match(payload: MatchConfirmIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """דחיית בקשה על ידי הנהג"""
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
    """ביטול בקשה על ידי הנוסע — מחזיר מקום לנסיעה אם היה מאושר"""
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
        ride.seats_available += 1  # החזרת המקום לנסיעה
        ride.status = RideStatus.OPEN
    match.status = MatchStatus.CANCELLED
    match.responded_at = datetime.utcnow()
    db.commit()
    return {"status": match.status, "match_id": match.id}


@app.post("/matches/complete")
def complete_match(payload: MatchConfirmIn, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    סיום נסיעה — העברת קרדיטים מנוסע לנהג.
    זו הפעולה המרכזית של מנגנון ההדדיות.
    """
    match = db.get(Match, payload.match_id)
    if not match:
        api_error(status.HTTP_404_NOT_FOUND, "E404", "ההתאמה לא נמצאה")
    ride = db.get(Ride, match.ride_id)
    if not ride or ride.driver_id != current_user.id:
        api_error(status.HTTP_403_FORBIDDEN, "E403", "רק הנהג יכול לסמן השלמה")
    if match.status != MatchStatus.ACCEPTED:
        api_error(status.HTTP_400_BAD_REQUEST, "E400", "ההתאמה לא אושרה")
    # with_for_update נועל את שורות הנוסע והנהג עד לסיום ה-commit
    # מונע race condition שבו שני בקשות מקבילות מפחיתות קרדיטים ביחד
    passenger = db.get(User, match.passenger_id, with_for_update=True)
    driver    = db.get(User, ride.driver_id,     with_for_update=True)
    if not passenger or passenger.credits < 1:
        api_error(status.HTTP_400_BAD_REQUEST, "E003", "לנוסע אין מספיק נקודות זכות")

    # העברת קרדיט — עסקה אטומית עם נעילת שורות
    passenger.credits -= 1
    driver.credits    += 1
    db.add(CreditsLog(user_id=passenger.id, delta=-1, reason="RIDE_TAKEN"))  # יומן נוסע
    db.add(CreditsLog(user_id=driver.id, delta=1, reason="RIDE_GIVEN"))      # יומן נהג

    match.status = MatchStatus.COMPLETED
    match.completed_at = datetime.utcnow()
    ride.status = RideStatus.COMPLETED
    db.commit()  # כל השינויים בcommit יחיד
    return {"status": match.status, "match_id": match.id}


@app.post("/matches/confirm")
def confirm_match(
    payload: MatchConfirmIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Alias לאחורה-תואם — מפנה ל-accept_match
    return accept_match(payload, db, current_user)


@app.post("/ratings")
def add_rating(
    payload: RatingIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    הוספת דירוג למשתמש אחר.
    בודק שקיימת נסיעה משותפת — מונע דירוג זרים.
    """
    if payload.rated_user_id == current_user.id:
        api_error(status.HTTP_400_BAD_REQUEST, "E400", "לא ניתן לדרג את עצמך")

    # בדיקה שקיימת נסיעה משותפת מאושרת
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

    # חישוב ממוצע מעודכן
    avg = db.scalar(select(func.avg(Rating.stars)).where(Rating.rated_user_id == payload.rated_user_id)) or 0.0
    rated_user = db.get(User, payload.rated_user_id)
    rated_user.rating_avg = round(float(avg), 2)
    db.commit()
    return {"status": "OK"}


@app.post("/admin/block/{user_id}")
def admin_block(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        api_error(status.HTTP_403_FORBIDDEN, "E403", "פעולה למנהלים בלבד")
    user = db.get(User, user_id)
    if not user:
        api_error(status.HTTP_404_NOT_FOUND, "E404", "משתמש לא נמצא")
    user.is_blocked = True
    db.commit()
    return {"status": "OK", "user_id": user_id}
