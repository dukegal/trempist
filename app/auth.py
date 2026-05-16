# ===============================================================
# auth.py — אימות משתמשים: הצפנת סיסמאות + JWT
# ===============================================================

from datetime import datetime, timedelta, timezone
import os

from fastapi import HTTPException, status
from jose import JWTError, jwt
from passlib.context import CryptContext

# מפתח סודי — חייב להיות ב-.env בייצור, לא בקוד!
SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")
ALGORITHM = "HS256"   # אלגוריתם חתימת JWT
TOKEN_EXPIRE_HOURS = int(os.getenv("TOKEN_EXPIRE_HOURS", "24"))  # תוקף טוקן

# הצפנת סיסמאות עם pbkdf2_sha256:
# - מוסיף salt אוטומטי (מונע Rainbow Tables)
# - בטוח יותר מ-MD5/SHA1 הרגילים
# - נבחר במקום bcrypt בשל בעיות תאימות ב-Python 3.12+
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


def hash_password(password: str) -> str:
    """
    מצפין סיסמה לפני שמירה.
    התוצאה כוללת: שם האלגוריתם + salt + הגיבוב
    לדוגמה: "pbkdf2:sha256:600000$abc123$..."
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    """
    מאמת שסיסמה רגילה תואמת לגיבוב השמור.
    מחלץ את ה-salt מהגיבוב ומחשב מחדש — בטוח מ-Timing Attacks.
    """
    return pwd_context.verify(plain_password, password_hash)


def create_token(user_id: int) -> str:
    """
    יוצר JWT חתום עם מזהה המשתמש ותאריך פקיעה.

    מבנה ה-payload:
    - sub: מזהה המשתמש (subject)
    - exp: תאריך ושעת פקיעה (expiration)
    """
    exp = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    payload = {"sub": str(user_id), "exp": exp}
    # jwt.encode חותם את ה-payload עם SECRET_KEY
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> int:
    """
    מפענח JWT ומחזיר מזהה המשתמש.
    זורק 401 לכל שגיאה — פג תוקף, חתימה שגויה, מבנה לא תקין.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return int(payload["sub"])  # מחזיר את מזהה המשתמש
    except (JWTError, KeyError, ValueError) as exc:
        # כל שגיאת פענוח = 401 Unauthorized
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "E401", "message": "Invalid token"},
        ) from exc
