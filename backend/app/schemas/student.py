from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, field_validator

from app.schemas.common import OptionalEmail

MAX_EMI_COUNT = 12


class StudentCreate(BaseModel):
    name: str
    mobile: str
    alt_mobile: str | None = None
    email: OptionalEmail = None
    dob: date | None = None
    gender: str | None = None
    address: str | None = None
    father_name: str | None = None
    portal_ref: str | None = None
    qualification: str | None = None
    college_name: str | None = None
    graduation_year: int | None = None
    admission_type: str = "course"
    course_id: int | None = None
    batch_id: int | None = None
    joining_date: date | None = None
    expected_completion_date: date | None = None
    placement_required: bool = False
    lead_id: int | None = None
    create_login: bool = True
    password: str | None = None
    total_course_fee: float = 0
    discount: float = 0
    initial_payment: float = 0
    number_of_emis: int = 0
    first_invoice_due_date: date | None = None

    @field_validator("number_of_emis")
    @classmethod
    def validate_emi_count(cls, value: int) -> int:
        if value < 0 or value > MAX_EMI_COUNT:
            raise ValueError(f"number_of_emis must be 0 (pay in full) or between 1 and {MAX_EMI_COUNT}")
        return value


class StudentUpdate(BaseModel):
    name: str | None = None
    mobile: str | None = None
    alt_mobile: str | None = None
    email: OptionalEmail = None
    dob: date | None = None
    gender: str | None = None
    address: str | None = None
    father_name: str | None = None
    portal_ref: str | None = None
    profile_photo: str | None = None
    qualification: str | None = None
    college_name: str | None = None
    graduation_year: int | None = None
    admission_type: str | None = None
    course_id: int | None = None
    batch_id: int | None = None
    joining_date: date | None = None
    expected_completion_date: date | None = None
    actual_completion_date: date | None = None
    course_status: str | None = None
    placement_required: bool | None = None
    resume_status: str | None = None
    interview_status: str | None = None
    selected_company: str | None = None
    job_role: str | None = None
    job_joining_date: date | None = None
    salary_package: float | None = None
    placement_status: str | None = None
    is_active: bool | None = None


class StudentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    student_code: str
    name: str
    mobile: str
    alt_mobile: str | None
    email: str | None
    dob: date | None
    gender: str | None
    address: str | None
    father_name: str | None
    portal_ref: str | None
    profile_photo: str | None
    qualification: str | None
    college_name: str | None
    graduation_year: int | None
    admission_type: str
    course_id: int | None
    batch_id: int | None
    joining_date: date | None
    expected_completion_date: date | None
    actual_completion_date: date | None
    course_status: str
    placement_required: bool
    resume_status: str | None
    interview_status: str | None
    selected_company: str | None
    job_role: str | None
    job_joining_date: date | None
    salary_package: float | None
    placement_status: str
    is_active: bool
    created_at: datetime
    balance_fee: float | None = None
    next_fee_due_date: date | None = None
    fee_status: str | None = None


class TransferBatchRequest(BaseModel):
    new_batch_id: int
    remarks: str | None = None
