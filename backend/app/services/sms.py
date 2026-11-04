"""Freeform SMS messages (e.g. "your account has been created").

Separate from app.services.otp, which only sends verification codes through
Twilio Verify. This uses Twilio's regular Messaging API with the same
Account SID / Auth Token, sending from TWILIO_FROM_NUMBER or
TWILIO_MESSAGING_SERVICE_SID. If neither is set, or OTP_PROVIDER is not
"twilio", the message is logged instead of sent — same as OTP's console mode.

Never raises: a failed SMS should not fail the request that triggered it.
"""
import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_TWILIO_MESSAGES_URL = "https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"


async def send_sms(phone: str, body: str) -> None:
    sender_field, sender_value = (
        ("MessagingServiceSid", settings.TWILIO_MESSAGING_SERVICE_SID)
        if settings.TWILIO_MESSAGING_SERVICE_SID
        else ("From", settings.TWILIO_FROM_NUMBER)
    )
    if settings.OTP_PROVIDER != "twilio" or not sender_value:
        logger.warning("SMS to %s (not sent, no Twilio sender configured): %s", phone, body)
        return

    url = _TWILIO_MESSAGES_URL.format(sid=settings.TWILIO_ACCOUNT_SID)
    data = {"To": f"+91{phone}", "Body": body, sender_field: sender_value}
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.post(url, data=data, auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN))
        if res.status_code >= 400:
            logger.warning("Twilio SMS to %s failed (%s): %s", phone, res.status_code, res.text)
    except httpx.HTTPError as exc:
        logger.error("Twilio SMS request to %s failed: %s", phone, exc)
