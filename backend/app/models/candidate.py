from datetime import date, datetime

from sqlalchemy import String, DateTime, Date, ForeignKey, Numeric, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Candidate(Base):
    __tablename__ = "candidates"

    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    mobile: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    email: Mapped[str | None] = mapped_column(String(150))
    qualification: Mapped[str | None] = mapped_column(String(150))
    skills: Mapped[str | None] = mapped_column(Text)
    experience: Mapped[str | None] = mapped_column(String(100))
    preferred_job_role: Mapped[str | None] = mapped_column(String(150))
    preferred_location: Mapped[str | None] = mapped_column(String(150))
    resume_file: Mapped[str | None] = mapped_column(String(255))
    assigned_telecaller_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    assigned_trainer_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(30), default="new")
    follow_up_date: Mapped[date | None] = mapped_column(Date)
    remarks: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    interviews: Mapped[list["CandidateInterview"]] = relationship(back_populates="candidate", cascade="all, delete-orphan")


class CandidateInterview(Base):
    __tablename__ = "candidate_interviews"

    id: Mapped[int] = mapped_column(primary_key=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidates.id", ondelete="CASCADE"))
    interview_date: Mapped[date | None] = mapped_column(Date)
    company: Mapped[str | None] = mapped_column(String(150))
    job_role: Mapped[str | None] = mapped_column(String(150))
    status: Mapped[str] = mapped_column(String(30), default="scheduled")
    salary_package: Mapped[float | None] = mapped_column(Numeric(12, 2))
    remarks: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    candidate: Mapped["Candidate"] = relationship(back_populates="interviews")
