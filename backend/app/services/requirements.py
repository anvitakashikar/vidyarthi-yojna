"""Monthly requirement of accepted students.

A student is *accepted* when they are eligible for the scheme (age + taluka)
AND an admin has verified their documents. Their monthly requirement is the
mess bill plus the abhyasika fee they declared in section 3.
"""
from typing import Any, Dict, List, Optional

from pymongo.asynchronous.collection import AsyncCollection

from app.services.student_directory import build_filter

ACCEPTED = {"eligibility.status": "eligible", "verification_status": "verified"}

# (key, column header) for the requirements export
COLUMNS = [
    ("name", "Name"),
    ("phone", "Mobile"),
    ("taluka", "Taluka"),
    ("district", "District"),
    ("college_name", "College / institute"),
    ("course", "Course"),
    ("mess_name", "Mess"),
    ("mess_monthly_bill", "Mess bill / month (₹)"),
    ("abhyasika_name", "Abhyasika"),
    ("abhyasika_monthly_fee", "Abhyasika fee / month (₹)"),
    ("monthly_total", "Total requirement / month (₹)"),
    ("account_holder", "Account holder"),
    ("bank_name", "Bank"),
    ("branch_name", "Branch"),
    ("ifsc", "IFSC"),
    ("account", "Account no."),
]

DISTRICT_COLUMNS = [
    ("district", "District"),
    ("students", "Accepted students"),
    ("mess", "Mess / month (₹)"),
    ("abhyasika", "Abhyasika / month (₹)"),
    ("total", "Total / month (₹)"),
]


def accepted_filter(search: Optional[str] = None, taluka: Optional[str] = None, district: Optional[str] = None) -> Dict[str, Any]:
    return {**build_filter(search, taluka, district), **ACCEPTED}


def _amount(uses: str, amount: str) -> Dict[str, Any]:
    """Mongo expression: the amount if the student uses the service, else 0."""
    return {"$cond": [{"$eq": [f"$expenses.{uses}", True]}, {"$ifNull": [f"$expenses.{amount}", 0]}, 0]}


async def summarize(collection: AsyncCollection, query: Dict[str, Any]) -> Dict[str, Any]:
    """Totals overall and per district for the accepted students matching `query`."""
    pipeline = [
        {"$match": query},
        {
            "$project": {
                "district": {"$ifNull": ["$aadhaar.district", "—"]},
                "mess": _amount("mess.uses_mess", "mess.monthly_bill"),
                "abhyasika": _amount("abhyasika.uses_abhyasika", "abhyasika.monthly_fee"),
                "uses_mess": {"$cond": [{"$eq": ["$expenses.mess.uses_mess", True]}, 1, 0]},
                "uses_abhyasika": {"$cond": [{"$eq": ["$expenses.abhyasika.uses_abhyasika", True]}, 1, 0]},
            }
        },
        {
            "$group": {
                "_id": "$district",
                "students": {"$sum": 1},
                "mess": {"$sum": "$mess"},
                "abhyasika": {"$sum": "$abhyasika"},
                "mess_users": {"$sum": "$uses_mess"},
                "abhyasika_users": {"$sum": "$uses_abhyasika"},
            }
        },
        {"$sort": {"_id": 1}},
    ]
    by_district: List[Dict[str, Any]] = []
    async for row in await collection.aggregate(pipeline):
        by_district.append(
            {
                "district": row["_id"],
                "students": row["students"],
                "mess": row["mess"],
                "abhyasika": row["abhyasika"],
                "total": row["mess"] + row["abhyasika"],
                "mess_users": row["mess_users"],
                "abhyasika_users": row["abhyasika_users"],
            }
        )

    students = sum(d["students"] for d in by_district)
    total = sum(d["total"] for d in by_district)
    summary = {
        "students": students,
        "mess": sum(d["mess"] for d in by_district),
        "abhyasika": sum(d["abhyasika"] for d in by_district),
        "total": total,
        "average": round(total / students) if students else 0,
        "mess_users": sum(d["mess_users"] for d in by_district),
        "abhyasika_users": sum(d["abhyasika_users"] for d in by_district),
    }
    return {"summary": summary, "by_district": by_district}


def to_requirement_row(row: Dict[str, Any], doc: Dict[str, Any]) -> Dict[str, Any]:
    """Directory row trimmed to what the requirements page needs."""
    keep = {k for k, _ in COLUMNS} | {"user_id"}
    out = {k: v for k, v in row.items() if k in keep}
    out["account_holder"] = (doc.get("bank") or {}).get("account_holder_name", "")
    # Not using a mess / abhyasika counts as ₹0 for the requirement
    out["mess_monthly_bill"] = row.get("mess_monthly_bill") or 0
    out["abhyasika_monthly_fee"] = row.get("abhyasika_monthly_fee") or 0
    out["monthly_total"] = out["mess_monthly_bill"] + out["abhyasika_monthly_fee"]
    return out
