from sqlalchemy.orm import Session

from app.models.audit import AuditLog


def log_action(
    db: Session,
    *,
    user_id: int | None = None,
    student_id: int | None = None,
    action: str,
    module: str,
    record_id=None,
    previous_value: dict | None = None,
    updated_value: dict | None = None,
    ip_address: str | None = None,
) -> None:
    entry = AuditLog(
        user_id=user_id,
        student_id=student_id,
        action=action,
        module=module,
        record_id=str(record_id) if record_id is not None else None,
        previous_value=previous_value,
        updated_value=updated_value,
        ip_address=ip_address,
    )
    db.add(entry)
