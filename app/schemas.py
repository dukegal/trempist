# ===============================================================
# schemas.py — הגדרת מבני קלט/פלט ל-API עם ולידציה
# Pydantic עושה ולידציה אוטומטית לפני הגעה ל-endpoint
# ===============================================================

from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


class RegisterIn(BaseModel):
    """נתוני הרשמה — ולידציה: אורך מינימלי לכל שדה"""
    name: str = Field(min_length=2, max_length=100)    # שם: לפחות 2 תווים
    email: EmailStr                                     # אימייל: חייב להיות תקין
    phone: str = Field(min_length=7, max_length=30)    # טלפון: לפחות 7 ספרות
    password: str = Field(min_length=6, max_length=128) # סיסמה: לפחות 6 תווים


class LoginIn(BaseModel):
    """נתוני כניסה"""
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    """תגובה לאחר הרשמה/כניסה — מכיל את הטוקן"""
    token: str       # JWT לשימוש בבקשות עתידיות
    user_id: int     # מזהה המשתמש


class UserOut(BaseModel):
    """פרטי משתמש מאומת — מה שמוחזר ל-Frontend"""
    id: int
    name: str
    email: EmailStr
    phone: str
    credits: int       # יתרת קרדיטים
    rating_avg: float  # ממוצע דירוגים
    is_blocked: bool   # האם חסום

    class Config:
        from_attributes = True  # מאפשר יצירה מ-ORM object


class RideCreateIn(BaseModel):
    """נתוני פרסום נסיעה"""
    origin: str = Field(min_length=2, max_length=255)       # כתובת יציאה
    destination: str = Field(min_length=2, max_length=255)  # כתובת יעד
    departure_time: datetime                                 # שעת יציאה
    seats_total: int = Field(ge=1, le=8)                    # 1–8 מקומות


class RideSearchIn(BaseModel):
    """
    נתוני חיפוש נסיעה.
    origin: חובה — עיר או כתובת.
    destination: אופציונלי — ריק = כל היעדים.
    """
    origin: str = Field(min_length=1, max_length=255)
    destination: str = Field(default="", max_length=255)  # ריק = כל יעד
    departure_from: datetime | None = None                # סינון לפי שעה מ-
    departure_to: datetime | None = None                  # סינון לפי שעה עד
    leaving_soon_hours: int | None = Field(default=None, ge=1, le=72)  # יוצא בN שעות
    sort_by: str = Field(default="departure_asc", max_length=30)       # קריטריון מיון


class RideOut(BaseModel):
    """נסיעה שמוחזרת ל-Frontend"""
    id: int
    driver_id: int
    origin: str
    destination: str
    departure_time: datetime
    seats_total: int
    seats_available: int  # מקומות פנויים (מתעדכן עם אישורים)
    status: str

    class Config:
        from_attributes = True


class MatchRequestIn(BaseModel):
    """בקשת הצטרפות לנסיעה"""
    ride_id: int  # מזהה הנסיעה


class MatchConfirmIn(BaseModel):
    """אישור/דחייה/השלמה של התאמה"""
    match_id: int  # מזהה ההתאמה


class RatingIn(BaseModel):
    """דירוג משתמש"""
    rated_user_id: int                              # מי מדורג
    stars: int = Field(ge=1, le=5)                 # 1–5 כוכבים
    comment: str = Field(default="", max_length=1000)  # תגובה טקסטואלית
