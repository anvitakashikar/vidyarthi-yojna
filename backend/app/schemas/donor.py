from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel

from app.core.crypto import decrypt
from app.repositories.donors import DONOR_SECTIONS


def mask_pan(pan: str) -> str:
    """ABCPE1234F -> XXXXX1234F"""
    return "XXXXX" + pan[5:]


class DonorBankSummary(BaseModel):
    account_holder_name: str
    masked_account_number: str
    account_number: Optional[str] = None  # admin responses only
    ifsc: str
    bank_name: str
    branch_name: str
    proof_document_id: Optional[str] = None
    submitted_at: datetime


class DonorPanSummary(BaseModel):
    masked_pan: str
    pan: Optional[str] = None  # admin responses only
    holder_type: str  # P individual, B body of individuals, C company, H HUF, T trust
    name_on_pan: str
    document_id: Optional[str] = None
    submitted_at: datetime


class DonorProfileResponse(BaseModel):
    """What the donor sees — account number and PAN are masked."""

    name: str = ""
    phone: Optional[str] = None
    email: Optional[str] = None
    bank: Optional[DonorBankSummary] = None
    pan: Optional[DonorPanSummary] = None
    sections_complete: Dict[str, bool] = {}
    onboarding_complete: bool = False

    @classmethod
    def from_doc(cls, doc: Optional[Dict[str, Any]], full: bool = False) -> "DonorProfileResponse":
        if not doc:
            return cls(sections_complete={s: False for s in DONOR_SECTIONS})
        bank, pan = doc.get("bank"), doc.get("pan")
        pan_value = decrypt(pan["number_enc"]) if pan else ""
        return cls(
            name=doc.get("name", ""),
            phone=doc.get("phone"),
            email=doc.get("email"),
            bank=DonorBankSummary(
                account_holder_name=bank["account_holder_name"],
                masked_account_number=f"XXXXXX{bank['account_last4']}",
                account_number=decrypt(bank["account_number_enc"]) if full else None,
                ifsc=bank["ifsc"],
                bank_name=bank["bank_name"],
                branch_name=bank["branch_name"],
                proof_document_id=bank.get("proof_document_id"),
                submitted_at=bank["submitted_at"],
            )
            if bank
            else None,
            pan=DonorPanSummary(
                masked_pan=mask_pan(pan_value),
                pan=pan_value if full else None,
                holder_type=pan_value[3],
                name_on_pan=pan["name_on_pan"],
                document_id=pan.get("document_id"),
                submitted_at=pan["submitted_at"],
            )
            if pan
            else None,
            sections_complete={s: bool(doc.get(s)) for s in DONOR_SECTIONS},
            onboarding_complete=doc.get("onboarding_complete", False),
        )


class AdminDonorResponse(DonorProfileResponse):
    """Admin view — full account number and PAN."""

    user_id: str = ""

    @classmethod
    def from_doc(cls, doc: Optional[Dict[str, Any]], full: bool = True) -> "AdminDonorResponse":
        base = DonorProfileResponse.from_doc(doc, full=True).model_dump()
        return cls(**base, user_id=(doc or {}).get("user_id", ""))


class DonorListPage(BaseModel):
    total: int
    items: List[AdminDonorResponse]
