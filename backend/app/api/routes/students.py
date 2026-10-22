"""Student sign-up sections.

    Section 1  personal   — sent with registration; PUT /personal to edit
    Section 2  aadhaar    — POST /aadhaar/read (upload + auto-read) then PUT /aadhaar (confirm)
               bank       — PUT /bank (details + bank statement upload)
    Section 3  expenses   — PUT /expenses (monthly mess bill + abhyasika)

When all four are saved the student's `onboarding_complete` flag is set.
"""
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import Response
from pymongo.errors import DuplicateKeyError

from app.api.deps import require_roles
from app.core import eligibility
from app.core.crypto import encrypt, fingerprint
from app.core.errors import AppError
from app.core.validators import calculate_age, normalize_aadhaar, title_case
from app.db.mongodb import get_database
from app.models.base import utc_now
from app.models.user import Role
from app.repositories.students import DocumentRepository, StudentRepository
from app.repositories.users import UserRepository
from app.schemas.student import AadhaarReadResponse, AadhaarSaveRequest, PersonalUpdateRequest, StudentProfileResponse
from app.services import storage
from app.services.aadhaar_reader import read_aadhaar
from app.services.documents import has_file, store_document
from app.services.kyc import bank_details

router = APIRouter(prefix="/students/me", tags=["Student"])

current_student = require_roles(Role.STUDENT)

MIN_AGE, MAX_AGE = 10, 60
MAX_MONTHLY_AMOUNT = 100_000


async def _sync_user_onboarding(user_id: str, profile: Dict[str, Any]) -> StudentProfileResponse:
    await UserRepository(get_database()).update(user_id, {"onboarding_complete": profile.get("onboarding_complete", False)})
    return StudentProfileResponse.from_doc(profile)


# ------------------------------------------------------------------ profile / section 1


@router.get("/profile", response_model=StudentProfileResponse)
async def get_profile(user: Dict[str, Any] = Depends(current_student)):
    profile = await StudentRepository(get_database()).get_by_user(str(user["_id"]))
    return StudentProfileResponse.from_doc(profile)


@router.put("/personal", response_model=StudentProfileResponse)
async def save_personal(body: PersonalUpdateRequest, user: Dict[str, Any] = Depends(current_student)):
    user_id = str(user["_id"])
    users = UserRepository(get_database())
    email = body.email.lower() if body.email else None
    if email and email != user.get("email") and await users.get_by_email(email):
        raise AppError("auth.email_exists")
    try:
        await users.update(user_id, {"name": body.name, "email": email})
    except DuplicateKeyError:
        raise AppError("auth.email_exists")

    personal = body.model_dump(exclude={"name", "email"})
    profile = await StudentRepository(get_database()).upsert_section(
        user_id,
        "personal",
        {**personal, "submitted_at": utc_now()},
        extra={"name": body.name, "email": email, "phone": user.get("phone")},
    )
    return await _sync_user_onboarding(user_id, profile)


# ------------------------------------------------------------------ section 2: Aadhaar


@router.post("/aadhaar/read", response_model=AadhaarReadResponse)
async def read_aadhaar_card(
    aadhaar_file: UploadFile = File(...),
    pdf_password: Optional[str] = Form(None),
    user: Dict[str, Any] = Depends(current_student),
):
    """Uploads the Aadhaar card and reads DOB, address and taluka from it.

    Nothing is saved to the profile yet — the student reviews the values and
    confirms them with PUT /aadhaar.
    """
    user_id = str(user["_id"])
    data, content_type = await storage.read_upload(aadhaar_file)
    result = await read_aadhaar(data, content_type, user["name"], pdf_password)

    if "pdf_locked" in result.warnings:
        return AadhaarReadResponse(**result.to_dict())

    documents = DocumentRepository(get_database())
    await documents.delete_pending(user_id, "aadhaar")
    # Keep the read result for later comparison — but never the full Aadhaar number
    extraction = {k: v for k, v in result.to_dict().items() if k != "aadhaar_number"}
    document_id = await store_document(
        user_id, "aadhaar", aadhaar_file, data, content_type, pending=True, extraction=extraction
    )

    age = None
    if result.dob:
        age = calculate_age(datetime.fromisoformat(result.dob).date())
    elif result.year_of_birth:
        age = utc_now().year - result.year_of_birth
    return AadhaarReadResponse(document_id=document_id, age=age, **result.to_dict())


_COMPARABLE = ("dob", "taluka", "district", "pincode", "gender")


@router.put("/aadhaar", response_model=StudentProfileResponse)
async def save_aadhaar(body: AadhaarSaveRequest, user: Dict[str, Any] = Depends(current_student)):
    user_id = str(user["_id"])
    number = normalize_aadhaar(body.aadhaar_number)
    if not number:
        raise AppError("student.invalid_aadhaar")
    age = calculate_age(body.dob)
    if not MIN_AGE <= age <= MAX_AGE:
        raise AppError("student.invalid_dob")
    taluka, district = title_case(body.taluka), title_case(body.district)
    if len(taluka) < 2 or len(district) < 2:
        raise AppError("student.taluka_required")

    students = StudentRepository(get_database())
    documents = DocumentRepository(get_database())
    existing = (await students.get_by_user(user_id) or {}).get("aadhaar")

    if body.document_id:
        card = await documents.get_owned(body.document_id, user_id, "aadhaar")
        if not card:
            raise AppError("student.document_not_found")
        document_id = body.document_id
        extraction = card.get("extraction") or {}
    elif existing:
        document_id = existing["document_id"]
        extraction = {"method": existing["extraction"]["method"], "warnings": existing["extraction"].get("warnings", [])}
    else:
        raise AppError("student.aadhaar_file_required")

    # The QR code on the card carries the last 4 digits — catch typos and wrong cards
    if extraction.get("aadhaar_last4") and extraction["aadhaar_last4"] != number[-4:]:
        raise AppError("student.aadhaar_mismatch")

    number_hash = fingerprint(number)
    if await students.collection.find_one({"aadhaar.number_hash": number_hash, "user_id": {"$ne": user_id}}):
        raise AppError("student.aadhaar_exists")

    submitted = {"dob": body.dob.isoformat(), "taluka": taluka, "district": district, "pincode": body.pincode or "", "gender": body.gender or ""}
    edited = [
        f for f in _COMPARABLE
        if extraction.get(f) and str(extraction[f]).strip().lower() != submitted[f].strip().lower()
    ]

    try:
        profile = await students.upsert_section(
            user_id,
            "aadhaar",
            {
                "number_enc": encrypt(number),
                "number_hash": number_hash,
                "last4": number[-4:],
                "document_id": document_id,
                "dob": datetime(body.dob.year, body.dob.month, body.dob.day, tzinfo=timezone.utc),
                "gender": body.gender,
                "address_enc": encrypt(body.address.strip()),
                "taluka": taluka,
                "district": district,
                "state": title_case(body.state),
                "pincode": body.pincode,
                "extraction": {
                    "method": extraction.get("method", "none"),
                    "warnings": extraction.get("warnings", []),
                    "edited_fields": edited if body.document_id else (existing or {}).get("extraction", {}).get("edited_fields", edited),
                },
                "submitted_at": utc_now(),
            },
            # Scheme eligibility (age 18-24 + listed taluka) is decided here, on the backend
            extra={"eligibility": eligibility.evaluate(body.dob, taluka, district).to_dict()},
        )
    except DuplicateKeyError:
        raise AppError("student.aadhaar_exists")

    if body.document_id:
        await documents.collection.update_one({"_id": card["_id"]}, {"$set": {"pending": False}})
        if existing and existing["document_id"] != document_id:
            await documents.delete_with_file(existing["document_id"])
    return await _sync_user_onboarding(user_id, profile)


# ------------------------------------------------------------------ section 2: bank


@router.put("/bank", response_model=StudentProfileResponse)
async def save_bank(
    account_holder_name: str = Form(...),
    account_number: str = Form(...),
    ifsc: str = Form(...),
    bank_name: str = Form(...),
    branch_name: str = Form(...),
    statement_file: Optional[UploadFile] = File(None),
    user: Dict[str, Any] = Depends(current_student),
):
    """Bank details plus a bank statement. The statement is required the first time."""
    user_id = str(user["_id"])
    bank = bank_details(account_holder_name, account_number, ifsc, bank_name, branch_name)

    students = StudentRepository(get_database())
    existing = (await students.get_by_user(user_id) or {}).get("bank") or {}
    statement_id = existing.get("statement_document_id")
    if has_file(statement_file):
        statement_id = await store_document(user_id, "bank_statement", statement_file)
    if not statement_id:
        raise AppError("student.statement_required")

    profile = await students.upsert_section(
        user_id,
        "bank",
        {**bank, "statement_document_id": statement_id, "submitted_at": utc_now()},
    )
    old = existing.get("statement_document_id")
    if old and old != statement_id:
        await DocumentRepository(get_database()).delete_with_file(old)
    return await _sync_user_onboarding(user_id, profile)


# ------------------------------------------------------------------ section 3: mess + abhyasika


def _amount(value: Optional[str], error: str) -> int:
    try:
        amount = int(str(value).replace(",", "").strip())
    except (TypeError, ValueError):
        raise AppError(error)
    if not 0 <= amount <= MAX_MONTHLY_AMOUNT:
        raise AppError("student.invalid_amount")
    return amount


@router.put("/expenses", response_model=StudentProfileResponse)
async def save_expenses(
    uses_mess: bool = Form(...),
    mess_name: Optional[str] = Form(None),
    mess_address: Optional[str] = Form(None),
    mess_monthly_bill: Optional[str] = Form(None),
    mess_receipt: Optional[UploadFile] = File(None),
    uses_abhyasika: bool = Form(...),
    abhyasika_name: Optional[str] = Form(None),
    abhyasika_address: Optional[str] = Form(None),
    abhyasika_monthly_fee: Optional[str] = Form(None),
    abhyasika_receipt: Optional[UploadFile] = File(None),
    user: Dict[str, Any] = Depends(current_student),
):
    """Monthly mess bill and abhyasika (study place) details. Receipts are optional."""
    user_id = str(user["_id"])
    students = StudentRepository(get_database())
    existing = (await students.get_by_user(user_id) or {}).get("expenses") or {}
    old_mess, old_abhyasika = existing.get("mess") or {}, existing.get("abhyasika") or {}

    mess: Dict[str, Any] = {"uses_mess": uses_mess}
    if uses_mess:
        if not (mess_name or "").strip():
            raise AppError("student.mess_details_required")
        mess.update(
            name=mess_name.strip()[:150],
            address=(mess_address or "").strip()[:300],
            monthly_bill=_amount(mess_monthly_bill, "student.mess_details_required"),
            receipt_document_id=await store_document(user_id, "mess_receipt", mess_receipt)
            if has_file(mess_receipt)
            else old_mess.get("receipt_document_id"),
        )

    abhyasika: Dict[str, Any] = {"uses_abhyasika": uses_abhyasika}
    if uses_abhyasika:
        if not (abhyasika_name or "").strip():
            raise AppError("student.abhyasika_details_required")
        abhyasika.update(
            name=abhyasika_name.strip()[:150],
            address=(abhyasika_address or "").strip()[:300],
            monthly_fee=_amount(abhyasika_monthly_fee, "student.abhyasika_details_required"),
            receipt_document_id=await store_document(user_id, "abhyasika_receipt", abhyasika_receipt)
            if has_file(abhyasika_receipt)
            else old_abhyasika.get("receipt_document_id"),
        )

    profile = await students.upsert_section(
        user_id, "expenses", {"mess": mess, "abhyasika": abhyasika, "submitted_at": utc_now()}
    )

    documents = DocumentRepository(get_database())
    for old, new in ((old_mess, mess), (old_abhyasika, abhyasika)):
        if old.get("receipt_document_id") and old.get("receipt_document_id") != new.get("receipt_document_id"):
            await documents.delete_with_file(old["receipt_document_id"])
    return await _sync_user_onboarding(user_id, profile)


# ------------------------------------------------------------------ documents


async def document_response(doc: Optional[Dict[str, Any]]) -> Response:
    if not doc:
        raise AppError("student.document_not_found")
    content = await storage.load_decrypted(doc["storage_path"])
    return Response(content, media_type=doc["content_type"], headers={"Content-Disposition": "inline", "Cache-Control": "no-store"})


@router.get("/documents/{document_id}")
async def download_document(document_id: str, user: Dict[str, Any] = Depends(current_student)):
    """Lets a student view their own uploaded file."""
    doc = await DocumentRepository(get_database()).get(document_id)
    if doc and doc["owner_user_id"] != str(user["_id"]):
        doc = None
    return await document_response(doc)
