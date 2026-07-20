from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.core.security import hash_password
from app.db.session import get_db
from app.models.user import User
from app.models.role import Role
from app.models.attendance import StaffAttendance
from app.models.leave import LeaveRequest
from app.schemas.staff import StaffCreate, StaffUpdate, StaffOut
from app.services.audit import log_action
from app.services.codegen import next_code

router = APIRouter()

MANAGE_ROLES = ("admin", "hr")


@router.get("", response_model=list[StaffOut])
def list_staff(
    role: str | None = None,
    is_active: bool | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(*MANAGE_ROLES)),
):
    q = db.query(User)
    if role:
        q = q.join(Role).filter(Role.name == role)
    if is_active is not None:
        q = q.filter(User.is_active == is_active)
    if search:
        like = f"%{search}%"
        q = q.filter((User.name.ilike(like)) | (User.email.ilike(like)) | (User.mobile.ilike(like)))
    return q.order_by(User.id.desc()).all()


@router.post("", response_model=StaffOut)
def create_staff(payload: StaffCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(*MANAGE_ROLES))):
    if payload.email and db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already exists")
    if payload.mobile and db.query(User).filter(User.mobile == payload.mobile).first():
        raise HTTPException(status_code=400, detail="Mobile already exists")

    staff = User(
        staff_code=next_code(db, User, User.staff_code, "SRT-EMP-"),
        name=payload.name,
        email=payload.email,
        mobile=payload.mobile,
        alt_mobile=payload.alt_mobile,
        password_hash=hash_password(payload.password),
        role_id=payload.role_id,
        department=payload.department,
        joining_date=payload.joining_date,
        salary=payload.salary,
        address=payload.address,
        employment_status=payload.employment_status,
    )
    db.add(staff)
    db.flush()
    log_action(db, user_id=user.id, action="create", module="staff", record_id=staff.id)
    db.commit()
    db.refresh(staff)
    return staff


@router.get("/{staff_id}", response_model=StaffOut)
def get_staff(staff_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles(*MANAGE_ROLES))):
    staff = db.get(User, staff_id)
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    return staff


@router.put("/{staff_id}", response_model=StaffOut)
def update_staff(staff_id: int, payload: StaffUpdate, db: Session = Depends(get_db), user: User = Depends(require_roles(*MANAGE_ROLES))):
    staff = db.get(User, staff_id)
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    before = {"is_active": staff.is_active, "role_id": staff.role_id}
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(staff, field, value)
    log_action(db, user_id=user.id, action="update", module="staff", record_id=staff.id, previous_value=before)
    db.commit()
    db.refresh(staff)
    return staff


@router.delete("/{staff_id}")
def delete_staff(staff_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles("admin"))):
    staff = db.get(User, staff_id)
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    db.delete(staff)
    log_action(db, user_id=user.id, action="delete", module="staff", record_id=staff_id)
    db.commit()
    return {"detail": "Staff deleted"}


@router.post("/{staff_id}/toggle-active", response_model=StaffOut)
def toggle_active(staff_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles(*MANAGE_ROLES))):
    staff = db.get(User, staff_id)
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    staff.is_active = not staff.is_active
    log_action(db, user_id=user.id, action="status_change", module="staff", record_id=staff.id)
    db.commit()
    db.refresh(staff)
    return staff


@router.post("/{staff_id}/reset-password")
def reset_password(staff_id: int, new_password: str = Query(..., min_length=6), db: Session = Depends(get_db), user: User = Depends(require_roles(*MANAGE_ROLES))):
    staff = db.get(User, staff_id)
    if not staff:
        raise HTTPException(status_code=404, detail="Staff not found")
    staff.password_hash = hash_password(new_password)
    staff.must_reset_password = True
    log_action(db, user_id=user.id, action="update", module="staff", record_id=staff.id)
    db.commit()
    return {"detail": "Password reset"}


@router.get("/{staff_id}/attendance")
def staff_attendance_history(staff_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles(*MANAGE_ROLES))):
    rows = db.query(StaffAttendance).filter(StaffAttendance.user_id == staff_id).order_by(StaffAttendance.attendance_date.desc()).limit(90).all()
    return [
        {"date": r.attendance_date, "login_time": r.login_time, "logout_time": r.logout_time,
         "total_hours": r.total_hours, "status": r.status}
        for r in rows
    ]


@router.get("/{staff_id}/leave-history")
def staff_leave_history(staff_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles(*MANAGE_ROLES))):
    rows = db.query(LeaveRequest).filter(LeaveRequest.user_id == staff_id).order_by(LeaveRequest.applied_at.desc()).all()
    return [
        {"id": r.id, "kind": r.request_kind, "leave_type": r.leave_type, "start_date": r.start_date,
         "end_date": r.end_date, "status": r.status}
        for r in rows
    ]
