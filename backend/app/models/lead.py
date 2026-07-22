from datetime import date, datetime, time

from sqlalchemy import String, DateTime, Date, Time, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    mobile: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    alt_mobile: Mapped[str | None] = mapped_column(String(20))
    email: Mapped[str | None] = mapped_column(String(150))
    lead_type: Mapped[str] = mapped_column(String(20), default="course")
    interested_course_id: Mapped[int | None] = mapped_column(ForeignKey("courses.id"))
    source: Mapped[str] = mapped_column(String(30), default="other")
    assigned_telecaller_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(30), default="new")
    follow_up_date: Mapped[date | None] = mapped_column(Date)
    follow_up_time: Mapped[time | None] = mapped_column(Time)
    remarks: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_contacted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    converted_student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id"))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    followups: Mapped[list["LeadFollowup"]] = relationship(back_populates="lead", cascade="all, delete-orphan")


class LeadFollowup(Base):
    __tablename__ = "lead_followups"

    id: Mapped[int] = mapped_column(primary_key=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id", ondelete="CASCADE"))
    followup_date: Mapped[date | None] = mapped_column(Date)
    followup_time: Mapped[time | None] = mapped_column(Time)
    remarks: Mapped[str | None] = mapped_column(Text)
    status_at_time: Mapped[str | None] = mapped_column(String(30))
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    lead: Mapped["Lead"] = relationship(back_populates="followups")
