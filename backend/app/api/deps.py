"""Shared FastAPI dependencies: current user and role guards.

Usage:
    @router.get("/something")
    async def handler(user: dict = Depends(require_roles(Role.ADMIN))): ...
"""
from typing import Any, Callable, Dict, Optional

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.errors import AppError
from app.core.security import decode_access_token
from app.db.mongodb import get_database
from app.models.user import Role
from app.repositories.users import UserRepository

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Dict[str, Any]:
    if credentials is None:
        raise AppError("auth.not_authenticated")

    payload = decode_access_token(credentials.credentials)
    if not payload or "sub" not in payload:
        raise AppError("auth.invalid_token")

    user = await UserRepository(get_database()).get(payload["sub"])
    if user is None:
        raise AppError("auth.invalid_token")
    if not user.get("is_active", True):
        raise AppError("auth.inactive")
    return user


def require_roles(*roles: Role) -> Callable:
    allowed = {r.value for r in roles}

    async def checker(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        if user["role"] not in allowed:
            raise AppError("auth.forbidden")
        return user

    return checker
