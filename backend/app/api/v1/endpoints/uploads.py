import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from app.core.config import settings
from app.core.deps import get_current_user
from app.models.user import User

router = APIRouter()

ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".jpg", ".jpeg", ".png", ".mp4", ".webp"}
MAX_SIZE_MB = 20


@router.post("")
async def upload_file(file: UploadFile = File(...), _: User = Depends(get_current_user)):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type {ext} is not allowed")

    contents = await file.read()
    if len(contents) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File exceeds {MAX_SIZE_MB}MB limit")

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(settings.UPLOAD_DIR, stored_name)
    with open(path, "wb") as f:
        f.write(contents)

    return {"file_path": f"/uploads/{stored_name}", "original_name": file.filename}
