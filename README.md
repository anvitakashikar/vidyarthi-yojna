# Vidyarthi Yojna | विद्यार्थी योजना

Bilingual (English / मराठी) student schemes platform.

**Stack:** FastAPI · React (Vite) · Tailwind CSS v4 · MongoDB

## Project layout

```
Vidyarthi yojna/
├── docker-compose.yml          # Local MongoDB (optional if Mongo is installed)
├── backend/
│   ├── requirements.txt
│   ├── .env.example
│   └── app/
│       ├── main.py             # FastAPI app, CORS, lifespan, error handlers
│       ├── core/
│       │   ├── config.py       # Settings from .env
│       │   ├── errors.py       # AppError + error codes (English messages)
│       │   ├── crypto.py       # Fernet encryption + keyed hashes for sensitive data
│       │   ├── validators.py   # mobile, Aadhaar (Verhoeff), IFSC, account no., age
│       │   └── security.py     # bcrypt hashing, JWT tokens
│       ├── db/
│       │   ├── mongodb.py      # Async PyMongo client: connect / close / get_database
│       │   ├── collections.py  # Collection name constants (placeholders)
│       │   └── indexes.py      # Index creation on startup (placeholders)
│       ├── models/
│       │   ├── base.py         # MongoBaseModel, PyObjectId, LocalizedText {en, mr}
│       │   ├── user.py         # Role enum (student/donor/admin), User document
│       │   ├── student.py      # Student record (sections) + Document metadata
│       │   └── placeholders.py # Scheme, Application (to be finalised)
│       ├── repositories/
│       │   ├── base.py         # Generic async CRUD for a collection
│       │   ├── users.py        # User lookups + first-admin seeding
│       │   └── students.py     # Student sections, uploaded documents
│       ├── schemas/            # fields.py, auth.py, student.py, common.py
│       ├── services/
│       │   ├── aadhaar_reader.py     # QR decode → AI fallback: DOB, taluka, address
│       │   ├── storage.py            # encrypted file storage
│       │   └── student_directory.py  # directory rows + Excel / CSV export
│       └── api/
│           ├── router.py       # Mounts feature routers under /api/v1
│           ├── deps.py         # get_current_user, require_roles(...)
│           └── routes/         # health.py, auth.py, students.py, admin.py
└── frontend/
    ├── package.json
    ├── vite.config.js          # Tailwind plugin + /api proxy to :8000
    ├── index.html              # Noto Sans + Noto Sans Devanagari fonts
    └── src/
        ├── main.jsx, App.jsx, index.css
        ├── i18n/
        │   ├── index.js        # i18next setup, persists choice, syncs <html lang>
        │   └── locales/        # en.json, mr.json — every UI string lives here
        ├── hooks/useLocalized.js   # Picks en/mr from bilingual DB fields
        ├── services/api.js     # Axios client; attaches the JWT
        ├── context/AuthContext.jsx # user session, login/register/logout
        ├── utils/apiError.js   # backend error code → translated message
        ├── components/
        │   ├── LanguageSwitcher.jsx, ProtectedRoute.jsx
        │   ├── auth/, dashboard/, student/, ui/
        │   └── layout/         # Layout, Navbar, Footer
        └── pages/
            ├── Home, About, Contact, NotFound
            ├── auth/           # Login, Register (per role)
            ├── student/        # StudentOnboarding (sections 1–3)
            └── dashboard/      # Student, Donor, Admin, StudentDirectory
```

## Getting started

### 1. MongoDB
Use an existing local MongoDB on `localhost:27017`, or start one with Docker:
```bash
docker compose up -d
```

### 2. Backend (Python 3.10+ required)
```bash
cd backend
py -3.11 -m venv .venv          # Windows; use python3.11 on macOS/Linux
.venv\Scripts\activate          # Windows  (source .venv/bin/activate on macOS/Linux)
pip install -r requirements.txt
copy .env.example .env          # cp on macOS/Linux
uvicorn app.main:app --reload
```
API docs: http://localhost:8000/docs · Health: http://localhost:8000/api/v1/health

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173 and use the **English / मराठी** toggle in the header.

## Demo accounts

Create ready-to-use demo logins (safe to re-run):

```bash
cd backend
.venv\Scripts\python -m scripts.seed_demo
```

| Role | Login page | Phone | Password | State |
|---|---|---|---|---|
| Student | `/login/student` | `9000000001` | `Student@2026` | All sections done; eligible (age 21, Pusad); verified; needs ₹3,300/month |
| Donor | `/login/donor` | `9000000002` | `Donor@2026` | Bank + PAN done; 2 donations (₹5,000 UPI, ₹2,500 net banking) with receipts |
| Admin | `/login/admin` | `9000000003` | `ADMIN_PASSWORD` from `.env` | — |

All demo documents (Aadhaar, PAN, bank statement) are dummy images clearly marked "DEMO / SAMPLE ONLY".

## Roles & login

| Role    | Login page        | Registration                         | Dashboard  |
|---------|-------------------|--------------------------------------|------------|
| Student | `/login/student`  | Self-register at `/register/student` | `/student` |
| Donor   | `/login/donor`    | Self-register at `/register/donor`   | `/donor`   |
| Admin   | `/login/admin`    | Created by an admin only             | `/admin`   |

- Auth uses JWT bearer tokens (`POST /api/v1/auth/login`, `/auth/register`, `GET /auth/me`).
- Passwords are hashed with bcrypt. Emails are stored lower-case and are unique across all roles.
- Each user can only log in through their own role's portal.
- **First admin:** set `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `backend/.env`. The account is created on startup if no admin exists yet. More admins can be added from the admin dashboard (`POST /api/v1/admin/users`).
- Protect a backend route with `Depends(require_roles(Role.ADMIN))` from `app/api/deps.py`. On the frontend, wrap routes in `<ProtectedRoute roles={[...]} />`.

### Student sign-up (3 sections)

| Section | What the student provides | API |
|---|---|---|
| 1. Basic details | Name, mobile (login), email (optional), gender, parent/guardian, college, course, year, password | `POST /auth/register` with `student_details`; edit via `PUT /students/me/personal` |
| 2. Aadhaar & bank | Aadhaar card upload → **DOB (age) and taluka read automatically**, student confirms; bank details + bank statement upload | `POST /students/me/aadhaar/read` → `PUT /students/me/aadhaar`; `PUT /students/me/bank` |
| 3. Mess & abhyasika | Monthly mess bill and abhyasika (study place) fee, name, address, optional receipts | `PUT /students/me/expenses` |

Students must complete all three sections before the dashboard opens (`/student/onboarding`). Every update resets `verification_status` to `pending`.

**How the Aadhaar card is read** ([aadhaar_reader.py](backend/app/services/aadhaar_reader.py))
1. The QR code on the card is decoded **locally**. The Secure QR (cards issued since 2019) contains the DOB and sub-district (= taluka) as separate fields, plus the last 4 Aadhaar digits, which are used to reject a mistyped number. Older cards have an XML QR.
2. Password-protected e-Aadhaar PDFs are opened automatically (first 4 letters of the name + birth year). Otherwise the student is asked for the password.
3. Only if no QR can be read **and** `ANTHROPIC_API_KEY` is set, the card image is sent to Claude (`AI_MODEL`, default `claude-opus-5-5`) to read the fields. Set `AADHAAR_AI_FALLBACK=false` to never send cards to AI.
4. The student always reviews the values. Any field they change is recorded (`edited_fields`) so admins can check it.

**Scheme eligibility** ([eligibility.py](backend/app/core/eligibility.py)): a student is eligible **if and only if** they are **18–24 years old** and live in one of the **141 listed talukas** (Amravati, Nagpur/Vidarbha, Marathwada and Palghar). The check runs on the backend when the Aadhaar details are saved, using the age on that date.
- Talukas are matched together with their district, because some names repeat (Malegaon is listed for Washim, not Nashik). Common spelling variants are accepted (Osmanabad→Dharashiv, Umarga→Omerga, Vasmat→Basmath, Deglur→Degloor, …).
- **Students** see only "eligible / not eligible" on their dashboard. **Admins** see the reasons and counts, can filter the directory by eligibility, and get it in the export.
- To change the rules, edit `ELIGIBLE_TALUKAS` / `MIN_AGE` / `MAX_AGE` and bump `RULES_VERSION`. All stored results are re-checked on the next server start.

**Document verification**: in the directory, an admin opens a student and either **verifies** them or asks for **corrections**. A correction request uses preset reasons (shown to the student in their language) plus an optional note. `PATCH /admin/students/{id}/verification` records the decision with a full history.
- The student sees the outcome on their dashboard: under review, verified, or needs correction (with the reasons, the note, and a button that opens the right section).
- When the student changes any section afterwards, the status goes back to *pending* automatically, and the admin sees "Updated by student".

**Requirements** (`/admin/requirements`): every **accepted** student (eligible **and** verified) with their monthly mess bill + abhyasika fee.
- Shows the total and average requirement, a per-district breakdown, and bank details (masked) for payment.
- Filter by search, district or taluka.
- Export to Excel (with a totals row and a "By district" sheet) or CSV.
- API: `GET /admin/requirements`, `GET /admin/requirements/export?format=xlsx|csv`.

**Donor sign-up** (2 sections): 1. account details (`/register/donor`) → 2. **bank details + PAN card** (`/donor/onboarding`, required before the donor dashboard opens).
- PAN must be 5 letters, 4 digits, 1 letter, and its **4th letter must be P (individual), B (body of individuals), C (company), H (HUF) or T (trust)**. It is checked in the browser and in `normalize_pan()` on the backend.
- Each PAN can belong to one account only. The PAN and account number are encrypted; donors see them masked, admins in full.
- Admins see all donors under **Admin → Donors** (`GET /admin/donors`, export `GET /admin/donors/export?format=xlsx|csv`).

**Home page & donations**
- Donors (`/donor`) and admins (`/admin`) land on a home page with:
  - what the scheme does and an appeal to donate,
  - live cards: students supported, monthly need (mess + abhyasika), amount raised, amount paid out.
  - API: `GET /impact` (aggregates only, no student data).
- **Donate** (`/donor/donate`): choose an amount, then UPI / net banking / card (for cards only the last 4 digits are kept), plus an optional transaction reference.
  - The donation is *recorded* (no gateway yet) and gets a receipt number like `VY/2026-27/000001` (Indian financial year).
  - It is added to the fund automatically, so it shows in "Money left".
  - The PDF receipt can be downloaded by the donor (from *My donations*) and by admins (from Payments → Funds received).
- Set `DONATION_UPI_ID` / `DONATION_ACCOUNT_*` / `DONATION_IFSC` / `DONATION_BANK_NAME` in `.env` to show donors where to pay.
- API: `POST /donations`, `GET /donations/me`, `GET /donations/{id}/receipt`, `GET /donations/payee`.

**Donations (admin)** (`/admin/donations`): every donation with its payment details — UPI ID, bank, or card type + last 4 digits — plus the transaction reference, donor PAN and contact, and the receipt.
- Totals per payment method.
- Filter by search (donor, mobile, receipt no., reference), method or month.
- Excel/CSV export.
- Each donor's donations are also listed when you open them in the Donors tab.
- API: `GET /admin/donations`, `GET /admin/donations/export`.

**Payments** (`/admin/payments`): **money left** (funds received − paid out), the amount **to pay** for a month, and the list of accepted students still to be paid, each with a **Pay** button.
- *Pay* shows the student's bank details (with copy buttons). The admin makes the transfer, enters the UTR / reference, and marks it as paid.
- The amount is the student's current monthly requirement, computed on the server.
- A student can be paid only once per month, and a payment is blocked if the fund does not have enough money.
- Money received is recorded with **Add funds**.
- API: `GET /admin/payments/summary|due`, `GET|POST /admin/payments`, `GET|POST /admin/funds`.

**Student directory** (`/admin/students`): search, filter by taluka / district / completion, view each student's details and documents, and **export to Excel (.xlsx) or CSV** (`GET /admin/students/export?format=xlsx|csv`). The export opens in Excel or Google Sheets. Aadhaar and account numbers are always masked in the directory and exports.

**Sensitive data handling**
- Aadhaar number, address and account number are encrypted with `DATA_ENCRYPTION_KEY` (Fernet). APIs only return masked numbers (`XXXX XXXX 1234`).
- Each Aadhaar number can be linked to only one account. This is enforced through a keyed hash, so no searchable plaintext is stored.
- Uploads must be JPG, PNG or PDF (checked by file content), up to 5 MB. They are stored encrypted in `backend/uploads/`. Students can view only their own files; admins can view all.
- **Back up `DATA_ENCRYPTION_KEY`.** Without it, stored documents and numbers cannot be decrypted.

## Brand colours

Gradient from navy **#023b77** to teal **#039583**, defined in [index.css](frontend/src/index.css):
`brand-*` (navy), `accent-*` (teal), and the utilities `bg-brand-gradient` / `text-brand-gradient`.

## Bilingual conventions

- **Backend is English-only.** Error responses look like `{ success, code, message, data }`. `code` (e.g. `auth.invalid_credentials`) is stable. Add new codes in `backend/app/core/errors.py`.
- **UI text:** never hard-code strings. Add a key to both `frontend/src/i18n/locales/en.json` and `mr.json`, then use `t('section.key')`.
- **Backend errors in the UI:** add a matching `errors.<code>` key to both locale files. `apiErrorMessage(err, t)` translates it, falling back to the English message.
- **Data in MongoDB:** store user-facing content (e.g. scheme titles) as `LocalizedText` — `{ "en": "...", "mr": "..." }` — and render it with `useLocalized()` on the frontend.
