from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict


class LeaveRequestCreate(BaseModel):
    request_kind: str  # leave | permission
    leave_type: str | None = None
    permission_type: str | None = None
    start_date: date
    end_date: date
    start_time: time | None = None
    end_time: time | None = None
    reason: str | None = None


class LeaveDecision(BaseModel):
    status: str  # approved | rejected
    approval_remarks: str | None = None


class LeaveRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int | None
    student_id: int | None
    request_kind: str
    leave_type: str | None
    permission_type: str | None
    start_date: date
    end_date: date
    start_time: time | None
    end_time: time | None
    reason: str | None
    status: str
    approved_by: int | None
    approval_remarks: str | None
    applied_at: datetime
    decided_at: datetime | None
