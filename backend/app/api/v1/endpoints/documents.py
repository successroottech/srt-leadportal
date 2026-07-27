import os
import uuid
from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import require_roles, get_current_student_profile
from app.db.session import get_db
from app.models.course import Course
from app.models.student import Student, StudentDocument
from app.models.user import User
from app.schemas.document import DocumentOut, InvoiceCreate
from app.services.audit import log_action
from app.services.documents import generate_invoice, generate_joining_letter, new_verification_code

router = APIRouter()

STAFF_ROLES = ("admin", "hr")
CERTIFICATE_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
MAX_CERTIFICATE_MB = 10


def _get_student_or_404(db: Session, student_id: int) -> Student:
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student


@router.post("/joining-letter/{student_id}", response_model=DocumentOut)
def create_joining_letter(student_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles(*STAFF_ROLES))):
    student = _get_student_or_404(db, student_id)
    course = db.get(Course, student.course_id) if student.course_id else None
    code = new_verification_code()
    file_path = generate_joining_letter(db, student, course.name if course else "-", code)
    doc = StudentDocument(
        student_id=student.id,
        document_type="joining_letter",
        title=f"Joining Letter - {student.name}",
        file_path=file_path,
        verification_code=code,
        created_by=user.id,
    )
    db.add(doc)
    log_action(db, user_id=user.id, action="create", module="student_documents", record_id=student.id)
    db.commit()
    db.refresh(doc)
    return doc


@router.post("/invoices", response_model=DocumentOut)
def create_invoice(payload: InvoiceCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(*STAFF_ROLES))):
    student = _get_student_or_404(db, payload.student_id)
    if payload.amount <= 0:
        raise HTTPException(status_code=422, detail="amount must be greater than 0")
    code = new_verification_code()
    issue_date = date.today()
    file_path = generate_invoice(db, student, payload.title, payload.amount, payload.due_date, issue_date, code)
    doc = StudentDocument(
        student_id=student.id,
        document_type="invoice",
        title=payload.title,
        file_path=file_path,
        amount=payload.amount,
        due_date=payload.due_date,
        issue_date=issue_date,
        verification_code=code,
        created_by=user.id,
    )
    db.add(doc)
    log_action(db, user_id=user.id, action="create", module="student_documents", record_id=student.id)
    db.commit()
    db.refresh(doc)
    return doc


@router.post("/certificates", response_model=DocumentOut)
async def upload_certificate(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(*STAFF_ROLES)),
    student_id: int = Form(...),
    title: str = Form(...),
    file: UploadFile = File(...),
):
    student = _get_student_or_404(db, student_id)
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in CERTIFICATE_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type {ext} is not allowed")
    contents = await file.read()
    if len(contents) > MAX_CERTIFICATE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File exceeds {MAX_CERTIFICATE_MB}MB limit")

    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(settings.UPLOAD_DIR, stored_name)
    with open(path, "wb") as f:
        f.write(contents)

    code = new_verification_code()
    doc = StudentDocument(
        student_id=student.id,
        document_type="certificate",
        title=title,
        file_path=f"/uploads/{stored_name}",
        verification_code=code,
        created_by=user.id,
    )
    db.add(doc)
    log_action(db, user_id=user.id, action="create", module="student_documents", record_id=student.id)
    db.commit()
    db.refresh(doc)
    return doc


@router.get("/student/{student_id}", response_model=list[DocumentOut])
def list_student_documents(student_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles(*STAFF_ROLES))):
    _get_student_or_404(db, student_id)
    return db.query(StudentDocument).filter(StudentDocument.student_id == student_id).order_by(StudentDocument.uploaded_at.desc()).all()


@router.get("/me", response_model=list[DocumentOut])
def my_documents(student: Student = Depends(get_current_student_profile), db: Session = Depends(get_db)):
    return db.query(StudentDocument).filter(StudentDocument.student_id == student.id).order_by(StudentDocument.uploaded_at.desc()).all()


@router.delete("/{document_id}")
def delete_document(document_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles("admin"))):
    doc = db.get(StudentDocument, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.file_path:
        fs_path = os.path.join(settings.UPLOAD_DIR, os.path.basename(doc.file_path))
        if os.path.exists(fs_path):
            os.remove(fs_path)
    db.delete(doc)
    log_action(db, user_id=user.id, action="delete", module="student_documents", record_id=document_id)
    db.commit()
    return {"detail": "Document deleted"}
