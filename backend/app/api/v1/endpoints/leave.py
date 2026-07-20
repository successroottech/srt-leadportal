from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import require_roles, get_current_user, get_current_student_profile
from app.db.session import get_db
from app.models.user import User
from app.models.leave import LeaveRequest
from app.schemas.leave import LeaveRequestCreate, LeaveRequestOut, LeaveDecision
from app.services.audit import log_action
from app.services.notify import notify_user, notify_student

router = APIRouter()

STAFF_ROLES = ("admin", "hr", "telecaller", "trainer")
APPROVER_ROLES = ("admin", "hr")


@router.post("/staff", response_model=LeaveRequestOut)
def apply_staff_leave(payload: LeaveRequestCreate, db: Session = Depends(get_db), current_user: User = Depends(require_roles(*STAFF_ROLES))):
    request = LeaveRequest(user_id=current_user.id, **payload.model_dump())
    db.add(request)
    log_action(db, user_id=current_user.id, action="create", module="leave_requests", record_id=None)
    db.commit()
    db.refresh(request)
    return request


@router.get("/staff/me", response_model=list[LeaveRequestOut])
def my_staff_leaves(db: Session = Depends(get_db), current_user: User = Depends(require_roles(*STAFF_ROLES))):
    return db.query(LeaveRequest).filter(LeaveRequest.user_id == current_user.id).order_by(LeaveRequest.applied_at.desc()).all()


@router.post("/student", response_model=LeaveRequestOut)
def apply_student_leave(payload: LeaveRequestCreate, db: Session = Depends(get_db), student=Depends(get_current_student_profile)):
    request = LeaveRequest(student_id=student.id, **payload.model_dump())
    db.add(request)
    log_action(db, student_id=student.id, action="create", module="leave_requests", record_id=None)
    db.commit()
    db.refresh(request)
    return request


@router.get("/student/me", response_model=list[LeaveRequestOut])
def my_student_leaves(db: Session = Depends(get_db), student=Depends(get_current_student_profile)):
    return db.query(LeaveRequest).filter(LeaveRequest.student_id == student.id).order_by(LeaveRequest.applied_at.desc()).all()


@router.get("", response_model=list[LeaveRequestOut])
def list_all_leaves(status: str | None = None, db: Session = Depends(get_db), _: User = Depends(require_roles(*APPROVER_ROLES))):
    q = db.query(LeaveRequest)
    if status:
        q = q.filter(LeaveRequest.status == status)
    return q.order_by(LeaveRequest.applied_at.desc()).all()


@router.post("/{leave_id}/decision", response_model=LeaveRequestOut)
def decide_leave(leave_id: int, payload: LeaveDecision, db: Session = Depends(get_db), user: User = Depends(require_roles(*APPROVER_ROLES))):
    request = db.get(LeaveRequest, leave_id)
    if not request:
        raise HTTPException(status_code=404, detail="Leave request not found")
    if payload.status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Status must be approved or rejected")
    request.status = payload.status
    request.approval_remarks = payload.approval_remarks
    request.approved_by = user.id
    request.decided_at = datetime.now(timezone.utc)

    title = f"Leave request {payload.status}"
    message = payload.approval_remarks or ""
    if request.user_id:
        notify_user(db, request.user_id, title, message, category="leave")
    if request.student_id:
        notify_student(db, request.student_id, title, message, category="leave")

    log_action(db, user_id=user.id, action="approve" if payload.status == "approved" else "reject",
               module="leave_requests", record_id=leave_id)
    db.commit()
    db.refresh(request)
    return request
