from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import require_roles, get_current_user, get_current_student_profile
from app.db.session import get_db
from app.models.user import User
from app.models.attendance import StaffAttendance, StudentAttendance
from app.schemas.attendance import StaffAttendanceOut, StudentAttendanceBulk, StudentAttendanceOut

router = APIRouter()

STAFF_ROLES = ("admin", "hr", "telecaller", "trainer")
WORK_START_HOUR = 9
WORK_END_HOUR = 18


@router.post("/staff/login", response_model=StaffAttendanceOut)
def staff_login(db: Session = Depends(get_db), current_user: User = Depends(require_roles(*STAFF_ROLES))):
    today = date.today()
    record = db.query(StaffAttendance).filter(StaffAttendance.user_id == current_user.id, StaffAttendance.attendance_date == today).first()
    now = datetime.now(timezone.utc)
    if record:
        return record
    late = now.hour >= WORK_START_HOUR + 1
    record = StaffAttendance(user_id=current_user.id, attendance_date=today, login_time=now, late_login=late,
                              status="late" if late else "present")
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.post("/staff/logout", response_model=StaffAttendanceOut)
def staff_logout(db: Session = Depends(get_db), current_user: User = Depends(require_roles(*STAFF_ROLES))):
    today = date.today()
    record = db.query(StaffAttendance).filter(StaffAttendance.user_id == current_user.id, StaffAttendance.attendance_date == today).first()
    if not record:
        raise HTTPException(status_code=400, detail="You have not logged in today")
    now = datetime.now(timezone.utc)
    record.logout_time = now
    if record.login_time:
        delta = now - record.login_time
        record.total_hours = round(delta.total_seconds() / 3600, 2)
    record.early_logout = now.hour < WORK_END_HOUR
    db.commit()
    db.refresh(record)
    return record


@router.get("/staff/me", response_model=list[StaffAttendanceOut])
def my_staff_attendance(db: Session = Depends(get_db), current_user: User = Depends(require_roles(*STAFF_ROLES))):
    return db.query(StaffAttendance).filter(StaffAttendance.user_id == current_user.id).order_by(StaffAttendance.attendance_date.desc()).limit(60).all()


@router.get("/staff", response_model=list[StaffAttendanceOut])
def staff_attendance_report(attendance_date: date | None = None, user_id: int | None = None,
                             db: Session = Depends(get_db), _: User = Depends(require_roles("admin", "hr"))):
    q = db.query(StaffAttendance)
    if attendance_date:
        q = q.filter(StaffAttendance.attendance_date == attendance_date)
    if user_id:
        q = q.filter(StaffAttendance.user_id == user_id)
    return q.order_by(StaffAttendance.attendance_date.desc()).all()


@router.post("/students/mark")
def mark_student_attendance(payload: StudentAttendanceBulk, db: Session = Depends(get_db), user: User = Depends(require_roles("admin", "trainer"))):
    created = 0
    for record in payload.records:
        existing = (
            db.query(StudentAttendance)
            .filter(
                StudentAttendance.student_id == record.student_id,
                StudentAttendance.batch_id == payload.batch_id,
                StudentAttendance.attendance_date == payload.attendance_date,
            )
            .first()
        )
        if existing:
            existing.status = record.status
            existing.remarks = record.remarks
        else:
            db.add(StudentAttendance(
                student_id=record.student_id, batch_id=payload.batch_id,
                class_session_id=payload.class_session_id, attendance_date=payload.attendance_date,
                status=record.status, remarks=record.remarks, marked_by=user.id,
            ))
            created += 1
    db.commit()
    return {"detail": f"Attendance recorded for {len(payload.records)} students", "created": created}


@router.get("/students/batch/{batch_id}", response_model=list[StudentAttendanceOut])
def batch_attendance(batch_id: int, attendance_date: date | None = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    q = db.query(StudentAttendance).filter(StudentAttendance.batch_id == batch_id)
    if attendance_date:
        q = q.filter(StudentAttendance.attendance_date == attendance_date)
    return q.order_by(StudentAttendance.attendance_date.desc()).all()


@router.get("/students/me", response_model=list[StudentAttendanceOut])
def my_student_attendance(db: Session = Depends(get_db), student=Depends(get_current_student_profile)):
    return db.query(StudentAttendance).filter(StudentAttendance.student_id == student.id).order_by(StudentAttendance.attendance_date.desc()).all()
