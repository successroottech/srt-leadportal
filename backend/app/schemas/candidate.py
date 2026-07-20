from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr


class CandidateCreate(BaseModel):
    name: str
    mobile: str
    email: EmailStr | None = None
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
    email: EmailStr | None = None
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
