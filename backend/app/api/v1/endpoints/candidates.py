from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.session import get_db
from app.models.user import User
from app.models.role import Role
from app.models.candidate import Candidate, CandidateInterview
from app.schemas.candidate import (
    CandidateCreate, CandidateUpdate, CandidateOut, CandidateBulkAssign,
    InterviewCreate, InterviewOut,
)
from app.services.audit import log_action
from app.services.codegen import next_code
from app.services.notify import notify_user

router = APIRouter()

MANAGE_ROLES = ("admin", "hr")
ALL_ROLES = ("admin", "hr", "telecaller")


def _role_name(db: Session, user: User) -> str:
    role = db.get(Role, user.role_id)
    return role.name if role else ""


def _check_duplicate(db: Session, mobile: str, email: str | None):
    existing = db.query(Candidate).filter(Candidate.mobile == mobile).first()
    if not existing and email:
        existing = db.query(Candidate).filter(Candidate.email == email).first()
    return existing


@router.get("", response_model=list[CandidateOut])
def list_candidates(status: str | None = None, telecaller_id: int | None = None, search: str | None = None,
                     db: Session = Depends(get_db), current_user: User = Depends(require_roles(*ALL_ROLES))):
    q = db.query(Candidate)
    if _role_name(db, current_user) == "telecaller":
        q = q.filter(Candidate.assigned_telecaller_id == current_user.id)
    elif telecaller_id:
        q = q.filter(Candidate.assigned_telecaller_id == telecaller_id)
    if status:
        q = q.filter(Candidate.status == status)
    if search:
        like = f"%{search}%"
        q = q.filter((Candidate.name.ilike(like)) | (Candidate.mobile.ilike(like)))
    return q.order_by(Candidate.id.desc()).all()


@router.post("", response_model=CandidateOut)
def create_candidate(payload: CandidateCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(*ALL_ROLES))):
    if _check_duplicate(db, payload.mobile, payload.email):
        raise HTTPException(status_code=409, detail="A candidate with this mobile/email already exists")
    candidate = Candidate(candidate_code=next_code(db, Candidate, Candidate.candidate_code, "SRT-CAN-"), **payload.model_dump())
    db.add(candidate)
    db.flush()
    if candidate.assigned_telecaller_id:
        notify_user(db, candidate.assigned_telecaller_id, "New candidate assigned", f"Candidate {candidate.name} assigned to you.", category="candidate")
    log_action(db, user_id=user.id, action="create", module="candidates", record_id=candidate.id)
    db.commit()
    db.refresh(candidate)
    return candidate


@router.get("/{candidate_id}", response_model=CandidateOut)
def get_candidate(candidate_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles(*ALL_ROLES))):
    candidate = db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate


@router.put("/{candidate_id}", response_model=CandidateOut)
def update_candidate(candidate_id: int, payload: CandidateUpdate, db: Session = Depends(get_db), user: User = Depends(require_roles(*ALL_ROLES))):
    candidate = db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(candidate, field, value)
    log_action(db, user_id=user.id, action="update", module="candidates", record_id=candidate.id)
    db.commit()
    db.refresh(candidate)
    return candidate


@router.delete("/{candidate_id}")
def delete_candidate(candidate_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles(*MANAGE_ROLES))):
    candidate = db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    db.delete(candidate)
    log_action(db, user_id=user.id, action="delete", module="candidates", record_id=candidate_id)
    db.commit()
    return {"detail": "Candidate deleted"}


@router.post("/bulk-assign")
def bulk_assign(payload: CandidateBulkAssign, db: Session = Depends(get_db), user: User = Depends(require_roles(*MANAGE_ROLES))):
    candidates = db.query(Candidate).filter(Candidate.id.in_(payload.candidate_ids)).all()
    for c in candidates:
        c.assigned_telecaller_id = payload.telecaller_id
        if c.status == "new":
            c.status = "assigned"
    notify_user(db, payload.telecaller_id, "Candidates assigned", f"{len(candidates)} candidates assigned to you.", category="candidate")
    log_action(db, user_id=user.id, action="assign", module="candidates", record_id=None, updated_value={"count": len(candidates)})
    db.commit()
    return {"detail": f"{len(candidates)} candidates assigned"}


@router.get("/{candidate_id}/interviews", response_model=list[InterviewOut])
def list_interviews(candidate_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles(*ALL_ROLES))):
    return db.query(CandidateInterview).filter(CandidateInterview.candidate_id == candidate_id).order_by(CandidateInterview.interview_date.desc()).all()


@router.post("/{candidate_id}/interviews", response_model=InterviewOut)
def schedule_interview(candidate_id: int, payload: InterviewCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(*ALL_ROLES))):
    candidate = db.get(Candidate, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    interview = CandidateInterview(candidate_id=candidate_id, **payload.model_dump())
    db.add(interview)
    candidate.status = "interview_scheduled"
    log_action(db, user_id=user.id, action="create", module="candidate_interviews", record_id=candidate_id)
    db.commit()
    db.refresh(interview)
    return interview
