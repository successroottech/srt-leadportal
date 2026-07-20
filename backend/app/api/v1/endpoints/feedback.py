from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import require_roles, get_current_student_profile
from app.db.session import get_db
from app.models.user import User
from app.models.feedback import FeedbackComplaint
from app.schemas.feedback import FeedbackCreate, FeedbackOut, FeedbackResponse
from app.services.audit import log_action

router = APIRouter()


@router.post("", response_model=FeedbackOut)
def submit_feedback(payload: FeedbackCreate, db: Session = Depends(get_db), student=Depends(get_current_student_profile)):
    item = FeedbackComplaint(student_id=student.id, **payload.model_dump())
    db.add(item)
    db.flush()
    log_action(db, student_id=student.id, action="create", module="feedback_complaints", record_id=item.id)
    db.commit()
    db.refresh(item)
    return item


@router.get("/me", response_model=list[FeedbackOut])
def my_feedback(db: Session = Depends(get_db), student=Depends(get_current_student_profile)):
    return db.query(FeedbackComplaint).filter(FeedbackComplaint.student_id == student.id).order_by(FeedbackComplaint.created_at.desc()).all()


@router.get("", response_model=list[FeedbackOut])
def list_feedback(status: str | None = None, type: str | None = None, db: Session = Depends(get_db), _: User = Depends(require_roles("admin", "hr"))):
    q = db.query(FeedbackComplaint)
    if status:
        q = q.filter(FeedbackComplaint.status == status)
    if type:
        q = q.filter(FeedbackComplaint.type == type)
    return q.order_by(FeedbackComplaint.created_at.desc()).all()


@router.post("/{feedback_id}/respond", response_model=FeedbackOut)
def respond_feedback(feedback_id: int, payload: FeedbackResponse, db: Session = Depends(get_db), user: User = Depends(require_roles("admin", "hr"))):
    item = db.get(FeedbackComplaint, feedback_id)
    if not item:
        raise HTTPException(status_code=404, detail="Feedback not found")
    item.status = payload.status
    if payload.admin_response is not None:
        item.admin_response = payload.admin_response
    log_action(db, user_id=user.id, action="update", module="feedback_complaints", record_id=item.id)
    db.commit()
    db.refresh(item)
    return item
