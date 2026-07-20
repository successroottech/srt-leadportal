from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import require_roles, get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.role import Role
from app.models.batch import Batch, BatchTopic, ClassSession
from app.models.course import CourseSyllabusModule
from app.models.student import Student
from app.schemas.batch import (
    BatchCreate, BatchUpdate, BatchOut, BatchTopicUpdate, BatchTopicOut,
    ClassSessionCreate, ClassSessionUpdate, ClassSessionOut,
)
from app.services.audit import log_action
from app.services.codegen import next_code

router = APIRouter()

ADMIN_ROLES = ("admin",)


def _visible_batches(db: Session, current_user: User):
    role = db.get(Role, current_user.role_id)
    q = db.query(Batch)
    if role and role.name == "trainer":
        q = q.filter(Batch.trainer_id == current_user.id)
    return q


@router.get("", response_model=list[BatchOut])
def list_batches(
    status: str | None = None,
    course_id: int | None = None,
    trainer_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = _visible_batches(db, current_user)
    if status:
        q = q.filter(Batch.status == status)
    if course_id:
        q = q.filter(Batch.course_id == course_id)
    if trainer_id:
        q = q.filter(Batch.trainer_id == trainer_id)
    return q.order_by(Batch.id.desc()).all()


@router.post("", response_model=BatchOut)
def create_batch(payload: BatchCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(*ADMIN_ROLES))):
    batch = Batch(batch_code=next_code(db, Batch, Batch.batch_code, "SRT-BAT-"), **payload.model_dump())
    db.add(batch)
    db.flush()

    # clone course syllabus into batch_topics so progress can be tracked per-batch
    modules = (
        db.query(CourseSyllabusModule)
        .filter(CourseSyllabusModule.course_id == payload.course_id)
        .order_by(CourseSyllabusModule.sequence)
        .all()
    )
    for m in modules:
        for t in sorted(m.topics, key=lambda x: x.sequence):
            db.add(BatchTopic(batch_id=batch.id, module_name=m.module_name, topic_name=t.topic_name, sequence=t.sequence))

    log_action(db, user_id=user.id, action="create", module="batches", record_id=batch.id)
    db.commit()
    db.refresh(batch)
    return batch


@router.get("/{batch_id}", response_model=BatchOut)
def get_batch(batch_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    batch = db.get(Batch, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


@router.put("/{batch_id}", response_model=BatchOut)
def update_batch(batch_id: int, payload: BatchUpdate, db: Session = Depends(get_db), user: User = Depends(require_roles(*ADMIN_ROLES))):
    batch = db.get(Batch, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(batch, field, value)
    log_action(db, user_id=user.id, action="update", module="batches", record_id=batch.id)
    db.commit()
    db.refresh(batch)
    return batch


@router.delete("/{batch_id}")
def delete_batch(batch_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles(*ADMIN_ROLES))):
    batch = db.get(Batch, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    db.delete(batch)
    log_action(db, user_id=user.id, action="delete", module="batches", record_id=batch_id)
    db.commit()
    return {"detail": "Batch deleted"}


@router.get("/{batch_id}/students")
def batch_students(batch_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    rows = db.query(Student).filter(Student.batch_id == batch_id).all()
    return [{"id": s.id, "student_code": s.student_code, "name": s.name, "mobile": s.mobile} for s in rows]


@router.get("/{batch_id}/topics", response_model=list[BatchTopicOut])
def batch_topics(batch_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(BatchTopic).filter(BatchTopic.batch_id == batch_id).order_by(BatchTopic.sequence).all()


@router.put("/{batch_id}/topics/{topic_id}", response_model=BatchTopicOut)
def update_batch_topic(
    batch_id: int, topic_id: int, payload: BatchTopicUpdate,
    db: Session = Depends(get_db), user: User = Depends(require_roles("admin", "trainer")),
):
    topic = db.get(BatchTopic, topic_id)
    if not topic or topic.batch_id != batch_id:
        raise HTTPException(status_code=404, detail="Topic not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(topic, field, value)
    log_action(db, user_id=user.id, action="update", module="batch_topics", record_id=topic.id)
    db.commit()
    db.refresh(topic)
    return topic


@router.get("/{batch_id}/progress")
def batch_progress(batch_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    topics = db.query(BatchTopic).filter(BatchTopic.batch_id == batch_id).all()
    total = len(topics)
    completed = len([t for t in topics if t.status == "completed"])
    pending = total - completed
    pct = round((completed / total) * 100, 2) if total else 0.0
    return {"total_topics": total, "completed_topics": completed, "pending_topics": pending, "completion_percentage": pct}


@router.get("/{batch_id}/sessions", response_model=list[ClassSessionOut])
def list_sessions(batch_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(ClassSession).filter(ClassSession.batch_id == batch_id).order_by(ClassSession.class_date.desc()).all()


@router.post("/{batch_id}/sessions", response_model=ClassSessionOut)
def create_session(batch_id: int, payload: ClassSessionCreate, db: Session = Depends(get_db), user: User = Depends(require_roles("admin", "trainer"))):
    if db.query(ClassSession).filter(ClassSession.batch_id == batch_id, ClassSession.class_date == payload.class_date).first():
        raise HTTPException(status_code=400, detail="Session already exists for this date")
    session = ClassSession(batch_id=batch_id, **payload.model_dump())
    db.add(session)
    log_action(db, user_id=user.id, action="create", module="class_sessions", record_id=None)
    db.commit()
    db.refresh(session)
    return session


@router.put("/{batch_id}/sessions/{session_id}", response_model=ClassSessionOut)
def update_session(
    batch_id: int, session_id: int, payload: ClassSessionUpdate,
    db: Session = Depends(get_db), user: User = Depends(require_roles("admin", "trainer")),
):
    session = db.get(ClassSession, session_id)
    if not session or session.batch_id != batch_id:
        raise HTTPException(status_code=404, detail="Session not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(session, field, value)
    log_action(db, user_id=user.id, action="update", module="class_sessions", record_id=session.id)
    db.commit()
    db.refresh(session)
    return session
