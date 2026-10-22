"""Validators for Indian identifiers: mobile numbers, Aadhaar, IFSC, bank accounts."""
import re
from datetime import date
from typing import Optional


def calculate_age(dob: date, today: Optional[date] = None) -> int:
    today = today or date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def title_case(value: str) -> str:
    """'  haveli ' -> 'Haveli', 'PUNE city' -> 'Pune City' — keeps taluka names consistent."""
    return " ".join(word.capitalize() for word in (value or "").split())

_MOBILE_RE = re.compile(r"^[6-9]\d{9}$")
_AADHAAR_RE = re.compile(r"^[2-9]\d{11}$")
_IFSC_RE = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")
_ACCOUNT_RE = re.compile(r"^\d{9,18}$")
# PAN: 5 letters, 4 digits, 1 letter. The 4th letter is the holder type.
# Accepted for donors: P individual, B body of individuals, C company, H HUF, T trust.
_PAN_RE = re.compile(r"^[A-Z]{3}[PBCHT][A-Z]\d{4}[A-Z]$")


def normalize_indian_mobile(value: Optional[str]) -> Optional[str]:
    """Returns the 10-digit mobile number, or None if it is not valid.

    Accepts "98765 43210", "+91-9876543210", "09876543210", etc.
    """
    digits = re.sub(r"\D", "", value or "")
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    return digits if _MOBILE_RE.match(digits) else None


# Verhoeff checksum tables — Aadhaar's last digit is a Verhoeff check digit
_D = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6], [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
]
_P = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2], [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
]


def normalize_aadhaar(value: Optional[str]) -> Optional[str]:
    """Returns the 12-digit Aadhaar number if it is well-formed and passes the checksum."""
    digits = re.sub(r"[\s-]", "", value or "")
    if not _AADHAAR_RE.match(digits):
        return None
    check = 0
    for i, ch in enumerate(reversed(digits)):
        check = _D[check][_P[i % 8][int(ch)]]
    return digits if check == 0 else None


def normalize_ifsc(value: Optional[str]) -> Optional[str]:
    code = (value or "").strip().upper()
    return code if _IFSC_RE.match(code) else None


def normalize_account_number(value: Optional[str]) -> Optional[str]:
    digits = re.sub(r"\s", "", value or "")
    return digits if _ACCOUNT_RE.match(digits) else None


def normalize_pan(value: Optional[str]) -> Optional[str]:
    """Returns the PAN in capitals if valid (4th letter P, B, C, H or T), else None."""
    pan = re.sub(r"\s", "", value or "").upper()
    return pan if _PAN_RE.match(pan) else None
