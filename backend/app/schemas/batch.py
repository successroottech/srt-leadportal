from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict


class BatchCreate(BaseModel):
    name: str
    course_id: int
    trainer_id: int | None = None
    start_date: date | None = None
    expected_completion_date: date | None = None
    batch_start_time: time | None = None
    batch_end_time: time | None = None
    class_days: str | None = None
    batch_mode: str = "offline"
    location: str | None = None


class BatchUpdate(BaseModel):
    name: str | None = None
    trainer_id: int | None = None
    start_date: date | None = None
    expected_completion_date: date | None = None
    actual_completion_date: date | None = None
    batch_start_time: time | None = None
    batch_end_time: time | None = None
    class_days: str | None = None
    batch_mode: str | None = None
    location: str | None = None
    status: str | None = None


class BatchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    batch_code: str
    name: str
    course_id: int
    trainer_id: int | None
    start_date: date | None
    expected_completion_date: date | None
    actual_completion_date: date | None
    batch_start_time: time | None
    batch_end_time: time | None
    class_days: str | None
    batch_mode: str
    location: str | None
    status: str
    created_at: datetime


class BatchTopicUpdate(BaseModel):
    status: str | None = None
    actual_completion_date: date | None = None
    completion_percentage: float | None = None
    notes: str | None = None
    materials: str | None = None


class BatchTopicOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    batch_id: int
    module_name: str
    topic_name: str
    sequence: int
    planned_date: date | None
    actual_completion_date: date | None
    status: str
    completion_percentage: float
    notes: str | None
    materials: str | None


class ClassSessionCreate(BaseModel):
    class_date: date
    planned_start_time: time | None = None
    planned_end_time: time | None = None


class ClassSessionUpdate(BaseModel):
    actual_start_time: time | None = None
    actual_end_time: time | None = None
    status: str | None = None
    topics_covered: str | None = None
    trainer_remarks: str | None = None
    admin_remarks: str | None = None


class ClassSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    batch_id: int
    class_date: date
    planned_start_time: time | None
    planned_end_time: time | None
    actual_start_time: time | None
    actual_end_time: time | None
    status: str
    topics_covered: str | None
    trainer_remarks: str | None
    admin_remarks: str | None
