from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import require_roles, get_current_user
from app.core.security import hash_password
from app.db.session import get_db
from app.models.user import User
from app.models.role import Role
from app.models.lead import Lead, LeadFollowup
from app.models.student import Student
from app.schemas.lead import (
    LeadCreate, LeadUpdate, LeadOut, LeadAssign, LeadBulkAssign,
    LeadFollowupCreate, LeadFollowupOut, ConvertLeadRequest,
)
from app.schemas.student import StudentOut
from app.services.audit import log_action
from app.services.codegen import next_code
from app.services.fees import create_student_fee_record
from app.services.notify import notify_user

router = APIRouter()

MANAGE_ROLES = ("admin", "hr")
ALL_LEAD_ROLES = ("admin", "hr", "telecaller")


def _role_name(db: Session, user: User) -> str:
    role = db.get(Role, user.role_id)
    return role.name if role else ""


def _check_duplicate(db: Session, mobile: str, email: str | None, exclude_id: int | None = None):
    q = db.query(Lead).filter(Lead.mobile == mobile)
    if exclude_id:
        q = q.filter(Lead.id != exclude_id)
    existing = q.first()
    if not existing and email:
        existing = db.query(Lead).filter(Lead.email == email).first()
    return existing


@router.get("", response_model=list[LeadOut])
def list_leads(
    status: str | None = None,
    source: str | None = None,
    telecaller_id: int | None = None,
    course_id: int | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(*ALL_LEAD_ROLES)),
):
    q = db.query(Lead)
    role_name = _role_name(db, current_user)
    if role_name == "telecaller":
        q = q.filter(Lead.assigned_telecaller_id == current_user.id)
    elif telecaller_id:
        q = q.filter(Lead.assigned_telecaller_id == telecaller_id)
    if status:
        q = q.filter(Lead.status == status)
    if source:
        q = q.filter(Lead.source == source)
    if course_id:
        q = q.filter(Lead.interested_course_id == course_id)
    if search:
        like = f"%{search}%"
        q = q.filter((Lead.name.ilike(like)) | (Lead.mobile.ilike(like)))
    return q.order_by(Lead.id.desc()).all()


@router.get("/duplicate-check")
def duplicate_check(mobile: str | None = None, email: str | None = None, db: Session = Depends(get_db), _: User = Depends(require_roles(*ALL_LEAD_ROLES))):
    existing = _check_duplicate(db, mobile or "", email)
    if not existing:
        return {"duplicate": False}
    return {
        "duplicate": True,
        "lead": {
            "id": existing.id, "name": existing.name, "mobile": existing.mobile,
            "status": existing.status, "assigned_telecaller_id": existing.assigned_telecaller_id,
            "created_at": existing.created_at,
        },
    }


@router.post("", response_model=LeadOut)
def create_lead(payload: LeadCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(*ALL_LEAD_ROLES))):
    existing = _check_duplicate(db, payload.mobile, payload.email)
    if existing:
        raise HTTPException(status_code=409, detail={"message": "Duplicate lead", "existing_lead_id": existing.id})

    role_name = _role_name(db, user)
    assigned = payload.assigned_telecaller_id
    if role_name == "telecaller":
        assigned = user.id  # telecallers can only create leads assigned to themselves

    lead = Lead(
        name=payload.name, mobile=payload.mobile, alt_mobile=payload.alt_mobile, email=payload.email,
        interested_course_id=payload.interested_course_id, source=payload.source,
        assigned_telecaller_id=assigned, status="assigned" if assigned else "new",
        follow_up_date=payload.follow_up_date, follow_up_time=payload.follow_up_time,
        remarks=payload.remarks, created_by=user.id,
    )
    db.add(lead)
    db.flush()
    if assigned:
        notify_user(db, assigned, "New lead assigned", f"Lead {lead.name} has been assigned to you.", category="lead", reference_table="leads", reference_id=lead.id)
    log_action(db, user_id=user.id, action="create", module="leads", record_id=lead.id)
    db.commit()
    db.refresh(lead)
    return lead


@router.get("/{lead_id}", response_model=LeadOut)
def get_lead(lead_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_roles(*ALL_LEAD_ROLES))):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if _role_name(db, current_user) == "telecaller" and lead.assigned_telecaller_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only view your assigned leads")
    return lead


@router.put("/{lead_id}", response_model=LeadOut)
def update_lead(lead_id: int, payload: LeadUpdate, db: Session = Depends(get_db), current_user: User = Depends(require_roles(*ALL_LEAD_ROLES))):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    role_name = _role_name(db, current_user)
    if role_name == "telecaller" and lead.assigned_telecaller_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own leads")

    changes = payload.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(lead, field, value)
    if "status" in changes:
        lead.last_contacted_at = datetime.now(timezone.utc)
        db.add(LeadFollowup(lead_id=lead.id, followup_date=lead.follow_up_date, followup_time=lead.follow_up_time,
                             remarks=lead.remarks, status_at_time=lead.status, created_by=current_user.id))
    log_action(db, user_id=current_user.id, action="update", module="leads", record_id=lead.id)
    db.commit()
    db.refresh(lead)
    return lead


@router.delete("/{lead_id}")
def delete_lead(lead_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles(*MANAGE_ROLES))):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    db.delete(lead)
    log_action(db, user_id=user.id, action="delete", module="leads", record_id=lead_id)
    db.commit()
    return {"detail": "Lead deleted"}


@router.post("/{lead_id}/assign", response_model=LeadOut)
def assign_lead(lead_id: int, payload: LeadAssign, db: Session = Depends(get_db), user: User = Depends(require_roles(*MANAGE_ROLES))):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    lead.assigned_telecaller_id = payload.telecaller_id
    lead.status = "assigned" if lead.status == "new" else lead.status
    notify_user(db, payload.telecaller_id, "New lead assigned", f"Lead {lead.name} has been assigned to you.", category="lead", reference_table="leads", reference_id=lead.id)
    log_action(db, user_id=user.id, action="assign", module="leads", record_id=lead.id)
    db.commit()
    db.refresh(lead)
    return lead


@router.post("/bulk-assign")
def bulk_assign(payload: LeadBulkAssign, db: Session = Depends(get_db), user: User = Depends(require_roles(*MANAGE_ROLES))):
    leads = db.query(Lead).filter(Lead.id.in_(payload.lead_ids)).all()
    for lead in leads:
        lead.assigned_telecaller_id = payload.telecaller_id
        if lead.status == "new":
            lead.status = "assigned"
    notify_user(db, payload.telecaller_id, "Leads assigned", f"{len(leads)} leads have been assigned to you.", category="lead")
    log_action(db, user_id=user.id, action="assign", module="leads", record_id=None, updated_value={"count": len(leads)})
    db.commit()
    return {"detail": f"{len(leads)} leads assigned"}


@router.get("/{lead_id}/followups", response_model=list[LeadFollowupOut])
def get_followups(lead_id: int, db: Session = Depends(get_db), _: User = Depends(require_roles(*ALL_LEAD_ROLES))):
    return db.query(LeadFollowup).filter(LeadFollowup.lead_id == lead_id).order_by(LeadFollowup.created_at.desc()).all()


@router.post("/{lead_id}/followups", response_model=LeadFollowupOut)
def add_followup(lead_id: int, payload: LeadFollowupCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(*ALL_LEAD_ROLES))):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if _role_name(db, user) == "telecaller" and lead.assigned_telecaller_id != user.id:
        raise HTTPException(status_code=403, detail="You can only follow up on your own leads")

    followup = LeadFollowup(lead_id=lead_id, created_by=user.id, **payload.model_dump(exclude={"status"}))
    if payload.status:
        lead.status = payload.status
        followup.status_at_time = payload.status
    lead.follow_up_date = payload.followup_date or lead.follow_up_date
    lead.follow_up_time = payload.followup_time or lead.follow_up_time
    lead.last_contacted_at = datetime.now(timezone.utc)
    db.add(followup)
    log_action(db, user_id=user.id, action="update", module="lead_followups", record_id=lead_id)
    db.commit()
    db.refresh(followup)
    return followup


@router.post("/{lead_id}/convert", response_model=StudentOut)
def convert_lead(lead_id: int, payload: ConvertLeadRequest, db: Session = Depends(get_db), user: User = Depends(require_roles(*ALL_LEAD_ROLES))):
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    if lead.converted_student_id:
        raise HTTPException(status_code=400, detail="Lead already converted")

    student = Student(
        student_code=next_code(db, Student, Student.student_code, "SRT-STU-"),
        name=lead.name, mobile=lead.mobile, alt_mobile=lead.alt_mobile, email=lead.email,
        course_id=lead.interested_course_id, batch_id=payload.batch_id, lead_id=lead.id,
    )
    db.add(student)
    db.flush()

    if payload.create_login:
        role = db.query(Role).filter(Role.name == "student").first()
        account = User(name=lead.name, email=lead.email, mobile=lead.mobile,
                        password_hash=hash_password(payload.password or "Welcome@123"),
                        role_id=role.id, must_reset_password=True)
        db.add(account)
        db.flush()
        student.user_id = account.id

    create_student_fee_record(db, student.id, payload.total_course_fee, payload.discount, payload.initial_payment, payload.number_of_emis)

    lead.status = "converted"
    lead.converted_student_id = student.id
    log_action(db, user_id=user.id, action="update", module="leads", record_id=lead.id, updated_value={"status": "converted"})
    db.commit()
    db.refresh(student)
    return student
