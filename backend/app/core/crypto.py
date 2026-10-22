"""Encryption helpers for sensitive personal data.

- `encrypt` / `decrypt`: reversible (Fernet) — for values we must show or verify later.
- `fingerprint`: one-way keyed hash — for uniqueness checks (e.g. one Aadhaar per account)
  without storing the value in a searchable form.
"""
import hashlib
import hmac
from functools import lru_cache

from cryptography.fernet import Fernet

from app.core.config import settings


@lru_cache
def _fernet() -> Fernet:
    if not settings.DATA_ENCRYPTION_KEY:
        raise RuntimeError("DATA_ENCRYPTION_KEY is not set. Generate one and add it to backend/.env")
    return Fernet(settings.DATA_ENCRYPTION_KEY.encode())


def encrypt_bytes(data: bytes) -> bytes:
    return _fernet().encrypt(data)


def decrypt_bytes(token: bytes) -> bytes:
    return _fernet().decrypt(token)


def encrypt(value: str) -> str:
    return encrypt_bytes(value.encode("utf-8")).decode("ascii")


def decrypt(token: str) -> str:
    return decrypt_bytes(token.encode("ascii")).decode("utf-8")


def fingerprint(value: str) -> str:
    key = settings.DATA_ENCRYPTION_KEY.encode()
    return hmac.new(key, value.encode("utf-8"), hashlib.sha256).hexdigest()
