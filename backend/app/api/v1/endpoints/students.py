from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import require_roles, get_current_user, get_current_student_profile
from app.core.security import hash_password
from app.db.session import get_db
from app.models.user import User
from app.models.role import Role
from app.models.student import Student, StudentBatchHistory
from app.models.fee import StudentFee, FeeEmi, Payment
from app.models.batch import Batch
from app.schemas.student import StudentCreate, StudentUpdate, StudentOut, TransferBatchRequest
from app.services.audit import log_action
from app.services.codegen import next_code
from app.services.fees import create_student_fee_record

router = APIRouter()

STAFF_ROLES = ("admin", "hr", "trainer", "telecaller")
ADMISSION_TYPES = ("course", "job_service", "both")


def _attach_fee_summary(db: Session, students: list[Student]) -> None:
    """Sets transient (unmapped) balance_fee/next_fee_due_date/fee_status attrs
    on each Student so StudentOut can serialize them without an N+1 query per row."""
    if not students:
        return
    student_ids = [s.id for s in students]
    fees = db.query(StudentFee).filter(StudentFee.student_id.in_(student_ids)).all()
    fee_by_student = {f.student_id: f for f in fees}
    fee_ids = [f.id for f in fees]
    unpaid_emis = (
        db.query(FeeEmi)
        .filter(FeeEmi.student_fee_id.in_(fee_ids or [-1]), FeeEmi.status != "paid")
        .order_by(FeeEmi.due_date)
        .all()
    )
    next_due_by_fee = {}
    for emi in unpaid_emis:
        next_due_by_fee.setdefault(emi.student_fee_id, emi.due_date)

    today = date.today()
    soon = today + timedelta(days=7)
    for student in students:
        fee = fee_by_student.get(student.id)
        if not fee:
            student.balance_fee = None
            student.next_fee_due_date = None
            student.fee_status = None
            continue
        student.balance_fee = float(fee.balance_fee)
        next_due = next_due_by_fee.get(fee.id)
        student.next_fee_due_date = next_due
        if fee.balance_fee <= 0:
            student.fee_status = "paid"
        elif next_due and next_due < today:
            student.fee_status = "overdue"
        elif next_due and next_due <= soon:
            student.fee_status = "due_soon"
        else:
            student.fee_status = "upcoming"


@router.get("", response_model=list[StudentOut])
def list_students(
    course_id: int | None = None,
    batch_id: int | None = None,
    course_status: str | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    role = db.get(Role, current_user.role_id)
    q = db.query(Student)
    if role and role.name == "trainer":
        trainer_batch_ids = [b.id for b in db.query(Batch).filter(Batch.trainer_id == current_user.id)]
        q = q.filter(Student.batch_id.in_(trainer_batch_ids or [-1]))
    if course_id:
        q = q.filter(Student.course_id == course_id)
    if batch_id:
        q = q.filter(Student.batch_id == batch_id)
    if course_status:
        q = q.filter(Student.course_status == course_status)
    if search:
        like = f"%{search}%"
        q = q.filter((Student.name.ilike(like)) | (Student.mobile.ilike(like)) | (Student.student_code.ilike(like)))
    students = q.order_by(Student.id.desc()).all()
    _attach_fee_summary(db, students)
    return students


@router.post("", response_model=StudentOut)
def create_student(payload: StudentCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(*STAFF_ROLES))):
    if payload.admission_type not in ADMISSION_TYPES:
        raise HTTPException(status_code=422, detail=f"admission_type must be one of {ADMISSION_TYPES}")
    if db.query(Student).filter(Student.mobile == payload.mobile).first():
        raise HTTPException(status_code=400, detail="A student with this mobile number already exists")
    if payload.email and db.query(Student).filter(Student.email == payload.email).first():
        raise HTTPException(status_code=400, detail="A student with this email already exists")

    data = payload.model_dump(exclude={"create_login", "password", "total_course_fee", "discount", "initial_payment", "number_of_emis"})
    student = Student(student_code=next_code(db, Student, Student.student_code, "SRT-STU-"), **data)
    db.add(student)
    db.flush()

    if payload.create_login:
        login_role = db.query(Role).filter(Role.name == "student").first()
        user_account = User(
            name=payload.name, email=payload.email, mobile=payload.mobile,
            password_hash=hash_password(payload.password or "Welcome@123"),
            role_id=login_role.id, must_reset_password=True,
        )
        db.add(user_account)
        db.flush()
        student.user_id = user_account.id

    create_student_fee_record(db, student.id, payload.total_course_fee, payload.discount, payload.initial_payment, payload.number_of_emis)

    log_action(db, user_id=user.id, action="create", module="students", record_id=student.id)
    db.commit()
    db.refresh(student)
    _attach_fee_summary(db, [student])
    return student


@router.get("/me", response_model=StudentOut)
def my_profile(student: Student = Depends(get_current_student_profile), db: Session = Depends(get_db)):
    _attach_fee_summary(db, [student])
    return student


@router.get("/{student_id}", response_model=StudentOut)
def get_student(student_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    _attach_fee_summary(db, [student])
    return student


@router.put("/{student_id}", response_model=StudentOut)
def update_student(student_id: int, payload: StudentUpdate, db: Session = Depends(get_db), user: User = Depends(require_roles(*STAFF_ROLES))):
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(student, field, value)
    log_action(db, user_id=user.id, action="update", module="students", record_id=student.id)
    db.commit()
    db.refresh(student)
    return student


@router.delete("/{student_id}")
def delete_student(student_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles("admin"))):
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if db.query(Payment).filter(Payment.student_id == student_id).first():
        raise HTTPException(
            status_code=400,
            detail="This student has recorded fee payments and cannot be deleted (receipts must be retained). Deactivate the student instead.",
        )
    db.delete(student)
    log_action(db, user_id=user.id, action="delete", module="students", record_id=student_id)
    db.commit()
    return {"detail": "Student deleted"}


@router.post("/{student_id}/transfer-batch", response_model=StudentOut)
def transfer_batch(student_id: int, payload: TransferBatchRequest, db: Session = Depends(get_db), user: User = Depends(require_roles("admin", "hr"))):
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if student.batch_id:
        db.add(StudentBatchHistory(student_id=student.id, batch_id=student.batch_id, action="transferred_out", changed_by=user.id, remarks=payload.remarks))
    db.add(StudentBatchHistory(student_id=student.id, batch_id=payload.new_batch_id, action="transferred_in", changed_by=user.id, remarks=payload.remarks))
    student.batch_id = payload.new_batch_id
    log_action(db, user_id=user.id, action="transfer", module="students", record_id=student.id)
    db.commit()
    db.refresh(student)
    return student


@router.get("/{student_id}/batch-history")
def batch_history(student_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.query(StudentBatchHistory).filter(StudentBatchHistory.student_id == student_id).order_by(StudentBatchHistory.changed_at.desc()).all()
    return [{"batch_id": r.batch_id, "action": r.action, "remarks": r.remarks, "changed_at": r.changed_at} for r in rows]
