from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, EmailStr


class LeadCreate(BaseModel):
    name: str
    mobile: str
    alt_mobile: str | None = None
    email: EmailStr | None = None
    interested_course_id: int | None = None
    source: str = "other"
    assigned_telecaller_id: int | None = None
    follow_up_date: date | None = None
    follow_up_time: time | None = None
    remarks: str | None = None


class LeadUpdate(BaseModel):
    name: str | None = None
    alt_mobile: str | None = None
    email: EmailStr | None = None
    interested_course_id: int | None = None
    source: str | None = None
    status: str | None = None
    follow_up_date: date | None = None
    follow_up_time: time | None = None
    remarks: str | None = None


class LeadAssign(BaseModel):
    telecaller_id: int


class LeadBulkAssign(BaseModel):
    lead_ids: list[int]
    telecaller_id: int


class LeadFollowupCreate(BaseModel):
    followup_date: date | None = None
    followup_time: time | None = None
    remarks: str | None = None
    status: str | None = None


class LeadFollowupOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    followup_date: date | None
    followup_time: time | None
    remarks: str | None
    status_at_time: str | None
    created_by: int | None
    created_at: datetime


class LeadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    mobile: str
    alt_mobile: str | None
    email: str | None
    interested_course_id: int | None
    source: str
    assigned_telecaller_id: int | None
    status: str
    follow_up_date: date | None
    follow_up_time: time | None
    remarks: str | None
    created_at: datetime
    last_contacted_at: datetime | None
    converted_student_id: int | None


class ConvertLeadRequest(BaseModel):
    batch_id: int | None = None
    total_course_fee: float = 0
    discount: float = 0
    initial_payment: float = 0
    number_of_emis: int = 0
    create_login: bool = True
    password: str | None = None
