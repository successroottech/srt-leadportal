import random
from datetime import date

from dateutil.relativedelta import relativedelta
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.fee import FeeEmi, Payment, StudentFee


def _receipt_number() -> str:
    return f"RCPT-{date.today().strftime('%Y%m')}-{random.randint(10000, 99999)}"


def create_student_fee_record(
    db: Session, student_id: int, total_course_fee: float, discount: float,
    initial_payment: float, number_of_emis: int,
    course_id: int | None = None, payment_mode: str = "cash", receipt_file: str | None = None, remarks: str | None = None,
) -> StudentFee:
    final_fee = max(total_course_fee - discount, 0)
    balance_fee = max(final_fee - initial_payment, 0)

    fee = StudentFee(
        student_id=student_id,
        total_course_fee=total_course_fee,
        discount=discount,
        final_fee=final_fee,
        initial_payment=initial_payment,
        balance_fee=balance_fee,
        number_of_emis=number_of_emis,
    )
    db.add(fee)
    db.flush()

    # The initial payment is always mirrored as a real Payment row (not just the
    # informational StudentFee.initial_payment column) so recalculate_fee_balance's
    # payment-sum has the full picture from day one, however this student's fee record
    # was created (staff Add-student form or public self-registration).
    if initial_payment > 0:
        db.add(Payment(
            receipt_number=_receipt_number(),
            student_id=student_id,
            course_id=course_id,
            payment_date=date.today(),
            amount=initial_payment,
            payment_mode=payment_mode,
            remarks=remarks or "Initial payment",
            receipt_file=receipt_file,
        ))
        db.flush()

    if number_of_emis and balance_fee > 0:
        emi_amount = round(balance_fee / number_of_emis, 2)
        remaining = balance_fee
        due = date.today()
        for i in range(1, number_of_emis + 1):
            due = due + relativedelta(months=1)
            amount = emi_amount if i < number_of_emis else round(remaining, 2)
            remaining -= amount
            db.add(FeeEmi(student_fee_id=fee.id, emi_number=i, amount=amount, due_date=due))

    return fee


def recalculate_fee_balance(db: Session, fee: StudentFee) -> None:
    """Balance is driven entirely by the Payment ledger (initial payment included, since
    it's recorded as a Payment row too), so it stays correct whether or not an EMI
    schedule exists — flexible/partial payments collected with no emi_id still count."""
    total_payments = db.query(func.coalesce(func.sum(Payment.amount), 0)).filter(Payment.student_id == fee.student_id).scalar()
    fee.balance_fee = max(fee.final_fee - float(total_payments), 0)
