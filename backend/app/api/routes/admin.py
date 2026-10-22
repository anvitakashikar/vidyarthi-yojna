import re
from datetime import date
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import Response
from pymongo.errors import DuplicateKeyError

from app.api.deps import require_roles
from app.api.routes.students import document_response
from app.core import eligibility as eligibility_rules
from app.core.errors import AppError
from app.db.mongodb import get_database
from app.models.base import utc_now
from app.models.user import Role
from app.repositories.donors import DonorRepository
from app.repositories.students import DocumentRepository, StudentRepository
from app.repositories.users import UserRepository, duplicate_key_code
from app.schemas.auth import AdminCreateUserRequest, UserPublic
from app.schemas.donor import AdminDonorResponse, DonorListPage
from app.schemas.student import AdminStudentResponse, StudentDirectoryPage, VerificationRequest
from app.services import requirements, student_directory

router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(require_roles(Role.ADMIN))])

MAX_EXPORT_ROWS = 50_000


@router.get("/stats")
async def stats() -> Dict[str, int]:
    """Number of users per role."""
    collection = UserRepository(get_database()).collection
    counts = {role.value: 0 for role in Role}
    async for row in await collection.aggregate([{"$group": {"_id": "$role", "count": {"$sum": 1}}}]):
        if row["_id"] in counts:
            counts[row["_id"]] = row["count"]
    return counts


@router.get("/users", response_model=List[UserPublic])
async def list_users(
    role: Optional[Role] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    filters = {"role": role.value} if role else {}
    users = await UserRepository(get_database()).list(filters, skip=skip, limit=limit)
    return [UserPublic.from_doc(u) for u in users]


@router.post("/users", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
async def create_user(body: AdminCreateUserRequest):
    """Create an account of any role — the only way to add more admins."""
    repo = UserRepository(get_database())
    conflict = await repo.find_conflict(body.email, body.phone)
    if conflict:
        raise AppError(conflict)
    try:
        user = await repo.create_user(
            name=body.name, email=body.email, phone=body.phone, password=body.password, role=body.role
        )
    except DuplicateKeyError as exc:
        raise AppError(duplicate_key_code(exc))
    return UserPublic.from_doc(user)


# ------------------------------------------------------------------ student directory


def _directory_filter(
    search: Optional[str] = None,
    taluka: Optional[str] = None,
    district: Optional[str] = None,
    status: Optional[Literal["pending", "verified", "rejected"]] = None,
    complete: Optional[bool] = None,
    eligibility: Optional[Literal["eligible", "not_eligible", "pending"]] = None,
) -> dict:
    return student_directory.build_filter(search, taluka, district, status, complete, eligibility)


@router.get("/students", response_model=StudentDirectoryPage)
async def list_students(
    filters: dict = Depends(_directory_filter),
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=200),
):
    collection = StudentRepository(get_database()).collection
    total = await collection.count_documents(filters)
    docs = await collection.find(filters).sort("created_at", -1).skip(skip).limit(limit).to_list(length=limit)
    return StudentDirectoryPage(total=total, items=[student_directory.to_row(d) for d in docs])


@router.get("/students/facets")
async def student_facets() -> Dict[str, List[str]]:
    """Distinct talukas and districts, for the directory filters."""
    collection = StudentRepository(get_database()).collection
    talukas = await collection.distinct("aadhaar.taluka")
    districts = await collection.distinct("aadhaar.district")
    return {"talukas": sorted(t for t in talukas if t), "districts": sorted(d for d in districts if d)}


@router.get("/students/export")
async def export_students(filters: dict = Depends(_directory_filter), format: Literal["xlsx", "csv"] = "xlsx"):
    """Download the (filtered) student directory as Excel or CSV."""
    collection = StudentRepository(get_database()).collection
    docs = await collection.find(filters).sort("name", 1).limit(MAX_EXPORT_ROWS).to_list(length=MAX_EXPORT_ROWS)
    rows = [student_directory.to_row(d) for d in docs]
    stamp = date.today().isoformat()
    if format == "csv":
        content, media = student_directory.export_csv(rows), "text/csv; charset=utf-8"
    else:
        content, media = student_directory.export_xlsx(rows), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    return Response(
        content,
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="vidyarthi-yojna-students-{stamp}.{format}"', "Cache-Control": "no-store"},
    )


@router.get("/students/{user_id}", response_model=AdminStudentResponse)
async def get_student(user_id: str):
    doc = await StudentRepository(get_database()).get_by_user(user_id)
    if not doc:
        raise AppError("error.not_found")
    return AdminStudentResponse.from_doc(doc)


@router.patch("/students/{user_id}/verification", response_model=AdminStudentResponse)
async def set_verification(
    user_id: str,
    body: VerificationRequest,
    admin: Dict[str, Any] = Depends(require_roles(Role.ADMIN)),
):
    """Mark a student verified, or ask them to correct their details (with reasons).

    The student sees the decision on their dashboard. If they later change any
    section, the status goes back to pending for a fresh review.
    """
    collection = StudentRepository(get_database()).collection
    doc = await collection.find_one({"user_id": user_id})
    if not doc:
        raise AppError("error.not_found")
    note = body.note.strip()
    if body.status == "rejected" and not body.reasons and not note:
        raise AppError("admin.rejection_reason_required")
    if body.status == "verified" and not doc.get("onboarding_complete"):
        raise AppError("admin.profile_incomplete")

    decision = {
        "status": body.status,
        "reasons": list(dict.fromkeys(body.reasons)) if body.status == "rejected" else [],
        "note": note,
        "by_id": str(admin["_id"]),
        "by_name": admin["name"],
        "at": utc_now(),
    }
    await collection.update_one(
        {"_id": doc["_id"]},
        {"$set": {"verification_status": body.status, "verification": decision}, "$push": {"verification_history": decision}},
    )
    return AdminStudentResponse.from_doc(await collection.find_one({"_id": doc["_id"]}))


# ------------------------------------------------------------------ requirements of accepted students


def _requirements_filter(search: Optional[str] = None, taluka: Optional[str] = None, district: Optional[str] = None) -> dict:
    return requirements.accepted_filter(search, taluka, district)


@router.get("/requirements")
async def list_requirements(
    filters: dict = Depends(_requirements_filter),
    skip: int = Query(0, ge=0),
    limit: int = Query(25, ge=1, le=200),
):
    """Accepted students (eligible + verified) and their monthly mess + abhyasika requirement."""
    collection = StudentRepository(get_database()).collection
    totals = await requirements.summarize(collection, filters)
    docs = await collection.find(filters).sort("name", 1).skip(skip).limit(limit).to_list(length=limit)
    items = [requirements.to_requirement_row(student_directory.to_row(d), d) for d in docs]
    return {**totals, "total": totals["summary"]["students"], "items": items}


@router.get("/requirements/export")
async def export_requirements(filters: dict = Depends(_requirements_filter), format: Literal["xlsx", "csv"] = "xlsx"):
    collection = StudentRepository(get_database()).collection
    totals = await requirements.summarize(collection, filters)
    docs = await collection.find(filters).sort([("aadhaar.district", 1), ("name", 1)]).limit(MAX_EXPORT_ROWS).to_list(length=MAX_EXPORT_ROWS)
    rows = [requirements.to_requirement_row(student_directory.to_row(d), d) for d in docs]
    s = totals["summary"]
    totals_row = {
        "name": f"TOTAL ({s['students']} students)",
        "mess_monthly_bill": s["mess"],
        "abhyasika_monthly_fee": s["abhyasika"],
        "monthly_total": s["total"],
    }
    stamp = date.today().isoformat()
    if format == "csv":
        content, media = student_directory.export_csv(rows, requirements.COLUMNS, totals_row), "text/csv; charset=utf-8"
    else:
        content = student_directory.export_xlsx(
            rows,
            requirements.COLUMNS,
            title="Requirements",
            totals=totals_row,
            extra_sheets=[("By district", totals["by_district"], requirements.DISTRICT_COLUMNS)],
        )
        media = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    return Response(
        content,
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="vidyarthi-yojna-requirements-{stamp}.{format}"', "Cache-Control": "no-store"},
    )


# ------------------------------------------------------------------ donors

DONOR_COLUMNS = [
    ("name", "Name"),
    ("phone", "Mobile"),
    ("email", "Email"),
    ("pan", "PAN"),
    ("pan_type", "PAN holder type"),
    ("name_on_pan", "Name on PAN"),
    ("account_holder", "Account holder"),
    ("account", "Account no."),
    ("ifsc", "IFSC"),
    ("bank_name", "Bank"),
    ("branch_name", "Branch"),
    ("complete", "Details complete"),
    ("registered_on", "Registered on"),
]
_PAN_TYPES = {"P": "Individual", "B": "Body of individuals", "C": "Company", "H": "Hindu Undivided Family", "T": "Trust"}


def _donor_filter(search: Optional[str] = None, complete: Optional[bool] = None) -> dict:
    query: dict = {}
    if search and search.strip():
        pattern = {"$regex": re.escape(search.strip()), "$options": "i"}
        query["$or"] = [{"name": pattern}, {"phone": pattern}, {"email": pattern}]
    if complete is not None:
        query["onboarding_complete"] = complete
    return query


async def _donor_docs(filters: dict, skip: int = 0, limit: int = MAX_EXPORT_ROWS):
    """Donor records, including donors who registered but have not added details yet."""
    db = get_database()
    users = await db["users"].find({"role": Role.DONOR.value, **{k: v for k, v in filters.items() if k != "onboarding_complete"}}).sort("created_at", -1).to_list(length=MAX_EXPORT_ROWS)
    by_user = {d["user_id"]: d async for d in DonorRepository(db).collection.find({"user_id": {"$in": [str(u["_id"]) for u in users]}})}
    docs = []
    for u in users:
        doc = by_user.get(str(u["_id"])) or {"user_id": str(u["_id"]), "onboarding_complete": False}
        doc.update(name=u["name"], phone=u.get("phone"), email=u.get("email"), created_at=u.get("created_at"))
        if "onboarding_complete" not in filters or bool(doc.get("onboarding_complete")) == filters["onboarding_complete"]:
            docs.append(doc)
    return len(docs), docs[skip : skip + limit]


@router.get("/donors", response_model=DonorListPage)
async def list_donors(filters: dict = Depends(_donor_filter), skip: int = Query(0, ge=0), limit: int = Query(25, ge=1, le=200)):
    total, docs = await _donor_docs(filters, skip, limit)
    return DonorListPage(total=total, items=[AdminDonorResponse.from_doc(d) for d in docs])


@router.get("/donors/export")
async def export_donors(filters: dict = Depends(_donor_filter), format: Literal["xlsx", "csv"] = "xlsx"):
    _, docs = await _donor_docs(filters)
    rows = []
    for d in docs:
        p = AdminDonorResponse.from_doc(d)
        created = d.get("created_at")
        rows.append({
            "name": p.name, "phone": p.phone or "", "email": p.email or "",
            "pan": p.pan.pan if p.pan else "", "pan_type": _PAN_TYPES.get(p.pan.holder_type, "") if p.pan else "",
            "name_on_pan": p.pan.name_on_pan if p.pan else "",
            "account_holder": p.bank.account_holder_name if p.bank else "", "account": p.bank.account_number if p.bank else "",
            "ifsc": p.bank.ifsc if p.bank else "", "bank_name": p.bank.bank_name if p.bank else "", "branch_name": p.bank.branch_name if p.bank else "",
            "complete": "Yes" if p.onboarding_complete else "No",
            "registered_on": created.date().isoformat() if created else "",
        })
    stamp = date.today().isoformat()
    if format == "csv":
        content, media = student_directory.export_csv(rows, DONOR_COLUMNS), "text/csv; charset=utf-8"
    else:
        content = student_directory.export_xlsx(rows, DONOR_COLUMNS, title="Donors")
        media = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    return Response(content, media_type=media,
                    headers={"Content-Disposition": f'attachment; filename="vidyarthi-yojna-donors-{stamp}.{format}"', "Cache-Control": "no-store"})


@router.get("/eligibility/rules")
async def eligibility_rules_summary():
    """The scheme's eligibility rules: age range and eligible talukas by division / district."""
    return eligibility_rules.rules_summary()


@router.get("/eligibility/counts")
async def eligibility_counts() -> Dict[str, int]:
    collection = StudentRepository(get_database()).collection
    counts = {"eligible": 0, "not_eligible": 0, "pending": 0}
    async for row in await collection.aggregate([{"$group": {"_id": {"$ifNull": ["$eligibility.status", "pending"]}, "n": {"$sum": 1}}}]):
        counts[row["_id"]] = row["n"]
    return counts


@router.get("/documents/{document_id}")
async def view_document(document_id: str):
    """Admins can view any uploaded document, e.g. to verify a student."""
    return await document_response(await DocumentRepository(get_database()).get(document_id))
