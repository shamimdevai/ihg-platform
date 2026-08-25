"""Validates and stores uploaded files (images/documents), returning an accessible path.

Pure filesystem operations — does NOT create app.shared_kernel.models.Attachment rows
itself. Callers that need a persisted record should pass the returned UploadResult into
app.shared_kernel.repositories.attachment_repository.create() themselves, since only the
caller knows the correct owner_type/owner_id.
"""
import uuid
from dataclasses import dataclass
from pathlib import Path

from fastapi import UploadFile

from app.core.config import settings
from app.core.exceptions import ValidationError

_ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
_ALLOWED_DOCUMENT_TYPES = {"application/pdf"}


@dataclass
class UploadResult:
    """Result of a successful file save."""

    file_path: str
    url: str
    mime_type: str
    file_size_bytes: int
    file_name: str


async def save_upload(file: UploadFile, *, subfolder: str, allow_documents: bool = False) -> UploadResult:
    """Validate MIME type/size and write an uploaded file to disk under UPLOAD_DIR.

    Args:
        file: the incoming FastAPI UploadFile.
        subfolder: destination subfolder under uploads/images/ (e.g. "rooms", "menu_items")
            or uploads/documents/ when allow_documents=True.
        allow_documents: if True, validates against document MIME types (PDF) instead of
            image MIME types.

    Raises:
        ValidationError: unsupported MIME type or file exceeds MAX_UPLOAD_SIZE_MB.
    """
    allowed_types = _ALLOWED_DOCUMENT_TYPES if allow_documents else _ALLOWED_IMAGE_TYPES
    if file.content_type not in allowed_types:
        raise ValidationError(f"Unsupported file type: {file.content_type}")

    contents = await file.read()
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(contents) > max_bytes:
        raise ValidationError(f"File exceeds the {settings.MAX_UPLOAD_SIZE_MB}MB upload limit.")

    base_dir = "documents" if allow_documents else "images"
    dest_dir = Path(settings.UPLOAD_DIR) / base_dir / subfolder
    dest_dir.mkdir(parents=True, exist_ok=True)

    extension = Path(file.filename or "").suffix
    stored_name = f"{uuid.uuid4()}{extension}"
    dest_path = dest_dir / stored_name

    dest_path.write_bytes(contents)

    relative_url = f"/uploads/{base_dir}/{subfolder}/{stored_name}"
    return UploadResult(
        file_path=str(dest_path),
        url=relative_url,
        mime_type=file.content_type or "application/octet-stream",
        file_size_bytes=len(contents),
        file_name=file.filename or stored_name,
    )