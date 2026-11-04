from datetime import date, datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field
from typing_extensions import Annotated

from app.core.crypto import decrypt
from app.core.eligibility import MAX_AGE, MIN_AGE, describe
from app.core.validators import calculate_age
from app.models.student import SECTIONS
from app.schemas.fields import Name, OptionalEmail, Phone, ShortText

Gender = Literal["male", "female", "other"]


# ------------------------------------------------------------------ requests


class StudentPersonalDetails(BaseModel):
    """Section 1 — sent with registration, editable later."""

    gender: Gender
    guardian_name: Name
    guardian_phone: Phone = None
    college_name: ShortText
    course: ShortText
    year_of_study: int = Field(ge=1, le=7)


class PersonalUpdateRequest(StudentPersonalDetails):
    name: Name
    email: OptionalEmail = None


class AadhaarSaveRequest(BaseModel):
    """Confirms the (auto-read, possibly corrected) Aadhaar details.

    `document_id` is the card uploaded via POST /students/me/aadhaar/read.
    Omit it to keep the card that is already saved.
    """

    document_id: Optional[str] = None
    aadhaar_number: str
    dob: date
    gender: Optional[Gender] = None
    address: Annotated[str, Field(max_length=500)] = ""
    taluka: Annotated[str, Field(max_length=100)]
    district: Annotated[str, Field(max_length=100)]
    state: Annotated[str, Field(max_length=100)] = "Maharashtra"
    pincode: Optional[Annotated[str, Field(pattern=r"^\d{6}$")]] = None


# Preset reasons an admin can give when asking a student to correct their details.
# The frontend shows each one to the student in English or Marathi.
CorrectionReason = Literal[
    "aadhaar_unclear",       # Aadhaar card image unclear / incomplete
    "aadhaar_mismatch",      # entered details do not match the Aadhaar card
    "bank_statement_unclear",
    "bank_details_mismatch",  # account details do not match the statement
    "enrollment_proof_unclear",
    "mess_details",
    "personal_details",
    "other",
]


class VerificationRequest(BaseModel):
    status: Literal["verified", "rejected", "pending"]
    reasons: List[CorrectionReason] = []
    note: Annotated[str, Field(max_length=500)] = ""


# ------------------------------------------------------------------ responses


class AadhaarReadResponse(BaseModel):
    """Result of auto-reading an uploaded Aadhaar card, for the student to review."""

    document_id: Optional[str] = None  # None when the PDF could not be opened
    method: str
    name: str = ""
    dob: str = ""
    age: Optional[int] = None
    year_of_birth: Optional[int] = None
    gender: str = ""
    aadhaar_number: str = ""
    aadhaar_last4: str = ""
    address: str = ""
    taluka: str = ""
    district: str = ""
    state: str = ""
    pincode: str = ""
    warnings: List[str] = []


class PersonalSummary(BaseModel):
    gender: str
    guardian_name: str
    guardian_phone: Optional[str] = None
    college_name: str
    course: str
    year_of_study: int


class AadhaarSummary(BaseModel):
    masked_number: str  # "XXXX XXXX 1234"
    document_id: str
    dob: date
    age: int
    gender: Optional[str] = None
    address: str
    taluka: str
    district: str
    state: str
    pincode: Optional[str] = None
    read_method: str
    edited_fields: List[str] = []
    submitted_at: datetime


class BankSummary(BaseModel):
    account_holder_name: str
    masked_account_number: str  # "XXXXXX5678"
    account_number: Optional[str] = None  # full number — admin responses only
    ifsc: str
    bank_name: str
    branch_name: str
    statement_document_id: Optional[str] = None
    submitted_at: datetime


class EnrollmentProofSummary(BaseModel):
    proof_type: str
    document_id: str
    submitted_at: datetime


class ExpensesSummary(BaseModel):
    mess: Dict[str, Any]
    submitted_at: datetime


class VerificationSummary(BaseModel):
    """The latest admin decision, as shown to the student (no admin identity)."""

    status: str                  # verified | rejected | pending
    reasons: List[str] = []
    note: str = ""
    decided_at: Optional[datetime] = None
    # True when the student changed their details after this decision,
    # so the record is waiting for a fresh review
    resubmitted: bool = False


class StudentProfileResponse(BaseModel):
    """What the student sees — sensitive numbers are masked. Admins get AdminStudentResponse."""

    name: str = ""
    phone: Optional[str] = None
    email: Optional[str] = None
    personal: Optional[PersonalSummary] = None
    aadhaar: Optional[AadhaarSummary] = None
    bank: Optional[BankSummary] = None
    enrollment_proof: Optional[EnrollmentProofSummary] = None
    expenses: Optional[ExpensesSummary] = None
    sections_complete: Dict[str, bool] = {}
    onboarding_complete: bool = False
    verification_status: str = "pending"
    eligibility_status: str = "pending"  # eligible | not_eligible | pending - no reasons for students
    verification: Optional[VerificationSummary] = None

    @classmethod
    def from_doc(cls, doc: Optional[Dict[str, Any]]) -> "StudentProfileResponse":
        if not doc:
            return cls(sections_complete={s: False for s in SECTIONS})
        personal, aadhaar, bank, enrollment_proof, expenses = (doc.get(s) for s in SECTIONS)

        aadhaar_summary = None
        if aadhaar:
            dob = aadhaar["dob"].date()
            aadhaar_summary = AadhaarSummary(
                masked_number=f"XXXX XXXX {aadhaar['last4']}",
                document_id=aadhaar["document_id"],
                dob=dob,
                age=calculate_age(dob),
                gender=aadhaar.get("gender"),
                address=decrypt(aadhaar["address_enc"]) if aadhaar.get("address_enc") else "",
                taluka=aadhaar["taluka"],
                district=aadhaar["district"],
                state=aadhaar.get("state", ""),
                pincode=aadhaar.get("pincode"),
                read_method=aadhaar.get("extraction", {}).get("method", "none"),
                edited_fields=aadhaar.get("extraction", {}).get("edited_fields", []),
                submitted_at=aadhaar["submitted_at"],
            )

        return cls(
            name=doc.get("name", ""),
            phone=doc.get("phone"),
            email=doc.get("email"),
            personal=PersonalSummary(**personal) if personal else None,
            aadhaar=aadhaar_summary,
            bank=BankSummary(
                account_holder_name=bank["account_holder_name"],
                masked_account_number=f"XXXXXX{bank['account_last4']}",
                ifsc=bank["ifsc"],
                bank_name=bank["bank_name"],
                branch_name=bank["branch_name"],
                statement_document_id=bank.get("statement_document_id"),
                submitted_at=bank["submitted_at"],
            )
            if bank
            else None,
            enrollment_proof=EnrollmentProofSummary(**enrollment_proof) if enrollment_proof else None,
            expenses=ExpensesSummary(**expenses) if expenses else None,
            sections_complete={s: bool(doc.get(s)) for s in SECTIONS},
            onboarding_complete=doc.get("onboarding_complete", False),
            verification_status=doc.get("verification_status", "pending"),
            eligibility_status=(doc.get("eligibility") or {}).get("status", "pending"),
            verification=_verification_summary(doc),
        )


def _verification_summary(doc: Dict[str, Any]) -> Optional[VerificationSummary]:
    decision = doc.get("verification")
    if not decision:
        return None
    return VerificationSummary(
        status=decision["status"],
        reasons=decision.get("reasons", []),
        note=decision.get("note", ""),
        decided_at=decision.get("at"),
        resubmitted=doc.get("verification_status", "pending") == "pending" and decision["status"] != "pending",
    )


class EligibilityDetails(BaseModel):
    status: str
    age: Optional[int] = None
    age_ok: bool = False
    taluka_ok: bool = False
    matched_district: str = ""
    matched_taluka: str = ""
    reasons: List[str] = []
    reason_text: str = ""
    checked_on: str = ""
    min_age: int = MIN_AGE
    max_age: int = MAX_AGE


class AdminStudentResponse(StudentProfileResponse):
    """Admin view of a student - includes why they are (not) eligible."""

    eligibility: Optional[EligibilityDetails] = None
    verification_history: List[Dict[str, Any]] = []

    @classmethod
    def from_doc(cls, doc: Optional[Dict[str, Any]]) -> "AdminStudentResponse":
        base = StudentProfileResponse.from_doc(doc).model_dump()
        result = (doc or {}).get("eligibility")
        details = None
        if result:
            aadhaar = doc.get("aadhaar") or {}
            details = EligibilityDetails(
                **{k: v for k, v in result.items() if k in EligibilityDetails.model_fields},
                reason_text=describe(result, aadhaar.get("taluka", ""), aadhaar.get("district", "")),
            )
        history = [
            {k: entry.get(k) for k in ("status", "reasons", "note", "by_name", "at")}
            for entry in reversed((doc or {}).get("verification_history", []))
        ]
        if base.get("bank") and doc.get("bank", {}).get("account_number_enc"):
            base["bank"]["account_number"] = decrypt(doc["bank"]["account_number_enc"])
        return cls(**base, eligibility=details, verification_history=history)


class StudentDirectoryPage(BaseModel):
    total: int
    items: List[Dict[str, Any]]
