"""Generic async CRUD helper for a MongoDB collection.

Feature repositories can subclass this, e.g.:

    class SchemeRepository(BaseRepository):
        collection_name = Collections.SCHEMES
"""
from typing import Any, Dict, List, Optional

from bson import ObjectId
from pymongo import ReturnDocument
from pymongo.asynchronous.database import AsyncDatabase

from app.models.base import utc_now


class BaseRepository:
    collection_name: str = ""

    def __init__(self, db: AsyncDatabase):
        self.collection = db[self.collection_name]

    @staticmethod
    def _oid(id_: str) -> Optional[ObjectId]:
        return ObjectId(id_) if ObjectId.is_valid(id_) else None

    async def get(self, id_: str) -> Optional[Dict[str, Any]]:
        oid = self._oid(id_)
        return await self.collection.find_one({"_id": oid}) if oid else None

    async def list(self, filters: Optional[Dict[str, Any]] = None, skip: int = 0, limit: int = 50) -> List[Dict[str, Any]]:
        cursor = self.collection.find(filters or {}).skip(skip).limit(limit)
        return await cursor.to_list(length=limit)

    async def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        now = utc_now()
        doc = {**data, "created_at": now, "updated_at": now}
        result = await self.collection.insert_one(doc)
        doc["_id"] = result.inserted_id
        return doc

    async def update(self, id_: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        oid = self._oid(id_)
        if not oid:
            return None
        return await self.collection.find_one_and_update(
            {"_id": oid},
            {"$set": {**data, "updated_at": utc_now()}},
            return_document=ReturnDocument.AFTER,
        )

    async def delete(self, id_: str) -> bool:
        oid = self._oid(id_)
        if not oid:
            return False
        result = await self.collection.delete_one({"_id": oid})
        return result.deleted_count == 1
