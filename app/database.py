# ===============================================================
# database.py — חיבור למסד הנתונים
# תומך ב-SQLite (פיתוח) ו-PostgreSQL (ייצור)
# ===============================================================

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Load .env from repo root so local auth CLI uses the same DB/SECRET_KEY as Render.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# כתובת ה-DB נקראת מסביבת הייצור — ברירת מחדל: SQLite מקומי
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./trempist.db")

# Render מחזיר "postgres://" — FastAPI דורש "postgresql://"
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# SQLite דורש check_same_thread=False לאפשר גישה ממספר threads
engine_kwargs = {}
if DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

# יצירת ה-engine — חיבור פיזי למסד הנתונים
engine = create_engine(DATABASE_URL, **engine_kwargs)

# SessionLocal — factory ליצירת sessions לבקשות
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base — מחלקת בסיס שממנה יורשות כל הטבלאות
Base = declarative_base()


def get_db():
    """
    Dependency Injection ל-FastAPI.
    מייצרת session חדשה לכל בקשה, ומבטיחה סגירה אחריה.
    """
    db = SessionLocal()
    try:
        yield db        # מחזירה ה-session לשימוש ה-endpoint
    finally:
        db.close()      # תמיד סוגרת — גם במקרה של שגיאה
