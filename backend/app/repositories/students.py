from datetime import date
from typing import Any, Dict, Optional

from bson import ObjectId
from pymongo.asynchronous.database import AsyncDatabase

from app.core import eligibility
from app.db.collections import Collections
from app.models.base import utc_now
from app.models.student import SECTIONS
from app.repositories.base import BaseRepository
from app.services import storage


class StudentRepository(BaseRepository):
    collection_name = Collections.STUDENTS

    async def get_by_user(self, user_id: str) -> Optional[Dict[str, Any]]:
        return await self.collection.find_one({"user_id": user_id})

    async def create_for_user(self, user: Dict[str, Any], personal: Dict[str, Any]) -> Dict[str, Any]:
        """Creates the student record at registration with section 1 filled in."""
        now = utc_now()
        doc = {
            "user_id": str(user["_id"]),
            "name": user["name"],
            "phone": user.get("phone"),
            "email": user.get("email"),
            "personal": {**personal, "submitted_at": now},
            "onboarding_complete": False,
            "verification_status": "pending",
            "created_at": now,
            "updated_at": now,
        }
        result = await self.collection.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc

    async def upsert_section(self, user_id: str, section: str, value: Dict[str, Any], extra: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Sets one section of the student's record and recomputes completeness."""
        now = utc_now()
        await self.collection.update_one(
            {"user_id": user_id},
            {
                "$set": {section: value, **(extra or {}), "updated_at": now, "verification_status": "pending"},
                "$setOnInsert": {"user_id": user_id, "created_at": now},
            },
            upsert=True,
        )
        doc = await self.get_by_user(user_id)
        complete = all(doc.get(s) for s in SECTIONS)
        if doc.get("onboarding_complete") != complete:
            await self.collection.update_one({"user_id": user_id}, {"$set": {"onboarding_complete": complete}})
            doc["onboarding_complete"] = complete
        return doc


class DocumentRepository(BaseRepository):
    collection_name = Collections.DOCUMENTS

    async def create_document(
        self,
        *,
        owner_user_id: str,
        kind: str,
        original_filename: str,
        content_type: str,
        size_bytes: int,
        storage_path: str,
        pending: bool = False,
        extraction: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        return await self.create(
            {
                "owner_user_id": owner_user_id,
                "kind": kind,
                "original_filename": original_filename,
                "content_type": content_type,
                "size_bytes": size_bytes,
                "storage_path": storage_path,
                "pending": pending,
                "extraction": extraction,
            }
        )

    async def get_owned(self, document_id: Optional[str], owner_user_id: str, kind: str) -> Optional[Dict[str, Any]]:
        if not document_id or not ObjectId.is_valid(document_id):
            return None
        return await self.collection.find_one({"_id": ObjectId(document_id), "owner_user_id": owner_user_id, "kind": kind})

    async def delete_with_file(self, document_id: Optional[str]) -> None:
        """Removes a replaced document and its encrypted file."""
        if not document_id or not ObjectId.is_valid(document_id):
            return
        doc = await self.get(document_id)
        if doc:
            await storage.delete_file(doc["storage_path"])
            await self.delete(document_id)

    async def delete_pending(self, owner_user_id: str, kind: str) -> None:
        """Cleans up uploads that were read but never confirmed."""
        async for doc in self.collection.find({"owner_user_id": owner_user_id, "kind": kind, "pending": True}):
            await storage.delete_file(doc["storage_path"])
            await self.collection.delete_one({"_id": doc["_id"]})


async def refresh_eligibility(db: AsyncDatabase) -> int:
    """Evaluates students that have no eligibility result yet, or one from older rules.

    The age is taken on the original check date, so results do not drift just
    because the server restarted.
    """
    collection = db[Collections.STUDENTS]
    query = {
        "aadhaar": {"$ne": None},
        "$or": [{"eligibility": {"$exists": False}}, {"eligibility.rules_version": {"$ne": eligibility.RULES_VERSION}}],
    }
    updated = 0
    async for doc in collection.find(query):
        aadhaar = doc["aadhaar"]
        checked = (doc.get("eligibility") or {}).get("checked_on")
        on = date.fromisoformat(checked) if checked else aadhaar["submitted_at"].date()
        result = eligibility.evaluate(aadhaar["dob"].date(), aadhaar["taluka"], aadhaar["district"], on)
        await collection.update_one({"_id": doc["_id"]}, {"$set": {"eligibility": result.to_dict()}})
        updated += 1
    return updated
