from enum import Enum
from typing import Optional

from app.models.base import MongoBaseModel


class Role(str, Enum):
    STUDENT = "student"
    DONOR = "donor"
    ADMIN = "admin"


class User(MongoBaseModel):
    """Document shape of the `users` collection (all three roles share it).

    Students sign up with a mobile number (email optional); donors and admins with an email.
    Both fields are unique when present.
    """

    name: str
    email: Optional[str] = None     # lower-cased
    phone: Optional[str] = None     # 10-digit Indian mobile
    password_hash: str
    role: Role
    preferred_language: str = "en"  # "en" | "mr"
    is_active: bool = True
    onboarding_complete: bool = False  # students: Aadhaar + bank details submitted
