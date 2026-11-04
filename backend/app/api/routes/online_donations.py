"""Online donations through Razorpay, open to anyone without an account.

The donor fills in their details (needed for the receipt), pays in Razorpay
Checkout, and the payment is checked here before it is recorded as a donation
and added to the fund that pays students.
"""
import asyncio
import json
import logging
from typing import Any, Dict, Optional

from bson import ObjectId
from fastapi import APIRouter, Header, Query, Request, status
from fastapi.responses import Response
from pydantic import BaseModel, BeforeValidator, EmailStr, Field, field_validator
from pymongo import ReturnDocument
from typing_extensions import Annotated

from app.core.config import settings
from app.core.errors import AppError
from app.core.security import create_receipt_token, receipt_token_donation
from app.core.validators import normalize_pan
from app.db.collections import Collections
from app.db.mongodb import get_database
from app.models.base import utc_now
from app.schemas.fields import Name, Phone, _strip
from app.services import email, razorpay, receipts

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/donations/online", tags=["Online donations"])

MAX_DONATION = 10_000_000  # ₹1 crore


class OnlineDonationRequest(BaseModel):
    name: Name
    address: Annotated[str, BeforeValidator(_strip), Field(min_length=10, max_length=300)]
    pan: str = Field(max_length=20)
    phone: Phone
    email: EmailStr
    amount: int = Field(ge=1, le=MAX_DONATION, description="Rupees")

    @field_validator("pan")
    @classmethod
    def _pan(cls, value: str) -> str:
        pan = normalize_pan(value)
        if not pan:
            raise AppError("donor.invalid_pan")
        return pan

    @field_validator("phone")
    @classmethod
    def _phone_required(cls, value: Optional[str]) -> str:
        if not value:
            raise ValueError("Mobile number is required")
        return value


class PaymentConfirmation(BaseModel):
    razorpay_order_id: str = Field(max_length=100)
    razorpay_payment_id: str = Field(max_length=100)
    razorpay_signature: str = Field(max_length=200)


def _result(donation: Dict[str, Any]) -> Dict[str, Any]:
    donation_id = str(donation["_id"])
    return {
        "id": donation_id,
        "receipt_no": donation["receipt_no"],
        "amount": donation["amount"],
        "donor_name": donation["donor_name"],
        "payment_id": donation["reference"],
        "receipt_token": create_receipt_token(donation_id),
        "email": donation.get("email"),
        "receipt_emailed": email.is_configured(),
    }


@router.post("/order", status_code=status.HTTP_201_CREATED)
async def create_order(body: OnlineDonationRequest):
    """Saves the donor's details and opens a Razorpay order for the amount."""
    if not razorpay.is_configured():
        raise AppError("donation.online_unavailable")
    db = get_database()
    doc = {
        "status": "created",
        "amount": body.amount,
        "donor": {"name": body.name, "address": body.address, "pan": body.pan, "phone": body.phone, "email": body.email.lower()},
        "created_at": utc_now(),
    }
    result = await db[Collections.DONATION_ORDERS].insert_one(doc)
    order = await razorpay.create_order(body.amount, receipt=str(result.inserted_id), notes={"donor": body.name[:250], "phone": body.phone})
    await db[Collections.DONATION_ORDERS].update_one({"_id": result.inserted_id}, {"$set": {"razorpay_order_id": order["id"]}})
    return {
        "order_id": order["id"],
        "key_id": settings.RAZORPAY_KEY_ID,
        "amount": order["amount"],  # paise, as Checkout expects
        "currency": order["currency"],
        "name": body.name,
        "email": body.email,
        "phone": body.phone,
    }


async def _record(order: Dict[str, Any], payment_id: str) -> Dict[str, Any]:
    """Checks the payment with Razorpay and records the donation exactly once.

    The checkout callback and the webhook can arrive together, so the order is
    claimed atomically and only the winner records the donation.
    """
    db = get_database()
    orders = db[Collections.DONATION_ORDERS]
    if order.get("donation_id"):
        return await db[Collections.DONATIONS].find_one({"_id": ObjectId(order["donation_id"])})

    payment = await razorpay.get_payment(payment_id)
    amount_paise = order["amount"] * 100
    if payment.get("order_id") != order["razorpay_order_id"] or payment.get("amount") != amount_paise:
        logger.error("Payment %s does not match order %s", payment_id, order["razorpay_order_id"])
        raise AppError("donation.payment_failed")
    if payment.get("status") == "authorized":
        payment = await razorpay.capture_payment(payment_id, amount_paise)
    if payment.get("status") != "captured":
        raise AppError("donation.payment_failed")

    claimed = await orders.find_one_and_update(
        {"_id": order["_id"], "status": "created"},
        {"$set": {"status": "processing", "payment_id": payment_id}},
        return_document=ReturnDocument.AFTER,
    )
    if not claimed:
        # The other request is recording it; wait for it to finish
        for _ in range(20):
            current = await orders.find_one({"_id": order["_id"]})
            if current and current.get("donation_id"):
                return await db[Collections.DONATIONS].find_one({"_id": ObjectId(current["donation_id"])})
            await asyncio.sleep(0.5)
        raise AppError("donation.payment_failed")

    try:
        donor = order["donor"]
        now = utc_now()
        donation = {
            "user_id": None,
            "source": "online",
            "donor_name": donor["name"],
            "address": donor["address"],
            "phone": donor["phone"],
            "email": donor["email"],
            "pan": donor["pan"],
            "amount": order["amount"],
            **razorpay.payment_method(payment),
            "reference": payment_id,
            "razorpay_order_id": order["razorpay_order_id"],
            "status": "paid",
            "receipt_no": await receipts.next_receipt_number(db, now.date()),
            "created_at": now,
        }
        result = await db[Collections.DONATIONS].insert_one(donation)
        donation["_id"] = result.inserted_id

        # The donation adds to the fund that pays students
        await db[Collections.FUNDS].insert_one({
            "amount": donation["amount"],
            "source": donor["name"],
            "note": f"Online donation {donation['receipt_no']} via Razorpay ({receipts.METHOD_LABELS[donation['method']]})",
            "donation_id": str(result.inserted_id),
            "receipt_no": donation["receipt_no"],
            "by_id": None,
            "by_name": donor["name"],
            "created_at": now,
        })
        await orders.update_one({"_id": order["_id"]}, {"$set": {"status": "paid", "donation_id": str(result.inserted_id), "paid_at": now}})
        email.email_receipt_in_background(donation)
        return donation
    except Exception:
        await orders.update_one({"_id": order["_id"], "status": "processing"}, {"$set": {"status": "created"}})
        raise


@router.post("/verify")
async def verify_payment(body: PaymentConfirmation):
    """Called by the browser after Checkout succeeds; returns the receipt details."""
    if not razorpay.checkout_signature_valid(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature):
        raise AppError("donation.payment_failed")
    order = await get_database()[Collections.DONATION_ORDERS].find_one({"razorpay_order_id": body.razorpay_order_id})
    if not order:
        raise AppError("donation.payment_failed")
    return _result(await _record(order, body.razorpay_payment_id))


@router.post("/webhook", include_in_schema=False)
async def webhook(request: Request, x_razorpay_signature: str = Header(default="")):
    """Razorpay's server-to-server notice, so a payment is recorded even if the
    donor closed the page before the browser could confirm it."""
    raw = await request.body()
    if not razorpay.webhook_signature_valid(raw, x_razorpay_signature):
        raise AppError("auth.forbidden")
    event = json.loads(raw)
    if event.get("event") in ("payment.captured", "order.paid"):
        payment = ((event.get("payload") or {}).get("payment") or {}).get("entity") or {}
        order = await get_database()[Collections.DONATION_ORDERS].find_one({"razorpay_order_id": payment.get("order_id")})
        if order and payment.get("id"):
            await _record(order, payment["id"])
    return {"ok": True}


@router.get("/{donation_id}/receipt")
async def receipt(donation_id: str, token: str = Query(max_length=1000)):
    """The PDF receipt, for donors without an account (the token comes from /verify)."""
    if receipt_token_donation(token) != donation_id or not ObjectId.is_valid(donation_id):
        raise AppError("error.not_found")
    donation = await get_database()[Collections.DONATIONS].find_one({"_id": ObjectId(donation_id)})
    if not donation:
        raise AppError("error.not_found")
    filename = f"receipt-{donation['receipt_no'].replace('/', '-')}.pdf"
    return Response(
        receipts.render_receipt(donation),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"', "Cache-Control": "no-store"},
    )
