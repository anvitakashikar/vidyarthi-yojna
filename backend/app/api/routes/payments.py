"""Admin: money left, amounts due to accepted students, and recording payments."""
import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError
from typing_extensions import Annotated

from app.api.deps import require_roles
from app.core.crypto import decrypt
from app.core.errors import AppError
from app.db.collections import Collections
from app.db.mongodb import get_database
from app.models.base import utc_now
from app.models.user import Role
from app.repositories.users import UserRepository
from app.services import notifications, payments
from app.services.requirements import ACCEPTED

router = APIRouter(prefix="/admin", tags=["Payments"], dependencies=[Depends(require_roles(Role.ADMIN))])
current_admin = require_roles(Role.ADMIN)

MAX_FUND_AMOUNT = 100_000_000


class FundRequest(BaseModel):
    amount: int = Field(gt=0, le=MAX_FUND_AMOUNT)
    source: Annotated[str, Field(max_length=150)] = ""   # e.g. donor / organisation name
    note: Annotated[str, Field(max_length=300)] = ""


class PaymentRequest(BaseModel):
    user_id: str
    period: Optional[str] = None                          # "YYYY-MM", defaults to this month
    reference: Annotated[str, Field(max_length=100)] = ""  # bank UTR / transaction id
    note: Annotated[str, Field(max_length=300)] = ""


def _bank(doc: Dict[str, Any]) -> Dict[str, Any]:
    bank = doc.get("bank") or {}
    return {
        "account_holder_name": bank.get("account_holder_name", ""),
        "account_number": decrypt(bank["account_number_enc"]) if bank.get("account_number_enc") else "",
        "ifsc": bank.get("ifsc", ""),
        "bank_name": bank.get("bank_name", ""),
        "branch_name": bank.get("branch_name", ""),
    }


async def _due_students(period: str, search: Optional[str] = None) -> List[Dict[str, Any]]:
    """Accepted students with something to pay who have not been paid for `period`."""
    db = get_database()
    query: Dict[str, Any] = dict(ACCEPTED)
    if search and search.strip():
        pattern = {"$regex": re.escape(search.strip()), "$options": "i"}
        query["$or"] = [{"name": pattern}, {"phone": pattern}]
    paid = await payments.paid_user_ids(db, period)
    due = []
    async for doc in db[Collections.STUDENTS].find(query).sort("name", 1):
        need = payments.monthly_requirement(doc)
        if doc["user_id"] in paid or need["total"] <= 0:
            continue
        aadhaar = doc.get("aadhaar") or {}
        due.append({
            "user_id": doc["user_id"],
            "name": doc.get("name", ""),
            "phone": doc.get("phone") or "",
            "taluka": aadhaar.get("taluka", ""),
            "district": aadhaar.get("district", ""),
            "amount": need["total"],
            "mess": need["mess"],
            "bank": _bank(doc),
        })
    return due


@router.get("/payments/summary")
async def payments_summary(period: Optional[str] = None):
    period = payments.check_period(period)
    db = get_database()
    totals = await payments.balance(db)
    due = await _due_students(period)
    paid = await payments.sum_amounts(db, Collections.PAYMENTS, {"period": period})
    due_total = sum(d["amount"] for d in due)
    return {
        "period": period,
        **totals,
        "due_total": due_total,
        "due_count": len(due),
        "paid_total": paid["amount"],
        "paid_count": paid["count"],
        "shortfall": max(0, due_total - totals["balance"]),
    }


@router.get("/payments/due")
async def payments_due(period: Optional[str] = None, search: Optional[str] = None):
    period = payments.check_period(period)
    return {"period": period, "items": await _due_students(period, search)}


@router.get("/payments")
async def payments_made(period: Optional[str] = None, limit: int = Query(200, ge=1, le=1000)):
    period = payments.check_period(period)
    cursor = get_database()[Collections.PAYMENTS].find({"period": period}).sort("created_at", -1).limit(limit)
    return {"period": period, "items": [_payment_out(p) async for p in cursor]}


def _payment_out(p: Dict[str, Any]) -> Dict[str, Any]:
    return {k: p.get(k) for k in ("user_id", "student_name", "period", "amount", "mess", "reference", "note", "account_last4", "ifsc", "by_name", "created_at")} | {"id": str(p["_id"])}


@router.post("/payments", status_code=status.HTTP_201_CREATED)
async def record_payment(body: PaymentRequest, admin: Dict[str, Any] = Depends(current_admin)):
    """Marks a student as paid for a month, after the admin has transferred the money.

    The amount is the student's current monthly requirement — it is never taken from the request.
    """
    period = payments.check_period(body.period)
    db = get_database()
    doc = await db[Collections.STUDENTS].find_one({"user_id": body.user_id, **ACCEPTED})
    if not doc:
        raise AppError("payments.not_accepted")
    need = payments.monthly_requirement(doc)
    if need["total"] <= 0:
        raise AppError("payments.nothing_due")
    if await db[Collections.PAYMENTS].find_one({"user_id": body.user_id, "period": period}, {"_id": 1}):
        raise AppError("payments.already_paid")

    funds = await payments.balance(db)
    if funds["balance"] < need["total"]:
        raise AppError("payments.insufficient_funds", {"balance": funds["balance"], "amount": need["total"]})

    bank = doc.get("bank") or {}
    payment = {
        "user_id": body.user_id,
        "student_name": doc.get("name", ""),
        "period": period,
        "amount": need["total"],
        "mess": need["mess"],
        "reference": body.reference.strip(),
        "note": body.note.strip(),
        "account_last4": bank.get("account_last4", ""),
        "ifsc": bank.get("ifsc", ""),
        "by_id": str(admin["_id"]),
        "by_name": admin["name"],
        "created_at": utc_now(),
    }
    try:
        result = await db[Collections.PAYMENTS].insert_one(payment)
    except DuplicateKeyError:
        raise AppError("payments.already_paid")

    # Two admins paying at the same moment could overdraw — undo if that happened
    if (await payments.balance(db))["balance"] < 0:
        await db[Collections.PAYMENTS].delete_one({"_id": result.inserted_id})
        raise AppError("payments.insufficient_funds", {"balance": funds["balance"], "amount": need["total"]})
    payment["_id"] = result.inserted_id

    if doc.get("phone"):
        student_user = await UserRepository(db).get(body.user_id)
        await notifications.payment_transferred(
            doc["phone"], doc.get("name", ""), need["total"], period, (student_user or {}).get("preferred_language")
        )
    return _payment_out(payment)


@router.get("/funds")
async def list_funds(limit: int = Query(50, ge=1, le=500)):
    cursor = get_database()[Collections.FUNDS].find().sort("created_at", -1).limit(limit)
    return {"items": [{k: f.get(k) for k in ("amount", "source", "note", "by_name", "created_at", "donation_id", "receipt_no")} | {"id": str(f["_id"])} async for f in cursor]}


@router.post("/funds", status_code=status.HTTP_201_CREATED)
async def add_funds(body: FundRequest, admin: Dict[str, Any] = Depends(current_admin)):
    """Records money received into the scheme's fund (e.g. a donation)."""
    db = get_database()
    await db[Collections.FUNDS].insert_one({
        "amount": body.amount,
        "source": body.source.strip(),
        "note": body.note.strip(),
        "by_id": str(admin["_id"]),
        "by_name": admin["name"],
        "created_at": utc_now(),
    })
    return await payments.balance(db)
