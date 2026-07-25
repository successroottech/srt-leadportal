"""Daily proactive in-app notification reminders.

Invoked once per day by a systemd timer (see send_reminders.py) rather than an
in-process scheduler, since the API runs under multiple Gunicorn workers and an
in-process scheduler would fire once per worker and create duplicate notifications.

Each check is idempotent for a given day: it looks up whether a matching
Notification already exists for the (user/student, category, reference) before
inserting, so re-running the script the same day is harmless.
"""
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.models.lead import Lead
from app.models.fee import FeeEmi, StudentFee
from app.models.student import Student
from app.models.batch import Batch
from app.models.role import Role
from app.models.user import User
from app.models.notification import Notification


def _already_sent(db: Session, *, category: str, reference_table: str, reference_id: int,
                   user_id: int | None = None, student_id: int | None = None, today: date) -> bool:
    q = db.query(Notification).filter(
        Notification.category == category,
        Notification.reference_table == reference_table,
        Notification.reference_id == reference_id,
        Notification.created_at >= today,
    )
    if user_id is not None:
        q = q.filter(Notification.user_id == user_id)
    if student_id is not None:
        q = q.filter(Notification.student_id == student_id)
    return q.first() is not None


def remind_lead_followups(db: Session, today: date) -> int:
    """Telecallers get an in-app reminder for each lead followup due today."""
    count = 0
    leads = db.query(Lead).filter(
        Lead.follow_up_date == today,
        Lead.assigned_telecaller_id.isnot(None),
        Lead.status.notin_(["converted", "not_interested", "closed", "invalid_number"]),
    ).all()
    for lead in leads:
        if _already_sent(db, category="lead_followup", reference_table="leads", reference_id=lead.id,
                          user_id=lead.assigned_telecaller_id, today=today):
            continue
        db.add(Notification(
            user_id=lead.assigned_telecaller_id,
            title="Lead follow-up due today",
            message=f"Follow up with {lead.name} ({lead.mobile}) today.",
            category="lead_followup", reference_table="leads", reference_id=lead.id,
        ))
        count += 1
    return count


def remind_fee_dues(db: Session, today: date) -> int:
    """Students get a reminder for EMIs due within 3 days or overdue; admins get an overdue summary."""
    count = 0
    upcoming = db.query(FeeEmi).filter(
        FeeEmi.due_date >= today, FeeEmi.due_date <= today + timedelta(days=3), FeeEmi.status != "paid",
    ).all()
    overdue = db.query(FeeEmi).filter(FeeEmi.due_date < today, FeeEmi.status != "paid").all()

    for emi in upcoming + overdue:
        fee = db.get(StudentFee, emi.student_fee_id)
        if not fee:
            continue
        student = db.get(Student, fee.student_id)
        if not student or not student.user_id:
            continue
        is_overdue = emi.due_date < today
        title = "Fee payment overdue" if is_overdue else "Fee payment due soon"
        message = f"EMI #{emi.emi_number} of ₹{emi.amount} was due on {emi.due_date}." if is_overdue \
            else f"EMI #{emi.emi_number} of ₹{emi.amount} is due on {emi.due_date}."
        if _already_sent(db, category="fee_due", reference_table="fee_emis", reference_id=emi.id,
                          student_id=student.id, today=today):
            continue
        db.add(Notification(
            student_id=student.id, title=title, message=message,
            category="fee_due", reference_table="fee_emis", reference_id=emi.id,
        ))
        count += 1

    if overdue:
        admin_ids = [u.id for u in db.query(User).join(Role).filter(Role.name.in_(["admin", "hr"])).all()]
        for admin_id in admin_ids:
            if _already_sent(db, category="fee_overdue_summary", reference_table="fee_emis", reference_id=0,
                              user_id=admin_id, today=today):
                continue
            db.add(Notification(
                user_id=admin_id, title="Overdue fee EMIs",
                message=f"{len(overdue)} EMI installment(s) are overdue as of today.",
                category="fee_overdue_summary", reference_table="fee_emis", reference_id=0,
            ))
            count += 1
    return count


def remind_batch_completion(db: Session, today: date) -> int:
    """Trainers get a reminder when their batch's expected completion date is within 7 days."""
    count = 0
    batches = db.query(Batch).filter(
        Batch.status == "active",
        Batch.trainer_id.isnot(None),
        Batch.expected_completion_date.isnot(None),
        Batch.expected_completion_date >= today,
        Batch.expected_completion_date <= today + timedelta(days=7),
    ).all()
    for batch in batches:
        if _already_sent(db, category="batch_closing", reference_table="batches", reference_id=batch.id,
                          user_id=batch.trainer_id, today=today):
            continue
        days_left = (batch.expected_completion_date - today).days
        db.add(Notification(
            user_id=batch.trainer_id,
            title="Batch nearing completion",
            message=f"Batch {batch.name} is expected to complete in {days_left} day(s) ({batch.expected_completion_date}).",
            category="batch_closing", reference_table="batches", reference_id=batch.id,
        ))
        count += 1
    return count


def run_daily_reminders(db: Session) -> dict:
    today = date.today()
    result = {
        "lead_followups": remind_lead_followups(db, today),
        "fee_dues": remind_fee_dues(db, today),
        "batch_closing": remind_batch_completion(db, today),
    }
    db.commit()
    return result
