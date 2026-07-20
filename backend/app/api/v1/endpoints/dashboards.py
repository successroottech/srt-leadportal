from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import require_roles, get_current_user, get_current_student_profile
from app.db.session import get_db
from app.models.user import User
from app.models.role import Role
from app.models.course import Course
from app.models.batch import Batch, BatchTopic
from app.models.student import Student
from app.models.fee import StudentFee, FeeEmi, Payment
from app.models.lead import Lead
from app.models.candidate import Candidate
from app.models.attendance import StaffAttendance
from app.models.leave import LeaveRequest
from app.models.expense import Expense

router = APIRouter()


def _month_bounds(today: date):
    start = today.replace(day=1)
    if start.month == 12:
        next_start = start.replace(year=start.year + 1, month=1)
    else:
        next_start = start.replace(month=start.month + 1)
    return start, next_start


@router.get("/admin")
def admin_dashboard(db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    today = date.today()
    month_start, next_month = _month_bounds(today)

    total_staff = db.query(User).join(Role).filter(Role.name != "student").count()
    total_students = db.query(Student).count()
    total_trainers = db.query(User).join(Role).filter(Role.name == "trainer").count()
    total_telecallers = db.query(User).join(Role).filter(Role.name == "telecaller").count()
    active_courses = db.query(Course).filter(Course.is_active.is_(True)).count()
    active_batches = db.query(Batch).filter(Batch.status == "active").count()
    total_leads = db.query(Lead).count()
    today_followups = db.query(Lead).filter(Lead.follow_up_date == today).count()
    pending_followups = db.query(Lead).filter(Lead.follow_up_date < today, Lead.status.notin_(["converted", "not_interested", "closed", "invalid_number"])).count()
    month_admissions = db.query(Student).filter(Student.created_at >= month_start, Student.created_at < next_month).count()

    month_collection = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(
        Payment.payment_date >= month_start, Payment.payment_date < next_month
    ).scalar()
    overall_pending_fees = db.query(func.coalesce(func.sum(StudentFee.balance_fee), 0)).scalar()
    month_expenses = db.query(func.coalesce(func.sum(Expense.amount), 0)).filter(
        Expense.expense_date >= month_start, Expense.expense_date < next_month, Expense.approval_status == "approved"
    ).scalar()
    month_profit = float(month_collection) - float(month_expenses)

    present_today = db.query(StaffAttendance).filter(StaffAttendance.attendance_date == today, StaffAttendance.status.in_(["present", "late"])).count()
    absent_today = db.query(StaffAttendance).filter(StaffAttendance.attendance_date == today, StaffAttendance.status == "absent").count()
    on_leave_today = db.query(StaffAttendance).filter(StaffAttendance.attendance_date == today, StaffAttendance.status == "leave").count()

    completed_batches = db.query(Batch).filter(Batch.status == "completed").count()
    upcoming_fee_dues = db.query(FeeEmi).filter(FeeEmi.due_date > today, FeeEmi.due_date <= today + timedelta(days=7), FeeEmi.status != "paid").count()
    upcoming_batch_completions = db.query(Batch).filter(
        Batch.expected_completion_date > today, Batch.expected_completion_date <= today + timedelta(days=14), Batch.status == "active"
    ).count()

    return {
        "total_staff": total_staff,
        "total_students": total_students,
        "total_trainers": total_trainers,
        "total_telecallers": total_telecallers,
        "active_courses": active_courses,
        "active_batches": active_batches,
        "total_leads": total_leads,
        "todays_followups": today_followups,
        "pending_followups": pending_followups,
        "month_admissions": month_admissions,
        "month_fee_collection": float(month_collection),
        "overall_pending_fees": float(overall_pending_fees),
        "month_expenses": float(month_expenses),
        "month_profit": month_profit,
        "staff_present_today": present_today,
        "staff_absent_today": absent_today,
        "staff_on_leave_today": on_leave_today,
        "completed_batches": completed_batches,
        "upcoming_fee_dues_7d": upcoming_fee_dues,
        "upcoming_batch_completions_14d": upcoming_batch_completions,
    }


@router.get("/leads")
def leads_dashboard(db: Session = Depends(get_db), _: User = Depends(require_roles("admin", "hr"))):
    today = date.today()
    status_counts = dict(db.query(Lead.status, func.count()).group_by(Lead.status).all())
    telecaller_conversion = (
        db.query(Lead.assigned_telecaller_id, func.count().filter(Lead.status == "converted"), func.count())
        .group_by(Lead.assigned_telecaller_id)
        .all()
    )
    source_perf = dict(db.query(Lead.source, func.count()).group_by(Lead.source).all())
    course_perf = dict(
        db.query(Lead.interested_course_id, func.count()).group_by(Lead.interested_course_id).all()
    )
    return {
        "total_leads": db.query(Lead).count(),
        "status_breakdown": status_counts,
        "todays_followups": db.query(Lead).filter(Lead.follow_up_date == today).count(),
        "overdue_followups": db.query(Lead).filter(Lead.follow_up_date < today, Lead.status.notin_(["converted", "not_interested", "closed"])).count(),
        "telecaller_wise": [{"telecaller_id": t[0], "converted": t[1], "total": t[2]} for t in telecaller_conversion],
        "source_wise": source_perf,
        "course_wise": course_perf,
    }


@router.get("/attendance")
def attendance_dashboard(db: Session = Depends(get_db), _: User = Depends(require_roles("admin", "hr"))):
    today = date.today()
    present = db.query(StaffAttendance).filter(StaffAttendance.attendance_date == today, StaffAttendance.status.in_(["present", "late"])).count()
    absent = db.query(StaffAttendance).filter(StaffAttendance.attendance_date == today, StaffAttendance.status == "absent").count()
    on_leave = db.query(StaffAttendance).filter(StaffAttendance.attendance_date == today, StaffAttendance.status == "leave").count()
    late = db.query(StaffAttendance).filter(StaffAttendance.attendance_date == today, StaffAttendance.late_login.is_(True)).count()
    early = db.query(StaffAttendance).filter(StaffAttendance.attendance_date == today, StaffAttendance.early_logout.is_(True)).count()
    total_hours = db.query(func.coalesce(func.sum(StaffAttendance.total_hours), 0)).filter(StaffAttendance.attendance_date == today).scalar()
    return {
        "present_today": present,
        "absent_today": absent,
        "on_leave_today": on_leave,
        "late_logins_today": late,
        "early_logouts_today": early,
        "total_working_hours_today": float(total_hours),
    }


@router.get("/fees")
def fees_dashboard(db: Session = Depends(get_db), _: User = Depends(require_roles("admin", "hr"))):
    today = date.today()
    month_start, next_month = _month_bounds(today)
    prev_month_start = (month_start - timedelta(days=1)).replace(day=1)

    month_collected = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(Payment.payment_date >= month_start, Payment.payment_date < next_month).scalar()
    prev_month_pending = db.query(func.coalesce(func.sum(FeeEmi.amount - FeeEmi.paid_amount), 0)).filter(
        FeeEmi.due_date >= prev_month_start, FeeEmi.due_date < month_start, FeeEmi.status != "paid"
    ).scalar()

    total_admission_fees = db.query(func.coalesce(func.sum(StudentFee.final_fee), 0)).scalar()
    total_collected = db.query(func.coalesce(func.sum(Payment.amount), 0)).scalar()
    overall_remaining = db.query(func.coalesce(func.sum(StudentFee.balance_fee), 0)).scalar()

    today_dues = db.query(func.coalesce(func.sum(FeeEmi.amount - FeeEmi.paid_amount), 0)).filter(FeeEmi.due_date == today, FeeEmi.status != "paid").scalar()
    upcoming_dues = db.query(func.coalesce(func.sum(FeeEmi.amount - FeeEmi.paid_amount), 0)).filter(
        FeeEmi.due_date > today, FeeEmi.due_date <= today + timedelta(days=7), FeeEmi.status != "paid"
    ).scalar()
    overdue = db.query(func.coalesce(func.sum(FeeEmi.amount - FeeEmi.paid_amount), 0)).filter(FeeEmi.due_date < today, FeeEmi.status != "paid").scalar()

    payment_mode_summary = dict(db.query(Payment.payment_mode, func.coalesce(func.sum(Payment.amount), 0)).group_by(Payment.payment_mode).all())

    return {
        "month_expected_fees": float(month_collected) + float(overall_remaining),
        "month_collected_fees": float(month_collected),
        "prev_month_pending_fees": float(prev_month_pending),
        "total_admission_fees": float(total_admission_fees),
        "total_collected_amount": float(total_collected),
        "overall_remaining_amount": float(overall_remaining),
        "todays_fee_dues": float(today_dues),
        "upcoming_fee_dues_7d": float(upcoming_dues),
        "overdue_fees": float(overdue),
        "payment_mode_summary": {k: float(v) for k, v in payment_mode_summary.items()},
    }


@router.get("/profit")
def profit_dashboard(db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    today = date.today()
    month_start, next_month = _month_bounds(today)
    year_start = today.replace(month=1, day=1)

    def collected(start, end=None):
        q = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(Payment.payment_date >= start)
        if end:
            q = q.filter(Payment.payment_date < end)
        return float(q.scalar())

    def expenses(start, end=None):
        q = db.query(func.coalesce(func.sum(Expense.amount), 0)).filter(Expense.expense_date >= start, Expense.approval_status == "approved")
        if end:
            q = q.filter(Expense.expense_date < end)
        return float(q.scalar())

    daily_income = collected(today)
    monthly_income = collected(month_start, next_month)
    yearly_income = collected(year_start)
    daily_expenses = expenses(today)
    monthly_expenses = expenses(month_start, next_month)
    yearly_expenses = expenses(year_start)

    course_revenue = dict(
        db.query(Course.name, func.coalesce(func.sum(Payment.amount), 0))
        .join(Payment, Payment.course_id == Course.id)
        .group_by(Course.name)
        .all()
    )
    expense_category = dict(db.query(Expense.category, func.coalesce(func.sum(Expense.amount), 0)).filter(Expense.approval_status == "approved").group_by(Expense.category).all())

    return {
        "daily_income": daily_income,
        "monthly_income": monthly_income,
        "yearly_income": yearly_income,
        "daily_expenses": daily_expenses,
        "monthly_expenses": monthly_expenses,
        "yearly_expenses": yearly_expenses,
        "monthly_profit": monthly_income - monthly_expenses,
        "yearly_profit": yearly_income - yearly_expenses,
        "course_wise_revenue": {k: float(v) for k, v in course_revenue.items()},
        "expense_category_report": {k: float(v) for k, v in expense_category.items()},
    }


@router.get("/batches")
def batches_dashboard(db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    today = date.today()
    total = db.query(Batch).count()
    active = db.query(Batch).filter(Batch.status == "active").count()
    completed = db.query(Batch).filter(Batch.status == "completed").count()
    upcoming = db.query(Batch).filter(Batch.status == "upcoming").count()
    on_hold = db.query(Batch).filter(Batch.status == "on_hold").count()
    delayed = db.query(Batch).filter(Batch.status == "active", Batch.expected_completion_date < today).count()
    trainer_wise = dict(db.query(Batch.trainer_id, func.count()).group_by(Batch.trainer_id).all())
    course_wise = dict(db.query(Batch.course_id, func.count()).group_by(Batch.course_id).all())
    return {
        "total_batches": total, "active_batches": active, "completed_batches": completed,
        "upcoming_batches": upcoming, "on_hold_batches": on_hold, "delayed_batches": delayed,
        "trainer_wise": trainer_wise, "course_wise": course_wise,
    }


@router.get("/hr")
def hr_dashboard(db: Session = Depends(get_db), _: User = Depends(require_roles("admin", "hr"))):
    today = date.today()
    total_staff = db.query(User).join(Role).filter(Role.name != "student").count()
    present = db.query(StaffAttendance).filter(StaffAttendance.attendance_date == today, StaffAttendance.status.in_(["present", "late"])).count()
    absent = db.query(StaffAttendance).filter(StaffAttendance.attendance_date == today, StaffAttendance.status == "absent").count()
    on_leave = db.query(StaffAttendance).filter(StaffAttendance.attendance_date == today, StaffAttendance.status == "leave").count()
    pending_leaves = db.query(LeaveRequest).filter(LeaveRequest.status == "pending").count()
    total_candidates = db.query(Candidate).count()
    ready_for_interview = db.query(Candidate).filter(Candidate.status == "ready_for_interview").count()
    interviews_scheduled = db.query(Candidate).filter(Candidate.status == "interview_scheduled").count()
    selected = db.query(Candidate).filter(Candidate.status == "selected").count()
    joined = db.query(Candidate).filter(Candidate.status == "joined").count()
    return {
        "total_staff": total_staff,
        "staff_present_today": present,
        "staff_absent_today": absent,
        "staff_on_leave_today": on_leave,
        "pending_leave_approvals": pending_leaves,
        "total_candidates": total_candidates,
        "candidates_ready_for_interview": ready_for_interview,
        "interviews_scheduled": interviews_scheduled,
        "selected_candidates": selected,
        "joined_candidates": joined,
    }


@router.get("/telecaller")
def telecaller_dashboard(db: Session = Depends(get_db), current_user: User = Depends(require_roles("telecaller"))):
    today = date.today()
    month_start, next_month = _month_bounds(today)
    base = db.query(Lead).filter(Lead.assigned_telecaller_id == current_user.id)

    total_assigned = base.count()
    new_assigned = base.filter(Lead.status == "assigned").count()
    todays_followups = base.filter(Lead.follow_up_date == today).count()
    overdue_followups = base.filter(Lead.follow_up_date < today, Lead.status.notin_(["converted", "not_interested", "closed"])).count()
    interested = base.filter(Lead.status == "interested").count()
    demo_scheduled = base.filter(Lead.status == "demo_scheduled").count()
    converted = base.filter(Lead.status == "converted").count()
    not_interested = base.filter(Lead.status == "not_interested").count()
    month_converted = base.filter(Lead.status == "converted", Lead.updated_at >= month_start, Lead.updated_at < next_month).count()
    conversion_pct = round((converted / total_assigned) * 100, 2) if total_assigned else 0.0

    return {
        "total_assigned_leads": total_assigned,
        "new_assigned_leads": new_assigned,
        "todays_followups": todays_followups,
        "overdue_followups": overdue_followups,
        "interested_leads": interested,
        "demo_scheduled_leads": demo_scheduled,
        "converted_leads": converted,
        "not_interested_leads": not_interested,
        "month_conversion_count": month_converted,
        "conversion_percentage": conversion_pct,
    }


@router.get("/trainer")
def trainer_dashboard(db: Session = Depends(get_db), current_user: User = Depends(require_roles("trainer"))):
    today = date.today()
    base = db.query(Batch).filter(Batch.trainer_id == current_user.id)
    assigned = base.count()
    active = base.filter(Batch.status == "active").count()
    completed = base.filter(Batch.status == "completed").count()
    pending = base.filter(Batch.status.in_(["upcoming", "on_hold"])).count()

    batch_ids = [b.id for b in base.all()]
    total_students = db.query(Student).filter(Student.batch_id.in_(batch_ids or [-1])).count()
    topics = db.query(BatchTopic).filter(BatchTopic.batch_id.in_(batch_ids or [-1])).all()
    total_topics = len(topics)
    completed_topics = len([t for t in topics if t.status == "completed"])
    pending_topics = total_topics - completed_topics
    completion_pct = round((completed_topics / total_topics) * 100, 2) if total_topics else 0.0

    upcoming_completions = base.filter(Batch.expected_completion_date >= today, Batch.expected_completion_date <= today + timedelta(days=14)).count()

    return {
        "assigned_batches": assigned,
        "active_batches": active,
        "completed_batches": completed,
        "pending_batches": pending,
        "total_assigned_students": total_students,
        "batch_completion_percentage": completion_pct,
        "pending_topics": pending_topics,
        "upcoming_batch_completions": upcoming_completions,
    }


@router.get("/student")
def student_dashboard(db: Session = Depends(get_db), student=Depends(get_current_student_profile)):
    fee = db.query(StudentFee).filter(StudentFee.student_id == student.id).first()
    topics = db.query(BatchTopic).filter(BatchTopic.batch_id == student.batch_id).all() if student.batch_id else []
    total_topics = len(topics)
    completed_topics = len([t for t in topics if t.status == "completed"])
    pending_topics = total_topics - completed_topics
    completion_pct = round((completed_topics / total_topics) * 100, 2) if total_topics else 0.0

    from app.models.attendance import StudentAttendance
    attendance_rows = db.query(StudentAttendance).filter(StudentAttendance.student_id == student.id).all()
    present = len([a for a in attendance_rows if a.status in ("present", "late")])
    attendance_pct = round((present / len(attendance_rows)) * 100, 2) if attendance_rows else 0.0

    next_due = None
    if fee:
        pending_emis = sorted([e for e in fee.emis if e.status != "paid"], key=lambda e: e.due_date)
        next_due = pending_emis[0].due_date if pending_emis else None

    return {
        "student_name": student.name,
        "student_code": student.student_code,
        "course_id": student.course_id,
        "batch_id": student.batch_id,
        "course_status": student.course_status,
        "course_completion_percentage": completion_pct,
        "completed_topics": completed_topics,
        "pending_topics": pending_topics,
        "attendance_percentage": attendance_pct,
        "total_course_fee": float(fee.total_course_fee) if fee else 0,
        "paid_amount": float(fee.final_fee - fee.balance_fee) if fee else 0,
        "balance_amount": float(fee.balance_fee) if fee else 0,
        "next_fee_due_date": next_due,
    }
