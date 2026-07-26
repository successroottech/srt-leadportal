from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CourseCreate(BaseModel):
    name: str
    description: str | None = None
    duration_weeks: int | None = None
    regular_fee: float = 0
    offer_fee: float | None = None
    category: str | None = None


class CourseUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    duration_weeks: int | None = None
    regular_fee: float | None = None
    offer_fee: float | None = None
    category: str | None = None
    syllabus_file: str | None = None
    is_active: bool | None = None


class CourseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    course_code: str
    name: str
    description: str | None
    duration_weeks: int | None
    regular_fee: float
    offer_fee: float | None
    category: str | None
    syllabus_file: str | None
    image_file: str | None
    is_active: bool
    created_at: datetime


class SyllabusTopicIn(BaseModel):
    topic_name: str
    sequence: int = 0


class SyllabusModuleIn(BaseModel):
    module_name: str
    sequence: int = 0
    topics: list[SyllabusTopicIn] = []


class SyllabusTopicOut(SyllabusTopicIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class SyllabusModuleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    module_name: str
    sequence: int
    topics: list[SyllabusTopicOut] = []


class CourseMaterialCreate(BaseModel):
    title: str
    material_type: str
    file_path: str | None = None
    external_link: str | None = None


class CourseMaterialOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    course_id: int
    title: str
    material_type: str
    file_path: str | None
    external_link: str | None
    uploaded_by: int | None
    uploaded_at: datetime
