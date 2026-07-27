import random
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.deps import require_roles, get_current_user, get_current_student_profile
from app.db.session import get_db
from app.models.user import User
from app.models.student import Student
from app.models.fee import StudentFee, FeeEmi, Payment
from app.schemas.fee import StudentFeeOut, FeeEmiOut, PaymentCreate, PaymentOut
from app.services.audit import log_action
from app.services.documents import create_invoice_document
from app.services.fees import recalculate_fee_balance
from app.services.notify import notify_student

router = APIRouter()

STAFF_ROLES = ("admin", "hr")


def _apply_payment_to_emi(db: Session, fee: StudentFee, amount: float, emi_id: int | None):
    amount = Decimal(str(amount))
    if emi_id:
        emi = db.get(FeeEmi, emi_id)
        if emi and emi.student_fee_id == fee.id:
            emi.paid_amount += amount
            emi.status = "paid" if emi.paid_amount >= emi.amount else "partial"
    else:
        remaining = amount
        for emi in sorted(fee.emis, key=lambda e: e.emi_number):
            if remaining <= 0:
                break
            if emi.status == "paid":
                continue
            due = emi.amount - emi.paid_amount
            applied = min(due, remaining)
            emi.paid_amount += applied
            emi.status = "paid" if emi.paid_amount >= emi.amount else "partial"
            remaining -= applied


@router.get("/student/{student_id}", response_model=StudentFeeOut)
def get_student_fee(student_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    fee = db.query(StudentFee).filter(StudentFee.student_id == student_id).first()
    if not fee:
        raise HTTPException(status_code=404, detail="Fee record not found")
    return fee


@router.get("/student/{student_id}/emis", response_model=list[FeeEmiOut])
def get_student_emis(student_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    fee = db.query(StudentFee).filter(StudentFee.student_id == student_id).first()
    if not fee:
        raise HTTPException(status_code=404, detail="Fee record not found")
    return sorted(fee.emis, key=lambda e: e.emi_number)


@router.get("/student/{student_id}/payments", response_model=list[PaymentOut])
def get_student_payments(student_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(Payment).filter(Payment.student_id == student_id).order_by(Payment.payment_date.desc()).all()


@router.post("/payments", response_model=PaymentOut)
def record_payment(payload: PaymentCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(*STAFF_ROLES))):
    student = db.get(Student, payload.student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    fee = db.query(StudentFee).filter(StudentFee.student_id == student.id).first()
    if not fee:
        raise HTTPException(status_code=404, detail="Fee record not found")

    receipt_number = f"RCPT-{date.today().strftime('%Y%m')}-{random.randint(10000, 99999)}"
    payment = Payment(
        receipt_number=receipt_number,
        student_id=student.id,
        course_id=student.course_id,
        payment_date=payload.payment_date or date.today(),
        amount=payload.amount,
        payment_mode=payload.payment_mode,
        transaction_number=payload.transaction_number,
        collected_by=user.id,
        remarks=payload.remarks,
        emi_id=payload.emi_id,
    )
    db.add(payment)

    db.flush()
    _apply_payment_to_emi(db, fee, payload.amount, payload.emi_id)
    recalculate_fee_balance(db, fee)
    create_invoice_document(db, student, created_by=user.id)

    if student.user_id:
        pass
    notify_student(db, student.id, "Payment received", f"We received a payment of {payload.amount} against receipt {receipt_number}.", category="fee")

    log_action(db, user_id=user.id, action="create", module="payments", record_id=None, updated_value={"amount": payload.amount})
    db.commit()
    db.refresh(payment)
    return payment


@router.get("/dues/today")
def dues_today(db: Session = Depends(get_db), _: User = Depends(require_roles(*STAFF_ROLES))):
    rows = db.query(FeeEmi).filter(FeeEmi.due_date == date.today(), FeeEmi.status != "paid").all()
    return _emi_rows(db, rows)


@router.get("/dues/upcoming")
def dues_upcoming(days: int = 7, db: Session = Depends(get_db), _: User = Depends(require_roles(*STAFF_ROLES))):
    from datetime import timedelta
    end = date.today() + timedelta(days=days)
    rows = db.query(FeeEmi).filter(FeeEmi.due_date > date.today(), FeeEmi.due_date <= end, FeeEmi.status != "paid").all()
    return _emi_rows(db, rows)


@router.get("/dues/overdue")
def dues_overdue(db: Session = Depends(get_db), _: User = Depends(require_roles(*STAFF_ROLES))):
    rows = db.query(FeeEmi).filter(FeeEmi.due_date < date.today(), FeeEmi.status != "paid").all()
    return _emi_rows(db, rows)


def _emi_rows(db: Session, rows: list[FeeEmi]):
    out = []
    for emi in rows:
        fee = db.get(StudentFee, emi.student_fee_id)
        student = db.get(Student, fee.student_id) if fee else None
        out.append({
            "emi_id": emi.id, "student_id": student.id if student else None,
            "student_name": student.name if student else None,
            "due_date": emi.due_date, "amount": emi.amount, "paid_amount": emi.paid_amount, "status": emi.status,
        })
    return out


@router.get("/my/summary")
def my_fee_summary(student=Depends(get_current_student_profile), db: Session = Depends(get_db)):
    fee = db.query(StudentFee).filter(StudentFee.student_id == student.id).first()
    if not fee:
        return {}
    emis = sorted(fee.emis, key=lambda e: e.emi_number)
    next_due = next((e for e in emis if e.status != "paid"), None)
    return {
        "total_course_fee": fee.total_course_fee,
        "discount": fee.discount,
        "final_fee": fee.final_fee,
        "paid_amount": fee.final_fee - fee.balance_fee,
        "balance_fee": fee.balance_fee,
        "next_due_date": next_due.due_date if next_due else None,
        "emis": [{"emi_number": e.emi_number, "amount": e.amount, "due_date": e.due_date, "paid_amount": e.paid_amount, "status": e.status} for e in emis],
    }


@router.get("/my/payments", response_model=list[PaymentOut])
def my_payments(student=Depends(get_current_student_profile), db: Session = Depends(get_db)):
    return db.query(Payment).filter(Payment.student_id == student.id).order_by(Payment.payment_date.desc()).all()
