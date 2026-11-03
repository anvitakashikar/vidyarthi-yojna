from datetime import datetime
from typing import Any, Dict, Literal, Optional

from pydantic import BaseModel, Field, model_validator

from app.models.user import Role
from app.schemas.fields import Name, OptionalEmail, Password, Phone
from app.schemas.student import StudentPersonalDetails


def _check_contact(role: str, phone: Optional[str], email: Optional[str]) -> None:
    """Students identify by mobile number; donors and admins by email."""
    if role == Role.STUDENT.value and not phone:
        raise ValueError("Mobile number is required for students")
    if role != Role.STUDENT.value and not email:
        raise ValueError("Email is required for donors and admins")


class RegisterRequest(BaseModel):
    """Self-registration is only open to students.

    Students also send `student_details` (section 1 of their sign-up).
    """

    name: Name
    phone: Phone = None
    email: OptionalEmail = None
    password: Password
    role: Literal["student"] = "student"
    preferred_language: Literal["en", "mr", "hi"] = "mr"  # UI language the user picked
    student_details: Optional[StudentPersonalDetails] = None

    @model_validator(mode="after")
    def _contact_required(self) -> "RegisterRequest":
        _check_contact(self.role, self.phone, self.email)
        if self.role == Role.STUDENT.value and self.student_details is None:
            raise ValueError("Student details are required")
        return self


class AdminCreateUserRequest(BaseModel):
    """Admins can create accounts of any role, including other admins."""

    name: Name
    phone: Phone = None
    email: OptionalEmail = None
    password: Password
    role: Role

    @model_validator(mode="after")
    def _contact_required(self) -> "AdminCreateUserRequest":
        _check_contact(self.role.value, self.phone, self.email)
        return self


class LoginRequest(BaseModel):
    identifier: str = Field(min_length=1, max_length=254, description="Mobile number or email")
    password: str = Field(min_length=1, max_length=64)


class UserPublic(BaseModel):
    id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Role
    preferred_language: str = "mr"
    is_active: bool = True
    onboarding_complete: bool = False
    created_at: Optional[datetime] = None

    @classmethod
    def from_doc(cls, doc: Dict[str, Any]) -> "UserPublic":
        return cls(
            id=str(doc["_id"]),
            name=doc["name"],
            email=doc.get("email"),
            phone=doc.get("phone"),
            role=doc["role"],
            preferred_language=doc.get("preferred_language", "mr"),
            is_active=doc.get("is_active", True),
            onboarding_complete=doc.get("onboarding_complete", False),
            created_at=doc.get("created_at"),
        )


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic
