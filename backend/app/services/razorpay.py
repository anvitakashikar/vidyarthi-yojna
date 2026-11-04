"""Razorpay: orders, payment checks and signatures for online donations.

Flow: the server creates an order → the browser opens Razorpay Checkout for it →
Razorpay returns a signed payment id, which the server checks (and Razorpay's
webhook reports the same payment, in case the browser closed before that).
"""
import hashlib
import hmac
import logging
from typing import Any, Dict, Optional

import httpx

from app.core.config import settings
from app.core.errors import AppError

logger = logging.getLogger(__name__)

API_URL = "https://api.razorpay.com/v1"


def is_configured() -> bool:
    return bool(settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET)


async def _request(method: str, path: str, json: Optional[Dict[str, Any]] = None, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    if not is_configured():
        raise AppError("donation.online_unavailable")
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.request(
                method, f"{API_URL}{path}", json=json, params=params, auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET)
            )
    except httpx.HTTPError as exc:
        logger.error("Razorpay %s %s failed: %s", method, path, exc)
        raise AppError("donation.online_unavailable")
    body = res.json() if res.content else {}
    if res.status_code >= 400:
        logger.warning("Razorpay %s %s returned %s: %s", method, path, res.status_code, (body.get("error") or {}).get("description"))
        raise AppError("donation.payment_failed")
    return body


async def create_order(amount_rupees: int, receipt: str, notes: Dict[str, str]) -> Dict[str, Any]:
    return await _request("POST", "/orders", json={"amount": amount_rupees * 100, "currency": "INR", "receipt": receipt, "notes": notes})


async def get_payment(payment_id: str) -> Dict[str, Any]:
    return await _request("GET", f"/payments/{payment_id}", params={"expand[]": "card"})


async def capture_payment(payment_id: str, amount_paise: int) -> Dict[str, Any]:
    """Needed only when the Razorpay account does not capture payments automatically."""
    return await _request("POST", f"/payments/{payment_id}/capture", json={"amount": amount_paise, "currency": "INR"})


def _matches(message: bytes, secret: str, signature: str) -> bool:
    expected = hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature or "")


def checkout_signature_valid(order_id: str, payment_id: str, signature: str) -> bool:
    return _matches(f"{order_id}|{payment_id}".encode(), settings.RAZORPAY_KEY_SECRET, signature)


def webhook_signature_valid(body: bytes, signature: str) -> bool:
    return bool(settings.RAZORPAY_WEBHOOK_SECRET) and _matches(body, settings.RAZORPAY_WEBHOOK_SECRET, signature)


def payment_method(payment: Dict[str, Any]) -> Dict[str, Any]:
    """Razorpay's payment details in the shape the donations ledger uses."""
    method = payment.get("method")
    if method == "upi":
        return {"method": "upi", "details": {"upi_id": payment.get("vpa") or (payment.get("upi") or {}).get("vpa") or ""}}
    if method == "netbanking":
        return {"method": "netbanking", "details": {"bank_name": payment.get("bank") or ""}}
    if method == "card":
        card = payment.get("card") or {}
        return {
            "method": "card",
            "details": {"card_type": card.get("type") or "", "card_last4": card.get("last4") or "", "card_network": card.get("network") or ""},
        }
    # Wallets, EMI, pay later
    return {"method": "wallet", "details": {"wallet": payment.get("wallet") or method or ""}}
