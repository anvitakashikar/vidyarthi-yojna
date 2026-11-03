from typing import Any, Dict

from fastapi import APIRouter, Depends, status
from pymongo.errors import DuplicateKeyError

from app.api.deps import get_current_user
from app.core.errors import AppError
from app.core.security import create_access_token, verify_password
from app.db.mongodb import get_database
from app.models.user import Role
from app.repositories.students import StudentRepository
from app.repositories.users import UserRepository, duplicate_key_code
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserPublic

router = APIRouter(prefix="/auth", tags=["Auth"])


def _token_response(user: Dict[str, Any]) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(str(user["_id"]), user["role"]),
        user=UserPublic.from_doc(user),
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest):
    """Student self-registration (mobile number, email optional). Logs the user in straight away."""
    repo = UserRepository(get_database())
    conflict = await repo.find_conflict(body.email, body.phone)
    if conflict:
        raise AppError(conflict)
    try:
        user = await repo.create_user(
            name=body.name,
            email=body.email,
            phone=body.phone,
            password=body.password,
            role=body.role,
            preferred_language=body.preferred_language,
        )
    except DuplicateKeyError as exc:
        raise AppError(duplicate_key_code(exc))
    if body.student_details is not None:
        await StudentRepository(get_database()).create_for_user(user, body.student_details.model_dump())
    return _token_response(user)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    """One login for students and admins, with a mobile number or email.

    The account's own role decides which dashboard it lands on. Donor login is closed.
    """
    user = await UserRepository(get_database()).get_by_identifier(body.identifier)
    if not user or not verify_password(body.password, user["password_hash"]):
        raise AppError("auth.invalid_credentials")
    if not user.get("is_active", True):
        raise AppError("auth.inactive")
    if user["role"] == Role.DONOR.value:
        raise AppError("auth.login_closed")
    return _token_response(user)


@router.get("/me", response_model=UserPublic)
async def me(user: Dict[str, Any] = Depends(get_current_user)):
    return UserPublic.from_doc(user)
