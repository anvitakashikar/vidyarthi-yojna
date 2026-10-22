"""Donor sign-up, section 2: bank details and PAN card.

When both are saved the donor's `onboarding_complete` flag is set and the
donor dashboard opens.
"""
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile
from pymongo.errors import DuplicateKeyError

from app.api.deps import require_roles
from app.api.routes.students import document_response
from app.core.crypto import encrypt, fingerprint
from app.core.errors import AppError
from app.core.validators import normalize_pan
from app.db.mongodb import get_database
from app.models.base import utc_now
from app.models.user import Role
from app.repositories.donors import DonorRepository
from app.repositories.students import DocumentRepository
from app.repositories.users import UserRepository
from app.schemas.donor import DonorProfileResponse
from app.services.documents import has_file, store_document
from app.services.kyc import bank_details

router = APIRouter(prefix="/donors/me", tags=["Donor"])

current_donor = require_roles(Role.DONOR)


async def _respond(user_id: str, doc: Dict[str, Any]) -> DonorProfileResponse:
    await UserRepository(get_database()).update(user_id, {"onboarding_complete": doc.get("onboarding_complete", False)})
    return DonorProfileResponse.from_doc(doc)


@router.get("/profile", response_model=DonorProfileResponse)
async def get_profile(user: Dict[str, Any] = Depends(current_donor)):
    return DonorProfileResponse.from_doc(await DonorRepository(get_database()).get_by_user(str(user["_id"])))


@router.put("/bank", response_model=DonorProfileResponse)
async def save_bank(
    account_holder_name: str = Form(...),
    account_number: str = Form(...),
    ifsc: str = Form(...),
    bank_name: str = Form(...),
    branch_name: str = Form(...),
    proof_file: Optional[UploadFile] = File(None),
    user: Dict[str, Any] = Depends(current_donor),
):
    """Bank details. A cancelled cheque / passbook copy is optional."""
    user_id = str(user["_id"])
    bank = bank_details(account_holder_name, account_number, ifsc, bank_name, branch_name)
    donors = DonorRepository(get_database())
    existing = (await donors.get_by_user(user_id) or {}).get("bank") or {}
    proof_id = await store_document(user_id, "donor_bank_proof", proof_file) if has_file(proof_file) else existing.get("proof_document_id")

    doc = await donors.upsert_section(user, "bank", {**bank, "proof_document_id": proof_id, "submitted_at": utc_now()})
    old = existing.get("proof_document_id")
    if old and old != proof_id:
        await DocumentRepository(get_database()).delete_with_file(old)
    return await _respond(user_id, doc)


@router.put("/pan", response_model=DonorProfileResponse)
async def save_pan(
    pan_number: str = Form(...),
    name_on_pan: str = Form(...),
    pan_file: Optional[UploadFile] = File(None),
    user: Dict[str, Any] = Depends(current_donor),
):
    """PAN card details. The 4th letter must be P, B, C, H or T."""
    user_id = str(user["_id"])
    pan = normalize_pan(pan_number)
    if not pan:
        raise AppError("donor.invalid_pan")
    name = " ".join(name_on_pan.split())
    if not 2 <= len(name) <= 100:
        raise AppError("donor.invalid_pan_name")

    donors = DonorRepository(get_database())
    pan_hash = fingerprint(pan)
    if await donors.collection.find_one({"pan.number_hash": pan_hash, "user_id": {"$ne": user_id}}):
        raise AppError("donor.pan_exists")

    existing = (await donors.get_by_user(user_id) or {}).get("pan") or {}
    document_id = await store_document(user_id, "pan_card", pan_file) if has_file(pan_file) else existing.get("document_id")
    try:
        doc = await donors.upsert_section(
            user,
            "pan",
            {"number_enc": encrypt(pan), "number_hash": pan_hash, "name_on_pan": name.upper(), "document_id": document_id, "submitted_at": utc_now()},
        )
    except DuplicateKeyError:
        raise AppError("donor.pan_exists")

    old = existing.get("document_id")
    if old and old != document_id:
        await DocumentRepository(get_database()).delete_with_file(old)
    return await _respond(user_id, doc)


@router.get("/documents/{document_id}")
async def download_document(document_id: str, user: Dict[str, Any] = Depends(current_donor)):
    doc = await DocumentRepository(get_database()).get(document_id)
    if doc and doc["owner_user_id"] != str(user["_id"]):
        doc = None
    return await document_response(doc)
