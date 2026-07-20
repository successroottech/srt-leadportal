from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class StudentFeeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    student_id: int
    total_course_fee: float
    discount: float
    final_fee: float
    initial_payment: float
    balance_fee: float
    number_of_emis: int


class FeeEmiOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    emi_number: int
    amount: float
    due_date: date
    paid_amount: float
    status: str


class PaymentCreate(BaseModel):
    student_id: int
    amount: float
    payment_mode: str
    payment_date: date | None = None
    transaction_number: str | None = None
    remarks: str | None = None
    emi_id: int | None = None


class PaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    receipt_number: str
    student_id: int
    payment_date: date
    amount: float
    payment_mode: str
    transaction_number: str | None
    collected_by: int | None
    remarks: str | None
    created_at: datetime
