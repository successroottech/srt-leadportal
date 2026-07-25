from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.common import OptionalEmail


class StaffCreate(BaseModel):
    name: str
    email: OptionalEmail = None
    mobile: str | None = None
    alt_mobile: str | None = None
    password: str
    role_id: int
    department: str | None = None
    joining_date: date | None = None
    salary: float | None = None
    address: str | None = None
    employment_status: str = "active"


class StaffUpdate(BaseModel):
    name: str | None = None
    email: OptionalEmail = None
    mobile: str | None = None
    alt_mobile: str | None = None
    role_id: int | None = None
    department: str | None = None
    joining_date: date | None = None
    salary: float | None = None
    address: str | None = None
    employment_status: str | None = None
    is_active: bool | None = None


class StaffOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    staff_code: str | None
    name: str
    email: str | None
    mobile: str | None
    alt_mobile: str | None
    role_id: int
    department: str | None
    joining_date: date | None
    salary: float | None
    address: str | None
    profile_photo: str | None
    employment_status: str
    is_active: bool
    last_login_at: datetime | None
    created_at: datetime
