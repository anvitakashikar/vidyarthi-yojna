"""Student directory: flat rows for the admin table and Excel / CSV export.

Admin-only: bank account numbers are shown in full; Aadhaar numbers stay masked.
Cells that would start a spreadsheet formula are neutralised (CSV/formula injection).
"""
import csv
import io
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

from app.core.crypto import decrypt
from app.core.eligibility import describe
from app.core.validators import calculate_age

# (key, column header) — order is the export column order
COLUMNS = [
    ("name", "Name"),
    ("phone", "Mobile"),
    ("email", "Email"),
    ("gender", "Gender"),
    ("dob", "Date of birth"),
    ("age", "Age"),
    ("taluka", "Taluka"),
    ("district", "District"),
    ("state", "State"),
    ("pincode", "Pincode"),
    ("guardian_name", "Parent / guardian"),
    ("guardian_phone", "Guardian mobile"),
    ("college_name", "College / institute"),
    ("course", "Course"),
    ("year_of_study", "Year of study"),
    ("aadhaar", "Aadhaar (masked)"),
    ("aadhaar_read_method", "Aadhaar read by"),
    ("bank_name", "Bank"),
    ("branch_name", "Branch"),
    ("ifsc", "IFSC"),
    ("account", "Account no."),
    ("mess_name", "Mess"),
    ("mess_monthly_bill", "Mess bill / month (₹)"),
    ("monthly_total", "Total / month (₹)"),
    ("eligibility_label", "Eligibility"),
    ("eligibility_reason", "Eligibility reason"),
    ("profile_complete", "Profile complete"),
    ("verification_status", "Verification"),
    ("verification_remarks", "Verification remarks"),
    ("registered_on", "Registered on"),
]

_VERIFICATION_LABELS = {"verified": "Verified", "rejected": "Needs correction", "pending": "Pending review"}
_REASON_LABELS = {
    "aadhaar_unclear": "Aadhaar card unclear",
    "aadhaar_mismatch": "Details do not match Aadhaar card",
    "bank_statement_unclear": "Bank statement unclear",
    "bank_details_mismatch": "Bank details do not match statement",
    "enrollment_proof_unclear": "Enrollment proof unclear, incomplete or expired",
    "mess_details": "Mess details incorrect",
    "personal_details": "Basic details incorrect",
    "other": "Other",
}


def _remarks(doc: Dict[str, Any]) -> str:
    decision = doc.get("verification") or {}
    if decision.get("status") != "rejected":
        return ""
    parts = [_REASON_LABELS.get(r, r) for r in decision.get("reasons", [])]
    if decision.get("note"):
        parts.append(decision["note"])
    return "; ".join(parts)


_ELIGIBILITY_LABELS = {"eligible": "Eligible", "not_eligible": "Not eligible", "pending": "Pending"}
_READ_METHODS = {"qr_secure": "QR code", "qr_xml": "QR code", "ai": "AI", "none": "Manual"}


def build_filter(
    search: Optional[str] = None,
    taluka: Optional[str] = None,
    district: Optional[str] = None,
    status: Optional[str] = None,
    complete: Optional[bool] = None,
    eligibility: Optional[str] = None,
) -> Dict[str, Any]:
    query: Dict[str, Any] = {}
    conditions = []
    if search and search.strip():
        pattern = {"$regex": re.escape(search.strip()), "$options": "i"}
        conditions.append({"$or": [{"name": pattern}, {"phone": pattern}, {"email": pattern}, {"personal.college_name": pattern}]})
    if eligibility == "pending":
        conditions.append({"$or": [{"eligibility": {"$exists": False}}, {"eligibility.status": "pending"}]})
    elif eligibility:
        query["eligibility.status"] = eligibility
    if conditions:
        query["$and"] = conditions
    if taluka:
        query["aadhaar.taluka"] = taluka
    if district:
        query["aadhaar.district"] = district
    if status:
        query["verification_status"] = status
    if complete is not None:
        query["onboarding_complete"] = complete
    return query


def to_row(doc: Dict[str, Any]) -> Dict[str, Any]:
    personal = doc.get("personal") or {}
    aadhaar = doc.get("aadhaar") or {}
    bank = doc.get("bank") or {}
    expenses = doc.get("expenses") or {}
    mess = expenses.get("mess") or {}

    dob = aadhaar.get("dob")
    mess_bill = mess.get("monthly_bill") if mess.get("uses_mess") else None
    total = (mess_bill or 0) if expenses else None
    created = doc.get("created_at")
    elig = doc.get("eligibility") or {}
    elig_status = elig.get("status", "pending")

    return {
        "user_id": doc.get("user_id"),
        "name": doc.get("name", ""),
        "phone": doc.get("phone") or "",
        "email": doc.get("email") or "",
        "gender": (aadhaar.get("gender") or personal.get("gender") or "").capitalize(),
        "dob": dob.date().isoformat() if isinstance(dob, datetime) else "",
        "age": calculate_age(dob.date()) if isinstance(dob, datetime) else None,
        "taluka": aadhaar.get("taluka", ""),
        "district": aadhaar.get("district", ""),
        "state": aadhaar.get("state", ""),
        "pincode": aadhaar.get("pincode") or "",
        "guardian_name": personal.get("guardian_name", ""),
        "guardian_phone": personal.get("guardian_phone") or "",
        "college_name": personal.get("college_name", ""),
        "course": personal.get("course", ""),
        "year_of_study": personal.get("year_of_study"),
        "aadhaar": f"XXXX XXXX {aadhaar['last4']}" if aadhaar.get("last4") else "",
        "aadhaar_read_method": _READ_METHODS.get((aadhaar.get("extraction") or {}).get("method", ""), "") if aadhaar else "",
        "bank_name": bank.get("bank_name", ""),
        "branch_name": bank.get("branch_name", ""),
        "ifsc": bank.get("ifsc", ""),
        "account": decrypt(bank["account_number_enc"]) if bank.get("account_number_enc") else "",
        "mess_name": mess.get("name") or ("Not using" if expenses and not mess.get("uses_mess") else ""),
        "mess_monthly_bill": mess_bill,
        "monthly_total": total,
        "eligibility": elig_status,
        "eligibility_reasons": elig.get("reasons", []),
        "eligibility_label": _ELIGIBILITY_LABELS.get(elig_status, "Pending"),
        "eligibility_reason": describe(elig, aadhaar.get("taluka", ""), aadhaar.get("district", "")) if elig else "",
        "profile_complete": "Yes" if doc.get("onboarding_complete") else "No",
        "verification": doc.get("verification_status") or "pending",
        "verification_status": _VERIFICATION_LABELS.get(doc.get("verification_status") or "pending", "Pending"),
        "verification_remarks": _remarks(doc),
        "registered_on": created.date().isoformat() if isinstance(created, datetime) else "",
    }


Columns = List[Tuple[str, str]]
_FORMULA_START = ("=", "+", "-", "@", "\t", "\r")


def _cell(value: Any) -> Any:
    """Student-entered text must never run as a formula when an admin opens the file."""
    if value is None:
        return ""
    if isinstance(value, str) and value.startswith(_FORMULA_START):
        return "'" + value
    return value
HEADER_FILL = PatternFill("solid", fgColor="023B77")  # brand navy


def _write_sheet(ws, rows: List[Dict[str, Any]], columns: Columns, totals: Optional[Dict[str, Any]] = None) -> None:
    ws.append([header for _, header in columns])
    for row in rows:
        ws.append([_cell(row.get(key)) for key, _ in columns])
    for cell in ws[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = HEADER_FILL
        cell.alignment = Alignment(vertical="center", wrap_text=True)
    ws.freeze_panes = "B2"
    ws.auto_filter.ref = ws.dimensions
    if totals:
        ws.append([totals.get(key, "") for key, _ in columns])
        for cell in ws[ws.max_row]:
            cell.font = Font(bold=True)
    for idx, (key, header) in enumerate(columns, start=1):
        longest = max([len(str(r.get(key) or "")) for r in rows] + [len(header)])
        ws.column_dimensions[get_column_letter(idx)].width = min(max(10, longest + 2), 45)


def export_xlsx(
    rows: List[Dict[str, Any]],
    columns: Columns = COLUMNS,
    title: str = "Students",
    totals: Optional[Dict[str, Any]] = None,
    extra_sheets: Optional[List[Tuple[str, List[Dict[str, Any]], Columns]]] = None,
) -> bytes:
    """One sheet of rows (optionally with a bold totals row), plus optional extra sheets."""
    wb = Workbook()
    ws = wb.active
    ws.title = title
    _write_sheet(ws, rows, columns, totals)
    for sheet_title, sheet_rows, sheet_columns in extra_sheets or []:
        _write_sheet(wb.create_sheet(sheet_title), sheet_rows, sheet_columns)

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def export_csv(rows: List[Dict[str, Any]], columns: Columns = COLUMNS, totals: Optional[Dict[str, Any]] = None) -> bytes:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([header for _, header in columns])
    for row in rows + ([totals] if totals else []):
        writer.writerow([_cell(row.get(key)) for key, _ in columns])
    # BOM so Excel opens Marathi names in UTF-8 correctly
    return ("﻿" + buf.getvalue()).encode("utf-8")
