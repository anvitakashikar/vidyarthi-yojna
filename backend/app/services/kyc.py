"""Bank details validation, shared by student and donor sign-up."""
from typing import Any, Dict

from app.core.crypto import encrypt
from app.core.errors import AppError
from app.core.validators import normalize_account_number, normalize_ifsc


def bank_details(account_holder_name: str, account_number: str, ifsc: str, bank_name: str, branch_name: str) -> Dict[str, Any]:
    """Validates bank fields and returns the stored shape (account number encrypted)."""
    holder = account_holder_name.strip()
    if not 2 <= len(holder) <= 100:
        raise AppError("student.invalid_holder_name")
    account = normalize_account_number(account_number)
    if not account:
        raise AppError("student.invalid_account_number")
    ifsc_code = normalize_ifsc(ifsc)
    if not ifsc_code:
        raise AppError("student.invalid_ifsc")
    return {
        "account_holder_name": holder,
        "account_number_enc": encrypt(account),
        "account_last4": account[-4:],
        "ifsc": ifsc_code,
        "bank_name": bank_name.strip()[:100],
        "branch_name": branch_name.strip()[:100],
    }
