"""Application errors.

Every error response has the shape:
    {"success": false, "code": "auth.invalid_credentials", "message": "Incorrect email or password", "data": null}

`code` is stable and machine-readable — the frontend uses it to show the
message in the user's language. `message` is the English fallback.
"""
from typing import Any, Dict, Optional, Tuple

ERRORS: Dict[str, Tuple[int, str]] = {
    "error.not_found": (404, "The requested resource was not found"),
    "error.validation": (422, "Some of the submitted data is invalid"),
    "error.server": (500, "Something went wrong. Please try again later."),
    "auth.invalid_credentials": (401, "Incorrect mobile number / email or password"),
    "auth.email_exists": (409, "An account with this email already exists"),
    "auth.phone_exists": (409, "An account with this mobile number already exists"),
    "auth.login_closed": (403, "Login is not available for this account. Please contact the administrator."),
    "auth.inactive": (403, "This account has been deactivated. Please contact the administrator."),
    "auth.not_authenticated": (401, "Please log in to continue"),
    "auth.invalid_token": (401, "Your session has expired. Please log in again."),
    "auth.forbidden": (403, "You do not have permission to access this"),
    "otp.too_soon": (429, "Please wait {seconds} seconds before asking for a new code"),
    "otp.too_many": (429, "Too many codes were requested for this number. Please try again in an hour."),
    "otp.send_failed": (502, "The code could not be sent by SMS. Please check the number and try again."),
    "otp.invalid_code": (422, "The code is incorrect. Please check the SMS and try again."),
    "otp.expired": (422, "This code has expired. Please ask for a new code."),
    "otp.too_many_attempts": (429, "Too many wrong codes. Please ask for a new code."),
    "otp.not_verified": (422, "Please verify your mobile number with the code sent by SMS"),
    "student.invalid_aadhaar": (422, "Enter a valid 12-digit Aadhaar number"),
    "student.aadhaar_exists": (409, "This Aadhaar number is already registered with another account"),
    "student.aadhaar_file_required": (422, "Please upload your Aadhaar card"),
    "student.invalid_ifsc": (422, "Enter a valid 11-character IFSC code"),
    "student.invalid_account_number": (422, "Enter a valid bank account number (9 to 18 digits)"),
    "student.invalid_holder_name": (422, "Enter the account holder's name"),
    "student.document_not_found": (404, "Document not found"),
    "student.details_required": (422, "Please fill in your basic details"),
    "student.aadhaar_mismatch": (422, "The Aadhaar number does not match the uploaded Aadhaar card"),
    "student.invalid_dob": (422, "Enter a valid date of birth"),
    "student.taluka_required": (422, "Enter your taluka and district"),
    "student.statement_required": (422, "Please upload your bank statement"),
    "student.enrollment_proof_required": (422, "Please upload a proof of enrollment (ID card, marksheet or admit card)"),
    "student.invalid_proof_type": (422, "Choose a valid document type"),
    "student.mess_details_required": (422, "Enter your mess name and monthly bill"),
    "student.invalid_amount": (422, "Enter a valid amount in rupees"),
    "donor.invalid_pan": (422, "Enter a valid PAN. The 4th letter must be P, B, C, H or T."),
    "donor.pan_exists": (409, "This PAN is already registered with another account"),
    "donor.invalid_pan_name": (422, "Enter the name exactly as printed on the PAN card"),
    "payments.invalid_period": (422, "Choose a valid month that is not in the future"),
    "payments.not_accepted": (422, "This student is not accepted (eligible and verified)"),
    "payments.nothing_due": (422, "Nothing is due for this student"),
    "payments.already_paid": (409, "This student has already been paid for this month"),
    "payments.insufficient_funds": (422, "Not enough money left: Rs {balance} available, Rs {amount} needed"),
    "donation.invalid_upi": (422, "Enter a valid UPI ID, e.g. name@bank"),
    "donation.bank_required": (422, "Choose your bank"),
    "donation.invalid_card": (422, "Choose the card type and enter the last 4 digits of the card"),
    "donation.online_unavailable": (503, "Online payment is not available right now. Please use a bank transfer instead."),
    "donation.payment_failed": (422, "We could not confirm this payment. If money was deducted, please contact us with the payment ID."),
    "donation.no_email": (422, "This donation has no email address"),
    "donation.email_unavailable": (503, "Email is not set up yet. Add the SMTP settings in the server configuration."),
    "donation.email_failed": (502, "The receipt email could not be sent. Please try again later."),
    "donation.profile_incomplete": (422, "Please add your bank and PAN details before donating"),
    "admin.rejection_reason_required": (422, "Choose at least one reason or write a note for the student"),
    "admin.profile_incomplete": (422, "The student has not completed all sections yet"),
    "upload.too_large": (413, "File is too large. Maximum size is {max_mb} MB."),
    "upload.invalid_type": (415, "Only JPG, PNG or PDF files are allowed"),
}


class AppError(Exception):
    def __init__(self, code: str, data: Optional[Dict[str, Any]] = None):
        status_code, template = ERRORS[code]
        self.code = code
        self.status_code = status_code
        self.data = data
        self.message = template.format(**data) if data else template
        super().__init__(self.message)

    def to_dict(self) -> Dict[str, Any]:
        return {"success": False, "code": self.code, "message": self.message, "data": self.data}
