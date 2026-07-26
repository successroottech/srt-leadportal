import os
import random
import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.db.session import get_db
from app.models.course import Course
from app.models.fee import Payment
from app.models.role import Role
from app.models.student import Student
from app.models.user import User
from app.services.codegen import next_code
from app.services.fees import create_student_fee_record

router = APIRouter()

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
PROOF_EXTENSIONS = IMAGE_EXTENSIONS | {".pdf"}
MAX_PHOTO_MB = 5
MAX_PROOF_MB = 10
PAYMENT_MODES = ("cash", "upi", "bank_transfer", "debit_card", "credit_card", "cheque", "online")


async def _save_public_upload(file: UploadFile, allowed_extensions: set[str], max_mb: int) -> str:
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"File type {ext} is not allowed")
    contents = await file.read()
    if len(contents) > max_mb * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File exceeds {max_mb}MB limit")
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(settings.UPLOAD_DIR, stored_name)
    with open(path, "wb") as f:
        f.write(contents)
    return f"/uploads/{stored_name}"


@router.get("/courses")
def public_courses(db: Session = Depends(get_db)):
    courses = db.query(Course).filter(Course.is_active.is_(True)).order_by(Course.name).all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "duration_weeks": c.duration_weeks,
            "regular_fee": float(c.regular_fee),
            "offer_fee": float(c.offer_fee) if c.offer_fee is not None else None,
        }
        for c in courses
    ]


@router.post("/register")
async def public_register(
    db: Session = Depends(get_db),
    name: str = Form(...),
    mobile: str = Form(...),
    email: str | None = Form(None),
    course_id: int = Form(...),
    address: str | None = Form(None),
    father_name: str | None = Form(None),
    initial_payment: float = Form(...),
    payment_mode: str = Form(...),
    portal_ref: str | None = Form(None),
    payment_proof: UploadFile | None = File(None),
    profile_photo: UploadFile | None = File(None),
):
    name = name.strip()
    mobile = mobile.strip()
    email = (email or "").strip() or None
    if not name or not mobile:
        raise HTTPException(status_code=422, detail="Name and mobile are required")
    if payment_mode not in PAYMENT_MODES:
        raise HTTPException(status_code=422, detail=f"payment_mode must be one of {PAYMENT_MODES}")
    if initial_payment < 0:
        raise HTTPException(status_code=422, detail="initial_payment cannot be negative")

    course = db.get(Course, course_id)
    if not course or not course.is_active:
        raise HTTPException(status_code=404, detail="Selected course is not available")

    if db.query(Student).filter(Student.mobile == mobile).first():
        raise HTTPException(status_code=409, detail="A student with this mobile number is already registered")
    if email and db.query(Student).filter(Student.email == email).first():
        raise HTTPException(status_code=409, detail="A student with this email is already registered")

    photo_path = None
    if profile_photo is not None and profile_photo.filename:
        photo_path = await _save_public_upload(profile_photo, IMAGE_EXTENSIONS, MAX_PHOTO_MB)
    proof_path = None
    if payment_proof is not None and payment_proof.filename:
        proof_path = await _save_public_upload(payment_proof, PROOF_EXTENSIONS, MAX_PROOF_MB)

    expected_completion = date.today() + timedelta(weeks=course.duration_weeks) if course.duration_weeks else None

    student = Student(
        student_code=next_code(db, Student, Student.student_code, "SRT-STU-"),
        name=name,
        mobile=mobile,
        email=email,
        address=address,
        father_name=father_name,
        portal_ref=portal_ref,
        profile_photo=photo_path,
        admission_type="course",
        course_id=course.id,
        joining_date=date.today(),
        expected_completion_date=expected_completion,
    )
    db.add(student)
    db.flush()

    student_role = db.query(Role).filter(Role.name == "student").first()
    user_account = User(
        name=name,
        email=email,
        mobile=mobile,
        password_hash=hash_password("Welcome@123"),
        role_id=student_role.id,
        must_reset_password=True,
    )
    db.add(user_account)
    db.flush()
    student.user_id = user_account.id

    total_fee = float(course.offer_fee) if course.offer_fee is not None else float(course.regular_fee)
    create_student_fee_record(db, student.id, total_fee, 0, initial_payment, 0)

    if initial_payment > 0:
        receipt_number = f"RCPT-{date.today().strftime('%Y%m')}-{random.randint(10000, 99999)}"
        db.add(Payment(
            receipt_number=receipt_number,
            student_id=student.id,
            course_id=course.id,
            payment_date=date.today(),
            amount=initial_payment,
            payment_mode=payment_mode,
            remarks="Initial payment via public registration",
            receipt_file=proof_path,
        ))

    db.commit()
    return {
        "student_code": student.student_code,
        "detail": "Registration received! Your student login has been created — sign in with your mobile number and the default password Welcome@123, then set a new password.",
    }
