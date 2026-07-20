from datetime import date, datetime, time

from sqlalchemy import String, DateTime, Date, Time, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class LeaveRequest(Base):
    __tablename__ = "leave_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"))
    request_kind: Mapped[str] = mapped_column(String(10), nullable=False)
    leave_type: Mapped[str | None] = mapped_column(String(30))
    permission_type: Mapped[str | None] = mapped_column(String(30))
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[time | None] = mapped_column(Time)
    end_time: Mapped[time | None] = mapped_column(Time)
    reason: Mapped[str | None] = mapped_column(Text)
    supporting_document: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    approved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    approval_remarks: Mapped[str | None] = mapped_column(Text)
    applied_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
