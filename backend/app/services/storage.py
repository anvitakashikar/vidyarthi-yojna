"""Encrypted file storage on local disk.

Files are validated by their actual content (magic bytes), encrypted with the
data key and written to UPLOAD_DIR/<user_id>/<random>.bin. Swap this module for
S3 / cloud storage later without touching the routes.
"""
import uuid
from pathlib import Path
from typing import Tuple

from fastapi import UploadFile
from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.core.crypto import decrypt_bytes, encrypt_bytes
from app.core.errors import AppError

# Detected from file content, not from the client-supplied content type
_SIGNATURES = (
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"%PDF-", "application/pdf"),
)


def _upload_root() -> Path:
    return Path(settings.UPLOAD_DIR).resolve()


def _detect_type(data: bytes) -> str:
    for signature, content_type in _SIGNATURES:
        if data.startswith(signature):
            return content_type
    raise AppError("upload.invalid_type")


async def read_upload(file: UploadFile) -> Tuple[bytes, str]:
    """Reads and validates an upload. Returns (content, detected content type)."""
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    data = await file.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise AppError("upload.too_large", {"max_mb": settings.MAX_UPLOAD_MB})
    if not data:
        raise AppError("upload.invalid_type")
    return data, _detect_type(data)


def _write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(encrypt_bytes(data))


async def save_encrypted(user_id: str, data: bytes) -> str:
    """Stores the file encrypted and returns its path relative to UPLOAD_DIR."""
    relative = f"{user_id}/{uuid.uuid4().hex}.bin"
    await run_in_threadpool(_write, _upload_root() / relative, data)
    return relative


async def load_decrypted(relative_path: str) -> bytes:
    path = (_upload_root() / relative_path).resolve()
    if _upload_root() not in path.parents or not path.exists():
        raise AppError("student.document_not_found")
    return decrypt_bytes(await run_in_threadpool(path.read_bytes))


async def delete_file(relative_path: str) -> None:
    path = (_upload_root() / relative_path).resolve()
    if _upload_root() in path.parents and path.exists():
        await run_in_threadpool(path.unlink)
