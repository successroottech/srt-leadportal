from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.session import get_db
from app.models.user import User
from app.models.audit import AuditLog

router = APIRouter()


@router.get("")
def list_audit_logs(
    module: str | None = None,
    user_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = 200,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles("admin")),
):
    q = db.query(AuditLog)
    if module:
        q = q.filter(AuditLog.module == module)
    if user_id:
        q = q.filter(AuditLog.user_id == user_id)
    if date_from:
        q = q.filter(AuditLog.created_at >= date_from)
    if date_to:
        q = q.filter(AuditLog.created_at <= date_to)
    rows = q.order_by(AuditLog.created_at.desc()).limit(min(limit, 1000)).all()
    return [
        {
            "id": r.id, "user_id": r.user_id, "student_id": r.student_id, "action": r.action,
            "module": r.module, "record_id": r.record_id, "previous_value": r.previous_value,
            "updated_value": r.updated_value, "ip_address": r.ip_address, "created_at": r.created_at,
        }
        for r in rows
    ]
