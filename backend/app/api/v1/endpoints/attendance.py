from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import require_roles, get_current_user, get_current_student_profile
from app.db.session import get_db
from app.models.user import User
from app.models.role import Role
from app.models.attendance import StaffAttendance, StaffAttendanceBreak, StudentAttendance
from app.schemas.attendance import (
    StaffAttendanceOut, StaffAttendanceTodayOut, LiveAttendanceEntry,
    StudentAttendanceBulk, StudentAttendanceOut,
)

router = APIRouter()

STAFF_ROLES = ("admin", "hr", "telecaller", "trainer")
WORK_START_HOUR = 9
WORK_END_HOUR = 18


def _open_break(db: Session, attendance_id: int) -> StaffAttendanceBreak | None:
    return (
        db.query(StaffAttendanceBreak)
        .filter(StaffAttendanceBreak.staff_attendance_id == attendance_id, StaffAttendanceBreak.break_end.is_(None))
        .first()
    )


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


@router.get("/staff/today", response_model=StaffAttendanceTodayOut | None)
def my_today_attendance(db: Session = Depends(get_db), current_user: User = Depends(require_roles(*STAFF_ROLES))):
    today = date.today()
    record = db.query(StaffAttendance).filter(StaffAttendance.user_id == current_user.id, StaffAttendance.attendance_date == today).first()
    if not record:
        return None
    open_break = _open_break(db, record.id)
    return StaffAttendanceTodayOut(
        id=record.id, login_time=record.login_time, logout_time=record.logout_time,
        break_minutes=record.break_minutes, last_seen_at=record.last_seen_at, status=record.status,
        on_break=open_break is not None, active_break_start=open_break.break_start if open_break else None,
    )


@router.post("/staff/heartbeat")
def staff_heartbeat(db: Session = Depends(get_db), current_user: User = Depends(require_roles(*STAFF_ROLES))):
    today = date.today()
    record = db.query(StaffAttendance).filter(StaffAttendance.user_id == current_user.id, StaffAttendance.attendance_date == today).first()
    if not record or record.logout_time:
        return {"detail": "No active session"}
    record.last_seen_at = datetime.now(timezone.utc)
    db.commit()
    return {"detail": "ok"}


@router.post("/staff/break/start", response_model=StaffAttendanceTodayOut)
def start_break(db: Session = Depends(get_db), current_user: User = Depends(require_roles(*STAFF_ROLES))):
    today = date.today()
    record = db.query(StaffAttendance).filter(StaffAttendance.user_id == current_user.id, StaffAttendance.attendance_date == today).first()
    if not record or not record.login_time:
        raise HTTPException(status_code=400, detail="You have not logged in today")
    if record.logout_time:
        raise HTTPException(status_code=400, detail="You have already logged out today")
    if _open_break(db, record.id):
        raise HTTPException(status_code=400, detail="Break already in progress")
    brk = StaffAttendanceBreak(staff_attendance_id=record.id)
    db.add(brk)
    db.commit()
    return my_today_attendance(db, current_user)


@router.post("/staff/break/end", response_model=StaffAttendanceTodayOut)
def end_break(db: Session = Depends(get_db), current_user: User = Depends(require_roles(*STAFF_ROLES))):
    today = date.today()
    record = db.query(StaffAttendance).filter(StaffAttendance.user_id == current_user.id, StaffAttendance.attendance_date == today).first()
    if not record:
        raise HTTPException(status_code=400, detail="You have not logged in today")
    brk = _open_break(db, record.id)
    if not brk:
        raise HTTPException(status_code=400, detail="No break in progress")
    now = datetime.now(timezone.utc)
    brk.break_end = now
    minutes = max(0, round((now - brk.break_start).total_seconds() / 60))
    record.break_minutes += minutes
    db.commit()
    return my_today_attendance(db, current_user)


@router.get("/live", response_model=list[LiveAttendanceEntry])
def live_attendance(db: Session = Depends(get_db), _: User = Depends(require_roles("admin", "hr"))):
    today = date.today()
    records = (
        db.query(StaffAttendance)
        .filter(StaffAttendance.attendance_date == today, StaffAttendance.login_time.isnot(None), StaffAttendance.logout_time.is_(None))
        .all()
    )
    entries = []
    for record in records:
        user = db.get(User, record.user_id)
        if not user:
            continue
        role = db.get(Role, user.role_id)
        open_break = _open_break(db, record.id)
        entries.append(LiveAttendanceEntry(
            user_id=user.id, name=user.name, role=role.name if role else "",
            login_time=record.login_time, break_minutes=record.break_minutes,
            last_seen_at=record.last_seen_at, on_break=open_break is not None,
            active_break_start=open_break.break_start if open_break else None,
        ))
    entries.sort(key=lambda e: e.login_time)
    return entries


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
