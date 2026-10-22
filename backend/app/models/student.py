"""Student record — one document per student in the `students` collection.

The sign-up is split into sections, each stored as a sub-document:
    personal   section 1 — gender, guardian, college, course
    aadhaar    section 2 — Aadhaar card (+ DOB, taluka read from it)
    bank       section 2 — bank details + bank statement
    expenses   section 3 — monthly mess bill and abhyasika (study place)

`name`, `phone` and `email` are copied from the user account so the student
directory can be searched and exported from this one collection.

Sensitive values are never stored in plain text:
    aadhaar.number_enc / address_enc / bank.account_number_enc   Fernet-encrypted
    aadhaar.number_hash   keyed hash, unique — blocks one Aadhaar on two accounts
"""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel

from app.models.base import MongoBaseModel

SECTIONS = ("personal", "aadhaar", "bank", "expenses")


class PersonalInfo(BaseModel):
    gender: str                 # male | female | other
    guardian_name: str
    guardian_phone: Optional[str] = None
    college_name: str
    course: str
    year_of_study: int
    submitted_at: datetime


class AadhaarExtractionInfo(BaseModel):
    method: str                 # qr_secure | qr_xml | ai | none
    warnings: List[str] = []
    edited_fields: List[str] = []  # fields the student changed after auto-reading


class AadhaarInfo(BaseModel):
    number_enc: str
    number_hash: str
    last4: str
    document_id: str
    dob: datetime               # stored as midnight UTC
    gender: Optional[str] = None
    address_enc: str
    taluka: str
    district: str
    state: str
    pincode: Optional[str] = None
    extraction: AadhaarExtractionInfo
    submitted_at: datetime


class BankInfo(BaseModel):
    account_holder_name: str
    account_number_enc: str
    account_last4: str
    ifsc: str
    bank_name: str
    branch_name: str
    statement_document_id: str
    submitted_at: datetime


class MessInfo(BaseModel):
    uses_mess: bool
    name: Optional[str] = None
    address: Optional[str] = None
    monthly_bill: Optional[int] = None      # rupees
    receipt_document_id: Optional[str] = None


class AbhyasikaInfo(BaseModel):
    uses_abhyasika: bool
    name: Optional[str] = None
    address: Optional[str] = None
    monthly_fee: Optional[int] = None       # rupees
    receipt_document_id: Optional[str] = None


class ExpensesInfo(BaseModel):
    mess: MessInfo
    abhyasika: AbhyasikaInfo
    submitted_at: datetime


class StudentRecord(MongoBaseModel):
    user_id: str
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    personal: Optional[PersonalInfo] = None
    aadhaar: Optional[AadhaarInfo] = None
    bank: Optional[BankInfo] = None
    expenses: Optional[ExpensesInfo] = None
    onboarding_complete: bool = False
    verification_status: str = "pending"  # pending | verified | rejected (set by admin later)


class Document(MongoBaseModel):
    """Metadata for an uploaded file (`documents` collection). The file itself is encrypted on disk."""

    owner_user_id: str
    kind: str                # aadhaar | bank_statement | mess_receipt | abhyasika_receipt
    original_filename: str
    content_type: str
    size_bytes: int
    storage_path: str        # relative to UPLOAD_DIR
    pending: bool = False    # uploaded but not yet confirmed by the student
    extraction: Optional[dict] = None  # Aadhaar auto-read result (never the full number)
