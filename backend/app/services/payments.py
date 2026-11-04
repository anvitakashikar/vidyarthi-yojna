"""Fund balance and monthly payouts to accepted students.

    funds      money received (credits), recorded by an admin
    payments   money paid to a student for one month (debits), one per student per month

Money left = total received − total paid. The amount due to a student for a
month is their monthly requirement (mess bill) at the time of payment.
"""
import re
from datetime import date
from typing import Any, Dict, Optional

from pymongo.asynchronous.database import AsyncDatabase

from app.core.errors import AppError
from app.db.collections import Collections

PERIOD_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


def current_period() -> str:
    return date.today().strftime("%Y-%m")


def check_period(period: Optional[str]) -> str:
    """'YYYY-MM', not in the future. Defaults to the current month."""
    period = period or current_period()
    if not PERIOD_RE.match(period) or period > current_period():
        raise AppError("payments.invalid_period")
    return period


def monthly_requirement(doc: Dict[str, Any]) -> Dict[str, int]:
    mess = (doc.get("expenses") or {}).get("mess") or {}
    mess_amount = (mess.get("monthly_bill") or 0) if mess.get("uses_mess") else 0
    return {"mess": mess_amount, "total": mess_amount}


async def sum_amounts(db: AsyncDatabase, collection: str, match: Optional[Dict[str, Any]] = None) -> Dict[str, int]:
    pipeline = [{"$match": match or {}}, {"$group": {"_id": None, "amount": {"$sum": "$amount"}, "count": {"$sum": 1}}}]
    async for row in await db[collection].aggregate(pipeline):
        return {"amount": row["amount"], "count": row["count"]}
    return {"amount": 0, "count": 0}


async def balance(db: AsyncDatabase) -> Dict[str, int]:
    received = await sum_amounts(db, Collections.FUNDS)
    paid = await sum_amounts(db, Collections.PAYMENTS)
    return {"received": received["amount"], "paid": paid["amount"], "balance": received["amount"] - paid["amount"]}


async def paid_user_ids(db: AsyncDatabase, period: str) -> set:
    return {p["user_id"] async for p in db[Collections.PAYMENTS].find({"period": period}, {"user_id": 1})}
