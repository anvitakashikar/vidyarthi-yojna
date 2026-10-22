"""Creates ready-to-use demo accounts in the configured database.

    Demo student  9000000001 / Student@2026  — all 3 sections done, eligible, verified
    Demo donor    9000000002 / Donor@2026    — bank + PAN done, 2 donations with receipts
    Admin         9000000003 / ADMIN_PASSWORD from .env (phone added if missing)

Everything goes through the real API, so the data is exactly what the app would
create. Safe to re-run: existing demo accounts are logged into and refreshed.

Run from backend/:   .venv\\Scripts\\python -m scripts.seed_demo
"""
import io
import sys

from fastapi.testclient import TestClient
from fpdf import FPDF
from PIL import Image, ImageDraw
from pymongo import MongoClient

from app.core.config import settings
from app.core.validators import _D, _P
from app.main import app

STUDENT = {"name": "Demo Student", "phone": "9000000001", "password": "Student@2026"}
DONOR = {"name": "Demo Donor", "phone": "9000000002", "email": "demo.donor@vidyarthiyojna.in", "password": "Donor@2026"}
ADMIN_PHONE = "9000000003"
API = "/api/v1"


def verhoeff_aadhaar(prefix11: str) -> str:
    """Appends a valid Verhoeff check digit, so the demo number passes validation."""
    inverse = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9]
    check = 0
    for i, ch in enumerate(reversed(prefix11)):
        check = _D[check][_P[(i + 1) % 8][int(ch)]]
    return prefix11 + str(inverse[check])


def demo_card_png(title: str) -> bytes:
    img = Image.new("RGB", (900, 560), "white")
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, 900, 70], fill=(2, 59, 119))
    draw.text((30, 25), f"{title} - DEMO / SAMPLE ONLY", fill="white")
    draw.text((30, 120), "This is a dummy document created for the Vidyarthi Yojna demo.", fill="black")
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return buf.getvalue()


def demo_pdf(title: str) -> bytes:
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, f"{title} - DEMO / SAMPLE ONLY")
    return bytes(pdf.output())


def ok(r, what):
    if r.status_code >= 400:
        sys.exit(f"Failed to {what}: {r.status_code} {r.text[:300]}")
    return r.json()


def account(c, payload, role):
    """Registers the account, or logs in if it already exists."""
    r = c.post(f"{API}/auth/register", json={**payload, "role": role})
    if r.status_code == 409:
        r = c.post(f"{API}/auth/login", json={"identifier": payload["phone"], "password": payload["password"], "role": role})
        if r.status_code != 200:
            sys.exit(f"{role} {payload['phone']} already exists with a different password — delete it or change the demo password.")
        print(f"  {role}: existing account, refreshing its details")
    else:
        ok(r, f"register {role}")
        print(f"  {role}: created")
    data = r.json()
    return {"Authorization": f"Bearer {data['access_token']}"}, data["user"]["id"]


def main():
    print(f"Seeding demo data into database '{settings.MONGODB_DB_NAME}' ...")
    with TestClient(app) as c:
        # --- admin (created on startup from .env); give it a phone login
        db = MongoClient(settings.MONGODB_URI)[settings.MONGODB_DB_NAME]
        if not db.users.find_one({"phone": ADMIN_PHONE}):
            db.users.update_one({"role": "admin", "email": settings.ADMIN_EMAIL.lower()}, {"$set": {"phone": ADMIN_PHONE}})
        r = c.post(f"{API}/auth/login", json={"identifier": settings.ADMIN_EMAIL, "password": settings.ADMIN_PASSWORD, "role": "admin"})
        admin = {"Authorization": f"Bearer {ok(r, 'log in as admin')['access_token']}"}

        # --- student: 3 sections, then verified by the admin
        student, student_id = account(
            c,
            {**STUDENT, "student_details": {"gender": "female", "guardian_name": "Ramesh Patil", "guardian_phone": "9000000011",
                                             "college_name": "Amolakchand Mahavidyalaya, Yavatmal", "course": "B.Sc.", "year_of_study": 2}},
            "student",
        )
        card = ok(c.post(f"{API}/students/me/aadhaar/read", headers=student, files={"aadhaar_file": ("demo-aadhaar.png", demo_card_png("AADHAAR CARD"), "image/png")}), "upload Aadhaar")
        ok(c.put(f"{API}/students/me/aadhaar", headers=student, json={
            "document_id": card["document_id"], "aadhaar_number": verhoeff_aadhaar("29876543210"), "dob": "2005-06-15", "gender": "female",
            "address": "Ward No. 4, Near Bus Stand, Pusad", "taluka": "Pusad", "district": "Yavatmal", "state": "Maharashtra", "pincode": "445204",
        }), "save Aadhaar details")
        ok(c.put(f"{API}/students/me/bank", headers=student,
                 data={"account_holder_name": STUDENT["name"], "account_number": "50100123456789", "ifsc": "SBIN0001234", "bank_name": "State Bank of India", "branch_name": "Pusad"},
                 files={"statement_file": ("demo-statement.pdf", demo_pdf("BANK STATEMENT"), "application/pdf")}), "save bank details")
        ok(c.put(f"{API}/students/me/expenses", headers=student, data={
            "uses_mess": "true", "mess_name": "Annapurna Mess", "mess_address": "Shivaji Chowk, Yavatmal", "mess_monthly_bill": "2500",
            "uses_abhyasika": "true", "abhyasika_name": "Dnyandeep Abhyasika", "abhyasika_address": "Main Road, Yavatmal", "abhyasika_monthly_fee": "800",
        }), "save mess & abhyasika")
        ok(c.patch(f"{API}/admin/students/{student_id}/verification", headers=admin, json={"status": "verified"}), "verify student")
        profile = ok(c.get(f"{API}/students/me/profile", headers=student), "read student profile")
        print(f"  student: eligibility={profile['eligibility_status']}, verification={profile['verification_status']}")

        # --- donor: bank + PAN, and two donations (only the first time)
        donor, _ = account(c, DONOR, "donor")
        ok(c.put(f"{API}/donors/me/bank", headers=donor, data={
            "account_holder_name": DONOR["name"], "account_number": "001234567890123", "ifsc": "HDFC0000123", "bank_name": "HDFC Bank", "branch_name": "Nagpur"}), "save donor bank")
        ok(c.put(f"{API}/donors/me/pan", headers=donor, data={"pan_number": "DEMPD1234X", "name_on_pan": DONOR["name"]},
                 files={"pan_file": ("demo-pan.png", demo_card_png("PAN CARD"), "image/png")}), "save donor PAN")
        if not ok(c.get(f"{API}/donations/me", headers=donor), "list donations")["items"]:
            ok(c.post(f"{API}/donations", headers=donor, json={"amount": 5000, "method": "upi", "upi_id": "demo.donor@okhdfcbank", "reference": "DEMO-UPI-0001"}), "donate via UPI")
            ok(c.post(f"{API}/donations", headers=donor, json={"amount": 2500, "method": "netbanking", "bank_name": "HDFC Bank", "reference": "DEMO-UTR-0002"}), "donate via net banking")
            print("  donor: 2 demo donations recorded")

    print("\nDemo logins (http://localhost:5173):")
    print(f"  Student  /login/student  {STUDENT['phone']}  {STUDENT['password']}")
    print(f"  Donor    /login/donor    {DONOR['phone']}  {DONOR['password']}")
    print(f"  Admin    /login/admin    {ADMIN_PHONE}  (ADMIN_PASSWORD from .env)")


if __name__ == "__main__":
    main()
