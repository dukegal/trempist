from datetime import datetime
from enum import Enum

from sqlalchemy import Boolean, DateTime, Enum as SqlEnum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class RideStatus(str, Enum):
    OPEN = "OPEN"
    MATCHED = "MATCHED"
    COMPLETED = "COMPLETED"
    CANCELED = "CANCELED"


class MatchStatus(str, Enum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    phone: Mapped[str] = mapped_column(String(30))
    password_hash: Mapped[str] = mapped_column(String(255))
    credits: Mapped[int] = mapped_column(Integer, default=0)
    rating_avg: Mapped[float] = mapped_column(Float, default=0.0)
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    rides: Mapped[list["Ride"]] = relationship("Ride", back_populates="driver", cascade="all, delete-orphan")


class Ride(Base):
    __tablename__ = "rides"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    driver_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    origin: Mapped[str] = mapped_column(String(255))
    destination: Mapped[str] = mapped_column(String(255))
    departure_time: Mapped[datetime] = mapped_column(DateTime, index=True)
    seats_total: Mapped[int] = mapped_column(Integer)
    seats_available: Mapped[int] = mapped_column(Integer)
    status: Mapped[RideStatus] = mapped_column(SqlEnum(RideStatus), default=RideStatus.OPEN)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    driver: Mapped["User"] = relationship("User", back_populates="rides")


class Match(Base):
    __tablename__ = "matches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    ride_id: Mapped[int] = mapped_column(ForeignKey("rides.id"), index=True)
    passenger_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    confirmed_by_driver: Mapped[bool] = mapped_column(Boolean, default=False)
    confirmed_by_passenger: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[MatchStatus] = mapped_column(SqlEnum(MatchStatus), default=MatchStatus.PENDING, index=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Rating(Base):
    __tablename__ = "ratings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    rater_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    rated_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    stars: Mapped[int] = mapped_column(Integer)
    comment: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class CreditsLog(Base):
    __tablename__ = "credits_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    delta: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
