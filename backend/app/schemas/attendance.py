from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class StaffAttendanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    attendance_date: date
    login_time: datetime | None
    logout_time: datetime | None
    total_hours: float | None
    late_login: bool
    early_logout: bool
    status: str


class StudentAttendanceMark(BaseModel):
    student_id: int
    status: str
    remarks: str | None = None


class StudentAttendanceBulk(BaseModel):
    batch_id: int
    attendance_date: date
    class_session_id: int | None = None
    records: list[StudentAttendanceMark]


class StudentAttendanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    student_id: int
    batch_id: int
    attendance_date: date
    status: str
    remarks: str | None
