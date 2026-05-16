# ===============================================================
# user_manager.py — Secure User Registration & Authentication
#
# Security model:
#   • Passwords hashed with PBKDF2-HMAC-SHA256 (260 000 iterations —
#     OWASP 2024 recommendation for SHA-256).
#   • Each password gets a unique random SALT (32 bytes) stored alongside
#     the hash — defeats Rainbow-Table and batch-cracking attacks.
#   • A secret server-side PEPPER is mixed in before hashing — even a full
#     DB dump cannot be cracked without also knowing the pepper.
#   • Constant-time comparison (hmac.compare_digest) prevents Timing Attacks.
#   • Per-email threading lock prevents race conditions when the same email
#     registers or logs in from multiple clients simultaneously.
#   • All DB queries go through SQLAlchemy ORM (parameterised) — immune to
#     SQL Injection.
#   • Error messages never distinguish "email not found" from "wrong password"
#     (User Enumeration protection).
# ===============================================================

import hashlib
import hmac
import os
import re
import threading

from sqlalchemy.orm import Session

from app.auth import create_token
from app.models import User

# ── Server-side pepper ────────────────────────────────────────────────────────
# Must be kept in an environment variable — NOT in source control.
# Even if the entire database leaks, offline cracking still requires this value.
PEPPER: str = os.getenv("AUTH_PEPPER", "trempist-pepper-secret-change-in-prod")

# ── Iterations ────────────────────────────────────────────────────────────────
PBKDF2_ITERATIONS = 260_000   # OWASP 2024 recommendation for PBKDF2-HMAC-SHA256

# ── Per-email concurrency lock ────────────────────────────────────────────────
# Prevents TOCTOU races when the same email tries to register / login
# from multiple clients at exactly the same moment.
_user_locks: dict[str, threading.Lock] = {}
_locks_meta = threading.Lock()


def _get_lock(email: str) -> threading.Lock:
    """Return (or create) a per-email threading.Lock."""
    with _locks_meta:
        if email not in _user_locks:
            _user_locks[email] = threading.Lock()
        return _user_locks[email]


# ── Custom exceptions ─────────────────────────────────────────────────────────

class RegistrationError(Exception):
    """Raised when registration data is invalid or the email is already taken."""


class LoginError(Exception):
    """Raised when credentials are wrong or the account is blocked."""


# ── UserManager ───────────────────────────────────────────────────────────────

class UserManager:
    """
    Handles all user authentication logic.

    Usage (inside a ClientHandler thread):
        manager = UserManager(db_session)
        result  = manager.register(name, email, phone, password)
        result  = manager.login(email, password)
    Each method returns a dict: {"token": str, "user_id": int, "name": str}
    """

    def __init__(self, db: Session):
        self._db = db

    # ── Public API ────────────────────────────────────────────────

    def register(self, name: str, email: str, phone: str, password: str) -> dict:
        """
        Validate inputs, create a new user, and return a JWT session token.
        Thread-safe: uses a per-email lock to prevent duplicate registrations
        from two simultaneous clients.
        """
        name     = name.strip()
        email    = email.strip().lower()
        phone    = phone.strip()

        self._validate_registration(name, email, phone, password)

        with _get_lock(email):
            # Parameterised ORM query — safe from SQL injection
            if self._db.query(User).filter(User.email == email).first():
                raise RegistrationError("כתובת האימייל כבר רשומה במערכת")

            salt          = os.urandom(32).hex()      # 256-bit random salt
            password_hash = self._hash_password(password, salt)

            user = User(
                name=name,
                email=email,
                phone=phone,
                password_hash=f"{salt}${password_hash}",   # stored as "salt$hash"
                credits=0,
            )
            self._db.add(user)
            self._db.commit()
            self._db.refresh(user)

        token = create_token(user.id)
        return {"token": token, "user_id": user.id, "name": user.name}

    def login(self, email: str, password: str) -> dict:
        """
        Authenticate a user and return a JWT session token.
        Thread-safe: uses a per-email lock so that two clients trying to
        log in with the same email concurrently are serialised.
        """
        email = (email or "").strip().lower()
        if not email or not password:
            raise LoginError("אימייל וסיסמה נדרשים")

        with _get_lock(email):
            # Parameterised ORM query — safe from SQL injection
            user: User | None = self._db.query(User).filter(User.email == email).first()

            # Always compute a hash (even for unknown users) to prevent
            # timing-based user-enumeration attacks.
            dummy_salt = "0" * 64
            stored     = user.password_hash if user else f"{dummy_salt}${"0" * 64}"

            try:
                salt, stored_dk = stored.split("$", 1)
            except ValueError:
                # Legacy passlib format — not supported by the new socket auth
                salt      = dummy_salt
                stored_dk = "legacy"

            computed = self._hash_password(password, salt)

            # Constant-time comparison — prevents timing attacks
            credentials_ok = hmac.compare_digest(computed, stored_dk)

            if not user or not credentials_ok:
                raise LoginError("אימייל או סיסמה שגויים")

            if user.is_blocked:
                raise LoginError("החשבון חסום. פנה למנהל המערכת")

        token = create_token(user.id)
        return {"token": token, "user_id": user.id, "name": user.name}

    # ── Private helpers ───────────────────────────────────────────

    def _hash_password(self, password: str, salt: str) -> str:
        """
        PBKDF2-HMAC-SHA256 with salt + pepper.

        Steps:
          1. Append PEPPER to the raw password          → peppered_password
          2. Encode as UTF-8
          3. Run PBKDF2 with the per-user SALT and PBKDF2_ITERATIONS rounds
          4. Return the derived key as a hex string

        The SALT is stored in the DB.  The PEPPER is not — it lives only in
        the server environment, so a DB leak alone cannot enable offline attacks.
        """
        peppered = (password + PEPPER).encode("utf-8")
        dk = hashlib.pbkdf2_hmac(
            hash_name  = "sha256",
            password   = peppered,
            salt       = salt.encode("utf-8"),
            iterations = PBKDF2_ITERATIONS,
        )
        return dk.hex()

    @staticmethod
    def _validate_registration(name: str, email: str, phone: str, password: str) -> None:
        """Raise RegistrationError with a descriptive Hebrew message on any violation."""
        if len(name) < 2:
            raise RegistrationError("שם חייב להכיל לפחות 2 תווים")
        if len(name) > 100:
            raise RegistrationError("שם ארוך מדי (מקסימום 100 תווים)")
        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
            raise RegistrationError("כתובת אימייל לא תקינה")
        if not re.match(r"^\+?[\d\s\-]{7,30}$", phone):
            raise RegistrationError("מספר טלפון לא תקין")
        if len(password) < 6:
            raise RegistrationError("הסיסמה חייבת להכיל לפחות 6 תווים")
        if len(password) > 128:
            raise RegistrationError("הסיסמה ארוכה מדי (מקסימום 128 תווים)")
