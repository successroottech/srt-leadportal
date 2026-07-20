from datetime import date
from dateutil.relativedelta import relativedelta

from sqlalchemy.orm import Session

from app.models.fee import StudentFee, FeeEmi


def create_student_fee_record(
    db: Session, student_id: int, total_course_fee: float, discount: float,
    initial_payment: float, number_of_emis: int,
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
    emi_paid = sum(e.paid_amount for e in fee.emis) if fee.emis else 0
    total_paid = fee.initial_payment + emi_paid
    fee.balance_fee = max(fee.final_fee - total_paid, 0)
