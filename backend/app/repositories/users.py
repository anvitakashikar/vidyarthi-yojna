import logging
from typing import Any, Dict, Optional

from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import DuplicateKeyError

from app.core.config import settings
from app.core.security import hash_password
from app.core.validators import normalize_indian_mobile
from app.db.collections import Collections
from app.models.user import Role
from app.repositories.base import BaseRepository

logger = logging.getLogger(__name__)


class UserRepository(BaseRepository):
    collection_name = Collections.USERS

    async def get_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        return await self.collection.find_one({"email": email.strip().lower()})

    async def get_by_phone(self, phone: str) -> Optional[Dict[str, Any]]:
        return await self.collection.find_one({"phone": phone})

    async def get_by_identifier(self, identifier: str) -> Optional[Dict[str, Any]]:
        """Look a user up by email (if it contains '@') or by mobile number."""
        identifier = identifier.strip()
        if "@" in identifier:
            return await self.get_by_email(identifier)
        phone = normalize_indian_mobile(identifier)
        return await self.get_by_phone(phone) if phone else None

    async def find_conflict(self, email: Optional[str], phone: Optional[str]) -> Optional[str]:
        """Returns an error code if the email or phone is already taken."""
        if email and await self.get_by_email(email):
            return "auth.email_exists"
        if phone and await self.get_by_phone(phone):
            return "auth.phone_exists"
        return None

    async def create_user(
        self,
        *,
        name: str,
        password: str,
        role: Role,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        preferred_language: str = "mr",
    ) -> Dict[str, Any]:
        role = Role(role)
        return await self.create(
            {
                "name": name.strip(),
                "email": email.strip().lower() if email else None,
                "phone": phone,
                "password_hash": hash_password(password),
                "role": role.value,
                "preferred_language": preferred_language,
                "is_active": True,
                # Students and donors complete their details after registering
                "onboarding_complete": role == Role.ADMIN,
            }
        )


def duplicate_key_code(exc: DuplicateKeyError) -> str:
    """Maps a unique-index violation to the matching error code."""
    key_pattern = (exc.details or {}).get("keyPattern", {})
    return "auth.phone_exists" if "phone" in key_pattern else "auth.email_exists"


async def seed_admin(db: AsyncDatabase) -> None:
    """Create the first admin from settings if no admin account exists yet."""
    repo = UserRepository(db)
    if await repo.collection.count_documents({"role": Role.ADMIN.value}, limit=1):
        return
    if not settings.ADMIN_PASSWORD:
        logger.warning("No admin account exists. Set ADMIN_EMAIL / ADMIN_PASSWORD in .env to create one.")
        return
    await repo.create_user(
        name=settings.ADMIN_NAME,
        email=settings.ADMIN_EMAIL,
        password=settings.ADMIN_PASSWORD,
        role=Role.ADMIN,
    )
    logger.info("Created initial admin account '%s'", settings.ADMIN_EMAIL)
