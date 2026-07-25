from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import require_roles, get_current_user, get_current_student_profile
from app.db.session import get_db
from app.models.user import User
from app.models.role import Role
from app.models.attendance import StaffAttendance, StaffAttendanceBreak, StaffAttendanceSession, StudentAttendance
from app.schemas.attendance import (
    StaffAttendanceOut, StaffAttendanceTodayOut, StaffAttendanceSessionOut, LiveAttendanceEntry,
    StudentAttendanceBulk, StudentAttendanceOut,
)
from app.api.v1.endpoints.settings import get_or_create_settings

router = APIRouter()

STAFF_ROLES = ("admin", "hr", "telecaller", "trainer")


def _work_hours(db: Session) -> tuple[int, int]:
    settings = get_or_create_settings(db)
    return settings.work_start_hour, settings.work_end_hour


def _open_break(db: Session, attendance_id: int) -> StaffAttendanceBreak | None:
    return (
        db.query(StaffAttendanceBreak)
        .filter(StaffAttendanceBreak.staff_attendance_id == attendance_id, StaffAttendanceBreak.break_end.is_(None))
        .first()
    )


def _open_session(db: Session, attendance_id: int) -> StaffAttendanceSession | None:
    return (
        db.query(StaffAttendanceSession)
        .filter(StaffAttendanceSession.staff_attendance_id == attendance_id, StaffAttendanceSession.logout_time.is_(None))
        .first()
    )


def _today_record(db: Session, user_id: int) -> StaffAttendance | None:
    return db.query(StaffAttendance).filter(StaffAttendance.user_id == user_id, StaffAttendance.attendance_date == date.today()).first()


def _build_today_status(db: Session, record: StaffAttendance) -> StaffAttendanceTodayOut:
    sessions = (
        db.query(StaffAttendanceSession)
        .filter(StaffAttendanceSession.staff_attendance_id == record.id)
        .order_by(StaffAttendanceSession.login_time)
        .all()
    )
    open_session = next((s for s in sessions if s.logout_time is None), None)
    open_break = _open_break(db, record.id)
    return StaffAttendanceTodayOut(
        id=record.id,
        is_logged_in=open_session is not None,
        sessions=[StaffAttendanceSessionOut.model_validate(s) for s in sessions],
        break_minutes=record.break_minutes,
        total_hours=record.total_hours,
        last_seen_at=record.last_seen_at,
        status=record.status,
        on_break=open_break is not None,
        active_break_start=open_break.break_start if open_break else None,
    )


@router.post("/staff/login", response_model=StaffAttendanceTodayOut)
def staff_login(db: Session = Depends(get_db), current_user: User = Depends(require_roles(*STAFF_ROLES))):
    now = datetime.now(timezone.utc)
    record = _today_record(db, current_user.id)
    if not record:
        work_start, _ = _work_hours(db)
        late = now.hour >= work_start + 1
        record = StaffAttendance(user_id=current_user.id, attendance_date=date.today(), login_time=now, late_login=late,
                                  status="late" if late else "present")
        db.add(record)
        db.flush()
    elif _open_session(db, record.id):
        raise HTTPException(status_code=400, detail="You are already logged in")
    db.add(StaffAttendanceSession(staff_attendance_id=record.id, login_time=now))
    db.commit()
    return _build_today_status(db, record)


@router.post("/staff/logout", response_model=StaffAttendanceTodayOut)
def staff_logout(db: Session = Depends(get_db), current_user: User = Depends(require_roles(*STAFF_ROLES))):
    record = _today_record(db, current_user.id)
    if not record:
        raise HTTPException(status_code=400, detail="You have not logged in today")
    session = _open_session(db, record.id)
    if not session:
        raise HTTPException(status_code=400, detail="You are not currently logged in")
    now = datetime.now(timezone.utc)
    session.logout_time = now
    record.logout_time = now
    db.flush()

    closed_sessions = (
        db.query(StaffAttendanceSession)
        .filter(StaffAttendanceSession.staff_attendance_id == record.id, StaffAttendanceSession.logout_time.isnot(None))
        .all()
    )
    gross_seconds = sum((s.logout_time - s.login_time).total_seconds() for s in closed_sessions)
    net_hours = max(0.0, gross_seconds / 3600 - record.break_minutes / 60)
    record.total_hours = round(net_hours, 2)
    _, work_end = _work_hours(db)
    record.early_logout = now.hour < work_end
    db.commit()
    return _build_today_status(db, record)


@router.get("/staff/me", response_model=list[StaffAttendanceOut])
def my_staff_attendance(db: Session = Depends(get_db), current_user: User = Depends(require_roles(*STAFF_ROLES))):
    return db.query(StaffAttendance).filter(StaffAttendance.user_id == current_user.id).order_by(StaffAttendance.attendance_date.desc()).limit(60).all()


@router.get("/staff/today", response_model=StaffAttendanceTodayOut | None)
def my_today_attendance(db: Session = Depends(get_db), current_user: User = Depends(require_roles(*STAFF_ROLES))):
    record = _today_record(db, current_user.id)
    if not record:
        return None
    return _build_today_status(db, record)


@router.post("/staff/heartbeat")
def staff_heartbeat(db: Session = Depends(get_db), current_user: User = Depends(require_roles(*STAFF_ROLES))):
    record = _today_record(db, current_user.id)
    if not record or not _open_session(db, record.id):
        return {"detail": "No active session"}
    record.last_seen_at = datetime.now(timezone.utc)
    db.commit()
    return {"detail": "ok"}


@router.post("/staff/break/start", response_model=StaffAttendanceTodayOut)
def start_break(db: Session = Depends(get_db), current_user: User = Depends(require_roles(*STAFF_ROLES))):
    record = _today_record(db, current_user.id)
    if not record or not _open_session(db, record.id):
        raise HTTPException(status_code=400, detail="You must be logged in to start a break")
    if _open_break(db, record.id):
        raise HTTPException(status_code=400, detail="Break already in progress")
    db.add(StaffAttendanceBreak(staff_attendance_id=record.id))
    db.commit()
    return _build_today_status(db, record)


@router.post("/staff/break/end", response_model=StaffAttendanceTodayOut)
def end_break(db: Session = Depends(get_db), current_user: User = Depends(require_roles(*STAFF_ROLES))):
    record = _today_record(db, current_user.id)
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
    return _build_today_status(db, record)


@router.get("/live", response_model=list[LiveAttendanceEntry])
def live_attendance(db: Session = Depends(get_db), _: User = Depends(require_roles("admin", "hr"))):
    today = date.today()
    open_sessions = (
        db.query(StaffAttendanceSession)
        .join(StaffAttendance, StaffAttendanceSession.staff_attendance_id == StaffAttendance.id)
        .filter(StaffAttendance.attendance_date == today, StaffAttendanceSession.logout_time.is_(None))
        .all()
    )
    entries = []
    for session in open_sessions:
        record = db.get(StaffAttendance, session.staff_attendance_id)
        user = db.get(User, record.user_id) if record else None
        if not record or not user:
            continue
        role = db.get(Role, user.role_id)
        open_break = _open_break(db, record.id)
        entries.append(LiveAttendanceEntry(
            user_id=user.id, name=user.name, role=role.name if role else "",
            login_time=session.login_time, break_minutes=record.break_minutes,
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
