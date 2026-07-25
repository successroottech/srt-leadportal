from datetime import date, datetime

from sqlalchemy import String, Boolean, DateTime, Date, ForeignKey, Numeric, Integer, Text, func, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class StaffAttendance(Base):
    __tablename__ = "staff_attendance"
    __table_args__ = (UniqueConstraint("user_id", "attendance_date", name="uq_staff_attendance_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    attendance_date: Mapped[date] = mapped_column(Date, nullable=False)
    login_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    logout_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    total_hours: Mapped[float | None] = mapped_column(Numeric(5, 2))
    late_login: Mapped[bool] = mapped_column(Boolean, default=False)
    early_logout: Mapped[bool] = mapped_column(Boolean, default=False)
    break_minutes: Mapped[int] = mapped_column(Integer, default=0)
    overtime_hours: Mapped[float] = mapped_column(Numeric(5, 2), default=0)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(20), default="present")


class StaffAttendanceBreak(Base):
    __tablename__ = "staff_attendance_breaks"

    id: Mapped[int] = mapped_column(primary_key=True)
    staff_attendance_id: Mapped[int] = mapped_column(ForeignKey("staff_attendance.id", ondelete="CASCADE"))
    break_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    break_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class StaffAttendanceSession(Base):
    __tablename__ = "staff_attendance_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    staff_attendance_id: Mapped[int] = mapped_column(ForeignKey("staff_attendance.id", ondelete="CASCADE"))
    login_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    logout_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class StudentAttendance(Base):
    __tablename__ = "student_attendance"
    __table_args__ = (UniqueConstraint("student_id", "batch_id", "attendance_date", name="uq_student_attendance_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"))
    batch_id: Mapped[int] = mapped_column(ForeignKey("batches.id"))
    class_session_id: Mapped[int | None] = mapped_column(ForeignKey("class_sessions.id", ondelete="SET NULL"))
    attendance_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="present")
    remarks: Mapped[str | None] = mapped_column(Text)
    marked_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
