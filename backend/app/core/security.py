"""Password hashing (bcrypt) and JWT access tokens."""
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import bcrypt
import jwt

from app.core.config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user_id: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


PHONE_TOKEN_PURPOSE = "phone_verification"
PHONE_TOKEN_MINUTES = 30


def create_phone_token(phone: str) -> str:
    """Proof that `phone` was verified by OTP, handed back at registration."""
    now = datetime.now(timezone.utc)
    payload = {"sub": phone, "purpose": PHONE_TOKEN_PURPOSE, "iat": now, "exp": now + timedelta(minutes=PHONE_TOKEN_MINUTES)}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def verified_phone(token: str) -> Optional[str]:
    """The phone number a phone token proves, or None if it is invalid or expired."""
    payload = decode_access_token(token)
    if not payload or payload.get("purpose") != PHONE_TOKEN_PURPOSE:
        return None
    return payload.get("sub")


RECEIPT_TOKEN_PURPOSE = "donation_receipt"
RECEIPT_TOKEN_DAYS = 30


def create_receipt_token(donation_id: str) -> str:
    """Lets a donor without an account download their receipt for a while."""
    now = datetime.now(timezone.utc)
    payload = {"sub": donation_id, "purpose": RECEIPT_TOKEN_PURPOSE, "iat": now, "exp": now + timedelta(days=RECEIPT_TOKEN_DAYS)}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def receipt_token_donation(token: str) -> Optional[str]:
    payload = decode_access_token(token)
    if not payload or payload.get("purpose") != RECEIPT_TOKEN_PURPOSE:
        return None
    return payload.get("sub")


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Returns the token payload, or None if the token is invalid or expired."""
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None
