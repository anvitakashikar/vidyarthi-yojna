"""Outgoing email over SMTP (works with Gmail / Google Workspace, Zoho, Outlook, Brevo…).

Used to email donation receipts. Sending never blocks or fails a payment: it runs
in the background and the outcome is stored on the donation.
"""
import asyncio
import logging
import smtplib
import ssl
from email.message import EmailMessage
from typing import Any, Dict, List, Optional, Set

from app.core.config import settings
from app.db.collections import Collections
from app.db.mongodb import get_database
from app.models.base import utc_now
from app.services import receipts

logger = logging.getLogger(__name__)

# Keeps background send tasks alive until they finish
_pending: Set["asyncio.Task[None]"] = set()


def is_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_FROM)


def _send(message: EmailMessage) -> None:
    context = ssl.create_default_context()
    if settings.SMTP_PORT == 465:
        server: smtplib.SMTP = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, context=context, timeout=30)
    else:
        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30)
        server.starttls(context=context)
    with server:
        if settings.SMTP_USERNAME:
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        server.send_message(message)


def _receipt_message(donation: Dict[str, Any]) -> EmailMessage:
    amount = f"Rs. {receipts.format_inr(donation['amount'])}"
    receipt_no = donation["receipt_no"]

    message = EmailMessage()
    message["Subject"] = f"Your donation receipt {receipt_no} - {settings.APP_NAME}"
    message["From"] = settings.SMTP_FROM
    message["To"] = donation["email"]
    copies: List[str] = [e.strip() for e in settings.DONATION_RECEIPT_BCC.split(",") if e.strip()]
    if copies:
        message["Bcc"] = ", ".join(copies)
    if settings.SMTP_REPLY_TO:
        message["Reply-To"] = settings.SMTP_REPLY_TO

    message.set_content(
        f"Dear {donation['donor_name']},\n\n"
        f"Thank you for your donation of {amount} to {settings.APP_NAME}, run by {receipts.FOUNDATION_NAME}.\n"
        "It will go towards meals for students from drought-hit farming families who are studying in Pune and PCMC.\n\n"
        f"Receipt number: {receipt_no}\n"
        f"Payment ID: {donation.get('reference') or '-'}\n\n"
        "Your receipt is attached to this email as a PDF.\n\n"
        f"With gratitude,\n{receipts.FOUNDATION_NAME}\n"
    )
    message.add_alternative(
        f"""<div style="font-family:Arial,sans-serif;color:#1e293b;max-width:560px">
  <h2 style="color:#a3074a;margin-bottom:4px">Thank you, {_html(donation['donor_name'])}!</h2>
  <p>We have received your donation of <strong>{amount}</strong> to {_html(settings.APP_NAME)},
  run by {receipts.FOUNDATION_NAME}. It will go towards meals for students from drought-hit
  farming families who are studying in Pune and PCMC.</p>
  <table style="border-collapse:collapse;margin:16px 0">
    <tr><td style="padding:4px 16px 4px 0;color:#64748b">Receipt number</td><td><strong>{receipt_no}</strong></td></tr>
    <tr><td style="padding:4px 16px 4px 0;color:#64748b">Payment ID</td><td>{_html(donation.get('reference') or '-')}</td></tr>
  </table>
  <p>Your receipt is attached to this email as a PDF.</p>
  <p style="margin-top:24px">With gratitude,<br>{receipts.FOUNDATION_NAME}</p>
</div>""",
        subtype="html",
    )
    message.add_attachment(
        receipts.render_receipt(donation),
        maintype="application",
        subtype="pdf",
        filename=f"receipt-{receipt_no.replace('/', '-')}.pdf",
    )
    return message


def _html(text: str) -> str:
    return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


async def email_receipt(donation: Dict[str, Any]) -> Optional[str]:
    """Emails the receipt PDF to the donor and records the outcome. Returns an error, if any."""
    if not donation.get("email"):
        return "no email address"
    if not is_configured():
        logger.warning("SMTP is not configured: receipt %s was not emailed.", donation["receipt_no"])
        outcome: Dict[str, Any] = {"receipt_email.status": "not_configured"}
        error: Optional[str] = "not configured"
    else:
        try:
            await asyncio.to_thread(_send, _receipt_message(donation))
            outcome, error = {"receipt_email.status": "sent", "receipt_email.sent_at": utc_now()}, None
            logger.info("Emailed receipt %s", donation["receipt_no"])
        except Exception as exc:  # network, login or recipient errors
            logger.error("Could not email receipt %s: %s", donation["receipt_no"], exc)
            outcome, error = {"receipt_email.status": "failed", "receipt_email.error": str(exc)[:300]}, str(exc)
    await get_database()[Collections.DONATIONS].update_one({"_id": donation["_id"]}, {"$set": outcome})
    return error


def email_receipt_in_background(donation: Dict[str, Any]) -> None:
    task = asyncio.create_task(email_receipt(donation))
    _pending.add(task)
    task.add_done_callback(_pending.discard)
