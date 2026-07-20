from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class ExpenseCreate(BaseModel):
    expense_date: date
    category: str
    description: str | None = None
    amount: float
    payment_mode: str | None = None
    paid_to: str | None = None
    remarks: str | None = None


class ExpenseUpdate(BaseModel):
    expense_date: date | None = None
    category: str | None = None
    description: str | None = None
    amount: float | None = None
    payment_mode: str | None = None
    paid_to: str | None = None
    remarks: str | None = None


class ExpenseDecision(BaseModel):
    approval_status: str  # approved | rejected
    remarks: str | None = None


class ExpenseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    expense_date: date
    category: str
    description: str | None
    amount: float
    payment_mode: str | None
    paid_to: str | None
    entered_by: int | None
    approval_status: str
    approved_by: int | None
    remarks: str | None
    created_at: datetime
