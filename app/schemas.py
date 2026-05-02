from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(min_length=7, max_length=30)
    password: str = Field(min_length=6, max_length=128)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    token: str
    user_id: int


class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    phone: str
    credits: int
    rating_avg: float
    is_blocked: bool

    class Config:
        from_attributes = True


class RideCreateIn(BaseModel):
    origin: str = Field(min_length=2, max_length=255)
    destination: str = Field(min_length=2, max_length=255)
    departure_time: datetime
    seats_total: int = Field(ge=1, le=8)


class RideSearchIn(BaseModel):
    """מוצא: עיר או טקסט חופשי. יעד: ריק או «כל» / Any / * — ללא סינון יעד."""

    origin: str = Field(min_length=1, max_length=255)
    destination: str = Field(default="", max_length=255)
    departure_from: datetime | None = None
    departure_to: datetime | None = None
    leaving_soon_hours: int | None = Field(default=None, ge=1, le=72)
    sort_by: str = Field(default="departure_asc", max_length=30)


class RideOut(BaseModel):
    id: int
    driver_id: int
    origin: str
    destination: str
    departure_time: datetime
    seats_total: int
    seats_available: int
    status: str

    class Config:
        from_attributes = True


class MatchRequestIn(BaseModel):
    ride_id: int


class MatchConfirmIn(BaseModel):
    match_id: int


class RatingIn(BaseModel):
    rated_user_id: int
    stars: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=1000)
