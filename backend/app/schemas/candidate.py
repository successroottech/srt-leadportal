from datetime import date, datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.common import OptionalEmail


class CandidateCreate(BaseModel):
    name: str
    mobile: str
    email: OptionalEmail = None
    qualification: str | None = None
    skills: str | None = None
    experience: str | None = None
    preferred_job_role: str | None = None
    preferred_location: str | None = None
    assigned_telecaller_id: int | None = None
    follow_up_date: date | None = None
    remarks: str | None = None


class CandidateUpdate(BaseModel):
    name: str | None = None
    email: OptionalEmail = None
    qualification: str | None = None
    skills: str | None = None
    experience: str | None = None
    preferred_job_role: str | None = None
    preferred_location: str | None = None
    status: str | None = None
    follow_up_date: date | None = None
    remarks: str | None = None


class CandidateBulkAssign(BaseModel):
    candidate_ids: list[int]
    telecaller_id: int


class CandidateBulkAssignTrainer(BaseModel):
    candidate_ids: list[int]
    trainer_id: int


class CandidateCloseAssignments(BaseModel):
    scope: str  # "today" or "stale"
    telecaller_id: int | None = None  # admin/hr may close on behalf of a telecaller


class CandidateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    candidate_code: str
    name: str
    mobile: str
    email: str | None
    qualification: str | None
    skills: str | None
    experience: str | None
    preferred_job_role: str | None
    preferred_location: str | None
    resume_file: str | None
    assigned_telecaller_id: int | None
    assigned_trainer_id: int | None
    assigned_at: datetime | None
    status: str
    follow_up_date: date | None
    remarks: str | None
    created_at: datetime


class InterviewCreate(BaseModel):
    interview_date: date | None = None
    company: str | None = None
    job_role: str | None = None
    status: str = "scheduled"
    salary_package: float | None = None
    remarks: str | None = None


class InterviewOut(InterviewCreate):
    model_config = ConfigDict(from_attributes=True)
    id: int
    candidate_id: int
