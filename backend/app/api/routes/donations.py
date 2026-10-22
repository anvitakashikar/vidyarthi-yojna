"""Scheme impact (for the home page) and donor donations with PDF receipts.

Donations are *recorded*: the donor pays via UPI / net banking / card outside
the app and records it here. Each donation gets a receipt number and is added
to the fund, so it shows up in "Money left" on the admin Payments page.
"""
import re
from datetime import date, datetime, timezone
from typing import Any, Dict, Literal, Optional

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import Response
from pydantic import BaseModel, Field, model_validator
from typing_extensions import Annotated

from app.api.deps import require_roles
from app.core.config import settings
from app.core.crypto import decrypt
from app.core.errors import AppError
from app.db.collections import Collections
from app.db.mongodb import get_database
from app.models.base import utc_now
from app.models.user import Role
from app.repositories.donors import DonorRepository
from app.services import payments, receipts, student_directory
from app.services.requirements import ACCEPTED, summarize

router = APIRouter(tags=["Donations"])

donor_or_admin = require_roles(Role.DONOR, Role.ADMIN)
current_donor = require_roles(Role.DONOR)

MAX_DONATION = 10_000_000  # ₹1 crore
UPI_RE = re.compile(r"^[\w.\-]{2,256}@[A-Za-z]{2,64}$")


class DonationRequest(BaseModel):
    amount: int = Field(gt=0, le=MAX_DONATION)
    method: Literal["upi", "netbanking", "card"]
    upi_id: Annotated[str, Field(max_length=100)] = ""
    bank_name: Annotated[str, Field(max_length=100)] = ""
    card_type: Optional[Literal["debit", "credit"]] = None
    card_last4: Annotated[str, Field(max_length=4)] = ""  # never the full card number
    card_network: Annotated[str, Field(max_length=30)] = ""
    reference: Annotated[str, Field(max_length=100)] = ""

    @model_validator(mode="after")
    def _method_details(self) -> "DonationRequest":
        if self.method == "upi" and not UPI_RE.match(self.upi_id.strip()):
            raise AppError("donation.invalid_upi")
        if self.method == "netbanking" and len(self.bank_name.strip()) < 2:
            raise AppError("donation.bank_required")
        if self.method == "card" and (not self.card_type or not re.fullmatch(r"\d{4}", self.card_last4)):
            raise AppError("donation.invalid_card")
        return self

    def details(self) -> Dict[str, str]:
        if self.method == "upi":
            return {"upi_id": self.upi_id.strip().lower()}
        if self.method == "netbanking":
            return {"bank_name": self.bank_name.strip()}
        return {"card_type": self.card_type, "card_last4": self.card_last4, "card_network": self.card_network.strip()}


def _out(d: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": str(d["_id"]),
        "receipt_no": d["receipt_no"],
        "amount": d["amount"],
        "method": d["method"],
        "method_details": receipts.method_details(d),
        "reference": d.get("reference", ""),
        "donor_name": d["donor_name"],
        "created_at": d["created_at"],
    }


@router.get("/impact")
async def impact(user: Dict[str, Any] = Depends(donor_or_admin)):
    """Aggregate figures for the home page — no student-level data."""
    db = get_database()
    totals = (await summarize(db[Collections.STUDENTS], dict(ACCEPTED)))["summary"]
    funds = await payments.balance(db)
    donations = await payments.sum_amounts(db, Collections.DONATIONS)
    return {
        "students_supported": totals["students"],
        "students_registered": await db[Collections.STUDENTS].count_documents({}),
        "monthly_need": totals["total"],
        "mess_need": totals["mess"],
        "abhyasika_need": totals["abhyasika"],
        "mess_students": totals["mess_users"],
        "abhyasika_students": totals["abhyasika_users"],
        "donations_total": donations["amount"],
        "donations_count": donations["count"],
        "paid_out": funds["paid"],
        "balance": funds["balance"],
    }


@router.get("/donations/payee")
async def payee(user: Dict[str, Any] = Depends(current_donor)):
    """Where donors should send money (configured in .env). Empty fields are hidden."""
    return {
        "upi_id": settings.DONATION_UPI_ID,
        "account_name": settings.DONATION_ACCOUNT_NAME,
        "account_number": settings.DONATION_ACCOUNT_NUMBER,
        "ifsc": settings.DONATION_IFSC,
        "bank_name": settings.DONATION_BANK_NAME,
    }


@router.post("/donations", status_code=status.HTTP_201_CREATED)
async def record_donation(body: DonationRequest, user: Dict[str, Any] = Depends(current_donor)):
    db = get_database()
    donor = await DonorRepository(db).get_by_user(str(user["_id"]))
    if not donor or not donor.get("pan"):
        raise AppError("donation.profile_incomplete")

    now = utc_now()
    donation = {
        "user_id": str(user["_id"]),
        "donor_name": user["name"],
        "phone": user.get("phone"),
        "email": user.get("email"),
        "pan": decrypt(donor["pan"]["number_enc"]),
        "amount": body.amount,
        "method": body.method,
        "details": body.details(),
        "reference": body.reference.strip(),
        "status": "recorded",
        "receipt_no": await receipts.next_receipt_number(db, now.date()),
        "created_at": now,
    }
    result = await db[Collections.DONATIONS].insert_one(donation)
    donation["_id"] = result.inserted_id

    # The donation adds to the fund that pays students
    await db[Collections.FUNDS].insert_one({
        "amount": body.amount,
        "source": user["name"],
        "note": f"Donation {donation['receipt_no']} via {receipts.METHOD_LABELS[body.method]}",
        "donation_id": str(result.inserted_id),
        "receipt_no": donation["receipt_no"],
        "by_id": str(user["_id"]),
        "by_name": user["name"],
        "created_at": now,
    })
    return _out(donation)


@router.get("/donations/me")
async def my_donations(user: Dict[str, Any] = Depends(current_donor), limit: int = Query(100, ge=1, le=500)):
    cursor = get_database()[Collections.DONATIONS].find({"user_id": str(user["_id"])}).sort("created_at", -1).limit(limit)
    items = [_out(d) async for d in cursor]
    return {"items": items, "total": sum(d["amount"] for d in items)}


# ------------------------------------------------------------------ admin: all donations with payment details

DONATION_COLUMNS = [
    ("date", "Date"),
    ("receipt_no", "Receipt no."),
    ("donor_name", "Donor"),
    ("phone", "Mobile"),
    ("email", "Email"),
    ("pan", "PAN"),
    ("amount", "Amount (₹)"),
    ("method_label", "Payment method"),
    ("method_details", "Payment details"),
    ("reference", "Transaction reference"),
]


def _donation_filter(
    search: Optional[str] = None,
    method: Optional[Literal["upi", "netbanking", "card"]] = None,
    period: Optional[str] = None,
    user_id: Optional[str] = None,
) -> Dict[str, Any]:
    query: Dict[str, Any] = {}
    if search and search.strip():
        pattern = {"$regex": re.escape(search.strip()), "$options": "i"}
        query["$or"] = [{"donor_name": pattern}, {"phone": pattern}, {"email": pattern}, {"receipt_no": pattern}, {"reference": pattern}]
    if method:
        query["method"] = method
    if period:
        if not payments.PERIOD_RE.match(period):
            raise AppError("payments.invalid_period")
        year, month = map(int, period.split("-"))
        start = datetime(year, month, 1, tzinfo=timezone.utc)
        end = datetime(year + (month == 12), month % 12 + 1, 1, tzinfo=timezone.utc)
        query["created_at"] = {"$gte": start, "$lt": end}
    if user_id:
        query["user_id"] = user_id
    return query


def _admin_row(d: Dict[str, Any]) -> Dict[str, Any]:
    return {
        **_out(d),
        "user_id": d["user_id"],
        "phone": d.get("phone") or "",
        "email": d.get("email") or "",
        "pan": d.get("pan") or "",
        "details": d.get("details") or {},
        "method_label": receipts.METHOD_LABELS.get(d["method"], d["method"]),
        "date": d["created_at"].date().isoformat(),
    }


@router.get("/admin/donations")
async def admin_donations(
    filters: Dict[str, Any] = Depends(_donation_filter),
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=200),
    admin: Dict[str, Any] = Depends(require_roles(Role.ADMIN)),
):
    """All donations with how they were paid (UPI ID / bank / card), reference and receipt."""
    collection = get_database()[Collections.DONATIONS]
    total = await payments.sum_amounts(get_database(), Collections.DONATIONS, filters)
    by_method = {m: {"amount": 0, "count": 0} for m in receipts.METHOD_LABELS}
    async for row in await collection.aggregate([{"$match": filters}, {"$group": {"_id": "$method", "amount": {"$sum": "$amount"}, "count": {"$sum": 1}}}]):
        by_method[row["_id"]] = {"amount": row["amount"], "count": row["count"]}
    docs = await collection.find(filters).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    return {"total": total["count"], "amount": total["amount"], "by_method": by_method, "items": [_admin_row(d) for d in docs]}


@router.get("/admin/donations/export")
async def export_donations(
    filters: Dict[str, Any] = Depends(_donation_filter),
    format: Literal["xlsx", "csv"] = "xlsx",
    admin: Dict[str, Any] = Depends(require_roles(Role.ADMIN)),
):
    docs = await get_database()[Collections.DONATIONS].find(filters).sort("created_at", 1).to_list(length=50_000)
    rows = [_admin_row(d) for d in docs]
    totals = {"date": f"TOTAL ({len(rows)} donations)", "amount": sum(r["amount"] for r in rows)}
    stamp = date.today().isoformat()
    if format == "csv":
        content, media = student_directory.export_csv(rows, DONATION_COLUMNS, totals), "text/csv; charset=utf-8"
    else:
        content = student_directory.export_xlsx(rows, DONATION_COLUMNS, title="Donations", totals=totals)
        media = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    return Response(content, media_type=media,
                    headers={"Content-Disposition": f'attachment; filename="vidyarthi-yojna-donations-{stamp}.{format}"', "Cache-Control": "no-store"})


@router.get("/donations/{donation_id}/receipt")
async def download_receipt(donation_id: str, user: Dict[str, Any] = Depends(donor_or_admin)):
    from bson import ObjectId

    if not ObjectId.is_valid(donation_id):
        raise AppError("error.not_found")
    donation = await get_database()[Collections.DONATIONS].find_one({"_id": ObjectId(donation_id)})
    if not donation or (user["role"] == Role.DONOR.value and donation["user_id"] != str(user["_id"])):
        raise AppError("error.not_found")
    filename = f"receipt-{donation['receipt_no'].replace('/', '-')}.pdf"
    return Response(
        receipts.render_receipt(donation),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"', "Cache-Control": "no-store"},
    )
