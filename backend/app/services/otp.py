"""Mobile number verification by one-time code (OTP).

OTP_PROVIDER=twilio: Twilio Verify generates, sends and checks the code itself.
OTP_PROVIDER=console (development): the code is generated here and printed to the
server log instead of being sent by SMS.

Either way every request is recorded in `otp_requests`, which enforces the resend
wait, the hourly send limit and the number of wrong guesses allowed per code.
"""
import hashlib
import hmac
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

import httpx
from pymongo.asynchronous.database import AsyncDatabase

from app.core.config import settings
from app.core.errors import AppError
from app.db.collections import Collections

logger = logging.getLogger(__name__)

RESEND_SECONDS = 30
MAX_SENDS_PER_HOUR = 5
MAX_ATTEMPTS = 5
CODE_MINUTES = 10  # Twilio Verify's default code lifetime as well

_TWILIO_URL = "https://verify.twilio.com/v2/Services/{sid}/{endpoint}"
# Twilio error codes: https://www.twilio.com/docs/api/errors
_TWILIO_RATE_LIMITED = {60202, 60203, 60212}
_TWILIO_NOT_FOUND = 20404


def _hash_code(phone: str, code: str) -> str:
    return hmac.new(settings.JWT_SECRET.encode(), f"{phone}:{code}".encode(), hashlib.sha256).hexdigest()


def _as_utc(value: datetime) -> datetime:
    # MongoDB returns naive datetimes that are in UTC
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


async def _twilio(endpoint: str, data: Dict[str, str]) -> Dict[str, Any]:
    url = _TWILIO_URL.format(sid=settings.TWILIO_VERIFY_SERVICE_SID, endpoint=endpoint)
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.post(url, data=data, auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN))
    except httpx.HTTPError as exc:
        logger.error("Twilio Verify request failed: %s", exc)
        raise AppError("otp.send_failed")
    body = res.json() if res.content else {}
    if res.status_code >= 400:
        code = body.get("code")
        logger.warning("Twilio Verify %s returned %s: %s", endpoint, code, body.get("message"))
        if code in _TWILIO_RATE_LIMITED:
            raise AppError("otp.too_many")
        if code == _TWILIO_NOT_FOUND:
            raise AppError("otp.expired")
        raise AppError("otp.send_failed")
    return body


class OtpService:
    def __init__(self, db: AsyncDatabase):
        self.collection = db[Collections.OTP_REQUESTS]

    async def _latest(self, phone: str) -> Optional[Dict[str, Any]]:
        return await self.collection.find_one({"phone": phone}, sort=[("created_at", -1)])

    async def send(self, phone: str) -> None:
        now = datetime.now(timezone.utc)
        latest = await self._latest(phone)
        if latest:
            wait = RESEND_SECONDS - int((now - _as_utc(latest["created_at"])).total_seconds())
            if wait > 0:
                raise AppError("otp.too_soon", {"seconds": wait})
        sent_this_hour = await self.collection.count_documents({"phone": phone, "created_at": {"$gt": now - timedelta(hours=1)}})
        if sent_this_hour >= MAX_SENDS_PER_HOUR:
            raise AppError("otp.too_many")

        doc: Dict[str, Any] = {"phone": phone, "created_at": now, "attempts": 0, "provider": settings.OTP_PROVIDER}
        if settings.OTP_PROVIDER == "twilio":
            await _twilio("Verifications", {"To": f"+91{phone}", "Channel": "sms"})
        else:
            code = f"{secrets.randbelow(10**6):06d}"
            doc["code_hash"] = _hash_code(phone, code)
            logger.warning("OTP for %s is %s (OTP_PROVIDER=console, no SMS sent)", phone, code)
        await self.collection.insert_one(doc)

    async def verify(self, phone: str, code: str) -> None:
        """Raises an AppError unless `code` is the latest code sent to `phone`."""
        latest = await self._latest(phone)
        if not latest or latest.get("verified"):
            raise AppError("otp.expired")
        if _as_utc(latest["created_at"]) < datetime.now(timezone.utc) - timedelta(minutes=CODE_MINUTES):
            raise AppError("otp.expired")
        if latest["attempts"] >= MAX_ATTEMPTS:
            raise AppError("otp.too_many_attempts")
        await self.collection.update_one({"_id": latest["_id"]}, {"$inc": {"attempts": 1}})

        if latest.get("provider") == "twilio":
            result = await _twilio("VerificationCheck", {"To": f"+91{phone}", "Code": code})
            approved = result.get("status") == "approved"
        else:
            approved = hmac.compare_digest(latest.get("code_hash", ""), _hash_code(phone, code))
        if not approved:
            raise AppError("otp.invalid_code")
        await self.collection.update_one({"_id": latest["_id"]}, {"$set": {"verified": True}})
