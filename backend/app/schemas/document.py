from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class InvoiceCreate(BaseModel):
    student_id: int
    title: str
    amount: float
    due_date: date | None = None


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    student_id: int
    document_type: str
    title: str
    file_path: str | None
    amount: float | None
    due_date: date | None
    issue_date: date
    verification_code: str
    uploaded_at: datetime


class VerificationOut(BaseModel):
    valid: bool
    document_type: str | None = None
    title: str | None = None
    student_name: str | None = None
    student_code: str | None = None
    issue_date: date | None = None
