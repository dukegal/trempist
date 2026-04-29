from datetime import datetime, timedelta
from typing import Annotated

from fastapi import Depends, FastAPI, Header, HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.auth import create_token, decode_token, hash_password, verify_password
from app.database import Base, engine, get_db
from app.models import CreditsLog, Match, Rating, Ride, RideStatus, User
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

app = FastAPI(title="TREMPIST MVP API")


def api_error(http_status: int, code: str, message: str):
    raise HTTPException(status_code=http_status, detail={"code": code, "message": message})


def get_current_user(
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        api_error(status.HTTP_401_UNAUTHORIZED, "E401", "Missing or invalid Authorization header")
    token = authorization.split(" ", 1)[1].strip()
    user_id = decode_token(token)
    user = db.get(User, user_id)
    if not user:
        api_error(status.HTTP_401_UNAUTHORIZED, "E401", "User not found")
    if user.is_blocked:
        api_error(status.HTTP_403_FORBIDDEN, "E012", "User blocked")
    return user


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/auth/register", response_model=TokenOut)
def register(payload: RegisterIn, db: Session = Depends(get_db)):
    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing:
        api_error(status.HTTP_400_BAD_REQUEST, "E002", "Email already exists")
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
        api_error(status.HTTP_401_UNAUTHORIZED, "E001", "Invalid email or password")
    if user.is_blocked:
        api_error(status.HTTP_403_FORBIDDEN, "E012", "User blocked")
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


@app.post("/rides/search", response_model=list[RideOut])
def search_rides(payload: RideSearchIn, db: Session = Depends(get_db)):
    now_minus = datetime.utcnow() - timedelta(hours=1)
    rides = db.scalars(
        select(Ride).where(
            and_(
                Ride.status == RideStatus.OPEN,
                Ride.seats_available > 0,
                func.lower(Ride.origin).contains(payload.origin.lower()),
                func.lower(Ride.destination).contains(payload.destination.lower()),
                Ride.departure_time >= now_minus,
            )
        )
    ).all()
    return rides


@app.post("/matches/request")
def request_match(
    payload: MatchRequestIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ride = db.get(Ride, payload.ride_id)
    if not ride:
        api_error(status.HTTP_404_NOT_FOUND, "E404", "Ride not found")
    if ride.driver_id == current_user.id:
        api_error(status.HTTP_400_BAD_REQUEST, "E400", "Driver cannot request own ride")
    if ride.seats_available <= 0:
        api_error(status.HTTP_400_BAD_REQUEST, "E004", "No seats available")
    if current_user.credits < 1:
        api_error(status.HTTP_400_BAD_REQUEST, "E003", "Not enough credits")

    match = Match(ride_id=ride.id, passenger_id=current_user.id, confirmed_by_passenger=True)
    db.add(match)
    db.commit()
    db.refresh(match)
    return {"match_id": match.id, "status": "PENDING_DRIVER_CONFIRM"}


@app.post("/matches/confirm")
def confirm_match(
    payload: MatchConfirmIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    match = db.get(Match, payload.match_id)
    if not match:
        api_error(status.HTTP_404_NOT_FOUND, "E404", "Match not found")

    ride = db.get(Ride, match.ride_id)
    if not ride:
        api_error(status.HTTP_404_NOT_FOUND, "E404", "Ride not found")
    if ride.driver_id != current_user.id:
        api_error(status.HTTP_403_FORBIDDEN, "E403", "Only driver can confirm")
    if ride.status != RideStatus.OPEN:
        api_error(status.HTTP_400_BAD_REQUEST, "E400", "Ride not open")
    if ride.seats_available <= 0:
        api_error(status.HTTP_400_BAD_REQUEST, "E004", "No seats available")

    passenger = db.get(User, match.passenger_id)
    if not passenger or passenger.credits < 1:
        api_error(status.HTTP_400_BAD_REQUEST, "E003", "Passenger has no credits")

    match.confirmed_by_driver = True
    ride.seats_available -= 1
    if ride.seats_available == 0:
        ride.status = RideStatus.MATCHED

    # Credit transfer in server-side logic only.
    passenger.credits -= 1
    driver = db.get(User, ride.driver_id)
    driver.credits += 1
    db.add(CreditsLog(user_id=passenger.id, delta=-1, reason="RIDE_TAKEN"))
    db.add(CreditsLog(user_id=driver.id, delta=1, reason="RIDE_GIVEN"))

    db.commit()
    return {"status": "CONFIRMED", "ride_id": ride.id}


@app.post("/ratings")
def add_rating(
    payload: RatingIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if payload.rated_user_id == current_user.id:
        api_error(status.HTTP_400_BAD_REQUEST, "E400", "Cannot rate self")

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
        api_error(status.HTTP_400_BAD_REQUEST, "E014", "Cannot rate user without shared ride")

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
        api_error(status.HTTP_403_FORBIDDEN, "E403", "Admin only")
    user = db.get(User, user_id)
    if not user:
        api_error(status.HTTP_404_NOT_FOUND, "E404", "User not found")
    user.is_blocked = True
    db.commit()
    return {"status": "OK", "user_id": user_id}
