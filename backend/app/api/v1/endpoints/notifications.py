from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.role import Role
from app.models.notification import Notification
from app.models.student import Student
from app.schemas.notification import NotificationOut

router = APIRouter()


def _current_recipient(db: Session, current_user: User):
    role = db.get(Role, current_user.role_id)
    if role and role.name == "student":
        student = db.query(Student).filter(Student.user_id == current_user.id).first()
        return None, student
    return current_user, None


@router.get("", response_model=list[NotificationOut])
def list_notifications(status: str | None = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user, student = _current_recipient(db, current_user)
    q = db.query(Notification)
    q = q.filter(Notification.user_id == user.id) if user else q.filter(Notification.student_id == student.id if student else -1)
    if status:
        q = q.filter(Notification.status == status)
    return q.order_by(Notification.created_at.desc()).limit(100).all()


@router.get("/unread-count")
def unread_count(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user, student = _current_recipient(db, current_user)
    q = db.query(Notification).filter(Notification.status == "unread")
    q = q.filter(Notification.user_id == user.id) if user else q.filter(Notification.student_id == student.id if student else -1)
    return {"count": q.count()}


@router.post("/{notification_id}/read", response_model=NotificationOut)
def mark_read(notification_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    notification = db.get(Notification, notification_id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.status = "read"
    notification.read_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(notification)
    return notification


@router.post("/{notification_id}/dismiss", response_model=NotificationOut)
def dismiss(notification_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    notification = db.get(Notification, notification_id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.status = "dismissed"
    db.commit()
    db.refresh(notification)
    return notification


@router.post("/mark-all-read")
def mark_all_read(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user, student = _current_recipient(db, current_user)
    q = db.query(Notification).filter(Notification.status == "unread")
    q = q.filter(Notification.user_id == user.id) if user else q.filter(Notification.student_id == student.id if student else -1)
    now = datetime.now(timezone.utc)
    count = q.update({"status": "read", "read_at": now}, synchronize_session=False)
    db.commit()
    return {"updated": count}
