from typing import Any, Dict

from fastapi import APIRouter, Depends, status
from pymongo.errors import DuplicateKeyError

from app.api.deps import get_current_user
from app.core.errors import AppError
from app.core.security import create_access_token, create_phone_token, verified_phone, verify_password
from app.db.mongodb import get_database
from app.models.user import Role
from app.repositories.students import StudentRepository
from app.repositories.users import UserRepository, duplicate_key_code
from app.schemas.auth import (
    LoginRequest,
    OtpSendRequest,
    OtpVerifyRequest,
    OtpVerifyResponse,
    RegisterRequest,
    TokenResponse,
    UserPublic,
)
from app.services import notifications
from app.services.otp import OtpService

router = APIRouter(prefix="/auth", tags=["Auth"])


def _token_response(user: Dict[str, Any]) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(str(user["_id"]), user["role"]),
        user=UserPublic.from_doc(user),
    )


@router.post("/otp/send", status_code=status.HTTP_204_NO_CONTENT)
async def send_otp(body: OtpSendRequest):
    """Sends a one-time code to a mobile number that is not registered yet."""
    if await UserRepository(get_database()).get_by_phone(body.phone):
        raise AppError("auth.phone_exists")
    await OtpService(get_database()).send(body.phone)


@router.post("/otp/verify", response_model=OtpVerifyResponse)
async def verify_otp(body: OtpVerifyRequest):
    """Checks the code; the returned token proves the number at registration."""
    await OtpService(get_database()).verify(body.phone, body.code)
    return OtpVerifyResponse(phone_token=create_phone_token(body.phone))


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest):
    """Student self-registration (mobile number verified by OTP, email optional).

    Logs the user in straight away.
    """
    if verified_phone(body.phone_token) != body.phone:
        raise AppError("otp.not_verified")
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
            phone_verified=True,
        )
    except DuplicateKeyError as exc:
        raise AppError(duplicate_key_code(exc))
    if body.student_details is not None:
        await StudentRepository(get_database()).create_for_user(user, body.student_details.model_dump())
    await notifications.account_created(body.phone, body.name, body.preferred_language)
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
