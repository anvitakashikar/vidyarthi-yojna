"""Donation receipt numbers and PDF receipts.

Receipt numbers follow the Indian financial year (April–March):
    VY/2026-27/000001
"""
from datetime import date, datetime, timezone
from typing import Any, Dict

from fpdf import FPDF
from pymongo import ReturnDocument
from pymongo.asynchronous.database import AsyncDatabase

from app.core.config import settings
from app.db.collections import Collections

NAVY = (2, 59, 119)    # #023b77
TEAL = (3, 149, 131)   # #039583
SLATE = (71, 85, 105)

METHOD_LABELS = {"upi": "UPI", "netbanking": "Net banking", "card": "Card"}


def financial_year(d: date) -> str:
    start = d.year if d.month >= 4 else d.year - 1
    return f"{start}-{str(start + 1)[-2:]}"


async def next_receipt_number(db: AsyncDatabase, on: date) -> str:
    fy = financial_year(on)
    counter = await db[Collections.COUNTERS].find_one_and_update(
        {"_id": f"receipt-{fy}"}, {"$inc": {"seq": 1}}, upsert=True, return_document=ReturnDocument.AFTER
    )
    return f"VY/{fy}/{counter['seq']:06d}"


_ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
         "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]


def _below_thousand(n: int) -> str:
    words = []
    if n >= 100:
        words.append(f"{_ONES[n // 100]} Hundred")
        n %= 100
    if n >= 20:
        words.append(_TENS[n // 10] + (f" {_ONES[n % 10]}" if n % 10 else ""))
    elif n:
        words.append(_ONES[n])
    return " ".join(words)


def amount_in_words(amount: int) -> str:
    """Indian numbering: 1,25,000 -> 'One Lakh Twenty Five Thousand Rupees Only'."""
    if amount in (0, 1):
        return "Zero Rupees Only" if amount == 0 else "One Rupee Only"
    parts = []
    for value, name in ((10_000_000, "Crore"), (100_000, "Lakh"), (1_000, "Thousand")):
        if amount >= value:
            count = amount // value
            parts.append(f"{amount_in_words_raw(count)} {name}")
            amount %= value
    if amount:
        parts.append(_below_thousand(amount))
    return " ".join(parts) + " Rupees Only"


def amount_in_words_raw(n: int) -> str:
    return amount_in_words(n).replace(" Rupees Only", "") if n >= 1000 else _below_thousand(n)


def format_inr(amount: int) -> str:
    """12345678 -> '1,23,45,678'"""
    s = str(amount)
    if len(s) <= 3:
        return s
    head, tail = s[:-3], s[-3:]
    groups = []
    while len(head) > 2:
        groups.insert(0, head[-2:])
        head = head[:-2]
    if head:
        groups.insert(0, head)
    return ",".join(groups) + "," + tail


def method_details(donation: Dict[str, Any]) -> str:
    d = donation.get("details") or {}
    method = donation["method"]
    if method == "upi":
        return f"UPI ID: {d.get('upi_id', '')}"
    if method == "netbanking":
        return f"Bank: {d.get('bank_name', '')}"
    if method == "card":
        return f"{d.get('card_type', '').capitalize()} card ending {d.get('card_last4', '')}" + (f" ({d['card_network']})" if d.get("card_network") else "")
    return ""


def render_receipt(donation: Dict[str, Any]) -> bytes:
    """A one-page A4 donation receipt."""
    pdf = FPDF(format="A4")
    pdf.set_auto_page_break(False)
    pdf.add_page()
    w = pdf.w - 30  # content width (15 mm margins)

    # Header band
    pdf.set_fill_color(*NAVY)
    pdf.rect(0, 0, pdf.w, 38, "F")
    pdf.set_fill_color(*TEAL)
    pdf.rect(0, 38, pdf.w, 2.5, "F")
    pdf.set_text_color(255, 255, 255)
    pdf.set_xy(15, 11)
    pdf.set_font("Helvetica", "B", 22)
    pdf.cell(w, 10, settings.APP_NAME)
    pdf.set_xy(15, 22)
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(w, 6, "Supporting students' mess and study-place (abhyasika) expenses")

    # Title + number
    pdf.set_text_color(*NAVY)
    pdf.set_xy(15, 52)
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(w / 2, 8, "DONATION RECEIPT")
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*SLATE)
    created: datetime = donation["created_at"]
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    pdf.set_xy(15 + w / 2, 52)
    pdf.cell(w / 2, 5, f"Receipt no: {donation['receipt_no']}", align="R")
    pdf.set_xy(15 + w / 2, 58)
    pdf.cell(w / 2, 5, f"Date: {created.strftime('%d %b %Y')}", align="R")

    # Amount box
    pdf.set_fill_color(230, 246, 243)
    pdf.set_draw_color(*TEAL)
    pdf.rect(15, 72, w, 30, "DF")
    pdf.set_xy(20, 77)
    pdf.set_text_color(*SLATE)
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(w - 10, 5, "Amount received")
    pdf.set_xy(20, 83)
    pdf.set_text_color(*NAVY)
    pdf.set_font("Helvetica", "B", 20)
    pdf.cell(w - 10, 9, f"Rs. {format_inr(donation['amount'])}/-")
    pdf.set_xy(20, 93)
    pdf.set_text_color(*SLATE)
    pdf.set_font("Helvetica", "I", 9)
    pdf.cell(w - 10, 5, amount_in_words(donation["amount"]))

    # Details table
    rows = [
        ("Received from", donation["donor_name"]),
        ("PAN", donation.get("pan") or "-"),
        ("Mobile", donation.get("phone") or "-"),
        ("Email", donation.get("email") or "-"),
        ("Payment method", METHOD_LABELS.get(donation["method"], donation["method"])),
        ("Payment details", method_details(donation)),
        ("Transaction reference", donation.get("reference") or "-"),
        ("Purpose", "Donation towards student mess bills and abhyasika fees"),
    ]
    y = 112
    for label, value in rows:
        pdf.set_draw_color(226, 232, 240)
        pdf.line(15, y + 9, 15 + w, y + 9)
        pdf.set_xy(15, y + 2)
        pdf.set_text_color(*SLATE)
        pdf.set_font("Helvetica", "", 10)
        pdf.cell(55, 6, label)
        pdf.set_text_color(15, 23, 42)
        pdf.set_font("Helvetica", "B", 10)
        pdf.cell(w - 55, 6, _latin1(value))
        y += 10

    # Thank-you + footer
    pdf.set_xy(15, y + 10)
    pdf.set_text_color(*NAVY)
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(w, 7, "Thank you for supporting our students!")
    pdf.set_xy(15, y + 18)
    pdf.set_text_color(*SLATE)
    pdf.set_font("Helvetica", "", 9)
    pdf.multi_cell(w, 5, "Your contribution helps deserving students pay for their meals and a quiet place to study.")

    pdf.set_fill_color(*TEAL)
    pdf.rect(0, pdf.h - 18, pdf.w, 1, "F")
    pdf.set_xy(15, pdf.h - 14)
    pdf.set_font("Helvetica", "", 8)
    pdf.cell(w, 4, "This is a computer-generated receipt and does not require a signature.", align="C")
    return bytes(pdf.output())


def _latin1(text: str) -> str:
    """The built-in PDF fonts are Latin-1 only; replace anything else (e.g. Devanagari)."""
    return str(text).encode("latin-1", "replace").decode("latin-1")
