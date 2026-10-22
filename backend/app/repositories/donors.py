"""Donor record — one document per donor in the `donors` collection.

    bank   account holder, account number (encrypted), IFSC, bank, branch, optional proof
    pan    PAN (encrypted + keyed hash for uniqueness), name on PAN, optional PAN card copy

`name`, `phone` and `email` are copied from the user account for the admin list.
"""
from typing import Any, Dict, Optional

from app.db.collections import Collections
from app.models.base import utc_now
from app.repositories.base import BaseRepository

DONOR_SECTIONS = ("bank", "pan")


class DonorRepository(BaseRepository):
    collection_name = Collections.DONORS

    async def get_by_user(self, user_id: str) -> Optional[Dict[str, Any]]:
        return await self.collection.find_one({"user_id": user_id})

    async def upsert_section(self, user: Dict[str, Any], section: str, value: Dict[str, Any]) -> Dict[str, Any]:
        user_id = str(user["_id"])
        now = utc_now()
        await self.collection.update_one(
            {"user_id": user_id},
            {
                "$set": {section: value, "name": user["name"], "phone": user.get("phone"), "email": user.get("email"), "updated_at": now},
                "$setOnInsert": {"user_id": user_id, "created_at": now},
            },
            upsert=True,
        )
        doc = await self.get_by_user(user_id)
        complete = all(doc.get(s) for s in DONOR_SECTIONS)
        if doc.get("onboarding_complete") != complete:
            await self.collection.update_one({"user_id": user_id}, {"$set": {"onboarding_complete": complete}})
            doc["onboarding_complete"] = complete
        return doc
