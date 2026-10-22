"""Reusable validated field types for request schemas."""
from typing import Any, Optional

from pydantic import AfterValidator, BeforeValidator, EmailStr, Field
from typing_extensions import Annotated

from app.core.validators import normalize_indian_mobile

# bcrypt only uses the first 72 bytes; non-ASCII characters take several bytes each
MAX_PASSWORD_BYTES = 72


def _check_password(value: str) -> str:
    if len(value.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise ValueError("Password is too long")
    return value


def _blank_to_none(value: Any) -> Any:
    return None if isinstance(value, str) and not value.strip() else value


def _strip(value: Any) -> Any:
    return value.strip() if isinstance(value, str) else value


def _check_phone(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    phone = normalize_indian_mobile(value)
    if phone is None:
        raise ValueError("Enter a valid 10-digit Indian mobile number")
    return phone


Name = Annotated[str, BeforeValidator(_strip), Field(min_length=2, max_length=100)]
Password = Annotated[str, Field(min_length=8, max_length=64), AfterValidator(_check_password)]
Phone = Annotated[Optional[str], BeforeValidator(_blank_to_none), AfterValidator(_check_phone)]
OptionalEmail = Annotated[Optional[EmailStr], BeforeValidator(_blank_to_none)]
ShortText = Annotated[str, BeforeValidator(_strip), Field(min_length=1, max_length=150)]
