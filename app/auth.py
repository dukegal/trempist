from datetime import datetime, timedelta, timezone
import os

from fastapi import HTTPException, status
from jose import JWTError, jwt
from passlib.context import CryptContext

SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = int(os.getenv("TOKEN_EXPIRE_HOURS", "24"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


def create_token(user_id: int) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    payload = {"sub": str(user_id), "exp": exp}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> int:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return int(payload["sub"])
    except (JWTError, KeyError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "E401", "message": "Invalid token"},
        ) from exc
