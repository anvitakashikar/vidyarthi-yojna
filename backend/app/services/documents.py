"""Storing uploaded documents (encrypted file + metadata), shared by students and donors."""
from typing import Any, Optional

from fastapi import UploadFile

from app.db.mongodb import get_database
from app.repositories.students import DocumentRepository
from app.services import storage


def has_file(file: Optional[UploadFile]) -> bool:
    return file is not None and bool(file.filename)


async def store_document(
    user_id: str,
    kind: str,
    file: UploadFile,
    data: Optional[bytes] = None,
    content_type: Optional[str] = None,
    **extra: Any,
) -> str:
    """Validates, encrypts and stores an upload. Returns the document id."""
    if data is None:
        data, content_type = await storage.read_upload(file)
    path = await storage.save_encrypted(user_id, data)
    doc = await DocumentRepository(get_database()).create_document(
        owner_user_id=user_id,
        kind=kind,
        original_filename=(file.filename or kind)[:200],
        content_type=content_type,
        size_bytes=len(data),
        storage_path=path,
        **extra,
    )
    return str(doc["_id"])
