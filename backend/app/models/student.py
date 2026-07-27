from datetime import date, datetime

from sqlalchemy import String, Boolean, DateTime, Date, ForeignKey, Numeric, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), unique=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    mobile: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    alt_mobile: Mapped[str | None] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(150))
    dob: Mapped[date | None] = mapped_column(Date)
    gender: Mapped[str | None] = mapped_column(String(20))
    address: Mapped[str | None] = mapped_column(Text)
    father_name: Mapped[str | None] = mapped_column(String(150))
    portal_ref: Mapped[str | None] = mapped_column(String(100))
    qualification: Mapped[str | None] = mapped_column(String(150))
    college_name: Mapped[str | None] = mapped_column(String(150))
    graduation_year: Mapped[int | None] = mapped_column(Integer)
    profile_photo: Mapped[str | None] = mapped_column(String(255))
    admission_type: Mapped[str] = mapped_column(String(30), default="course")
    course_id: Mapped[int | None] = mapped_column(ForeignKey("courses.id"))
    batch_id: Mapped[int | None] = mapped_column(ForeignKey("batches.id"))
    joining_date: Mapped[date | None] = mapped_column(Date)
    expected_completion_date: Mapped[date | None] = mapped_column(Date)
    actual_completion_date: Mapped[date | None] = mapped_column(Date)
    course_status: Mapped[str] = mapped_column(String(30), default="ongoing")
    placement_required: Mapped[bool] = mapped_column(Boolean, default=False)
    resume_status: Mapped[str | None] = mapped_column(String(30))
    interview_status: Mapped[str | None] = mapped_column(String(30))
    selected_company: Mapped[str | None] = mapped_column(String(150))
    job_role: Mapped[str | None] = mapped_column(String(150))
    job_joining_date: Mapped[date | None] = mapped_column(Date)
    salary_package: Mapped[float | None] = mapped_column(Numeric(12, 2))
    placement_status: Mapped[str] = mapped_column(String(30), default="not_applicable")
    lead_id: Mapped[int | None] = mapped_column(ForeignKey("leads.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    fee: Mapped["StudentFee"] = relationship(back_populates="student", uselist=False, cascade="all, delete-orphan")


class StudentBatchHistory(Base):
    __tablename__ = "student_batch_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"))
    batch_id: Mapped[int] = mapped_column(ForeignKey("batches.id"))
    action: Mapped[str] = mapped_column(String(20), nullable=False)
    remarks: Mapped[str | None] = mapped_column(Text)
    changed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class StudentDocument(Base):
    __tablename__ = "student_documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"))
    document_type: Mapped[str] = mapped_column(String(100), nullable=False)
    title: Mapped[str] = mapped_column(String(150), nullable=False, default="")
    file_path: Mapped[str] = mapped_column(String(255), nullable=False)
    amount: Mapped[float | None] = mapped_column(Numeric(12, 2))
    due_date: Mapped[date | None] = mapped_column(Date)
    issue_date: Mapped[date] = mapped_column(Date, server_default=func.current_date())
    verification_code: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
