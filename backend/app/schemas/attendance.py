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
    break_minutes: int
    last_seen_at: datetime | None
    status: str


class StaffAttendanceSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    login_time: datetime
    logout_time: datetime | None


class StaffAttendanceTodayOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    is_logged_in: bool
    sessions: list[StaffAttendanceSessionOut]
    break_minutes: int
    total_hours: float | None
    last_seen_at: datetime | None
    status: str
    on_break: bool
    active_break_start: datetime | None


class LiveAttendanceEntry(BaseModel):
    user_id: int
    name: str
    role: str
    login_time: datetime
    break_minutes: int
    last_seen_at: datetime | None
    on_break: bool
    active_break_start: datetime | None


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
