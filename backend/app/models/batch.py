from datetime import date, datetime, time

from sqlalchemy import String, DateTime, Date, Time, ForeignKey, Numeric, Integer, Text, func, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Batch(Base):
    __tablename__ = "batches"

    id: Mapped[int] = mapped_column(primary_key=True)
    batch_code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"))
    trainer_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    start_date: Mapped[date | None] = mapped_column(Date)
    expected_completion_date: Mapped[date | None] = mapped_column(Date)
    actual_completion_date: Mapped[date | None] = mapped_column(Date)
    batch_start_time: Mapped[time | None] = mapped_column(Time)
    batch_end_time: Mapped[time | None] = mapped_column(Time)
    class_days: Mapped[str | None] = mapped_column(String(100))
    batch_mode: Mapped[str] = mapped_column(String(20), default="offline")
    location: Mapped[str | None] = mapped_column(String(150))
    status: Mapped[str] = mapped_column(String(20), default="upcoming")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    topics: Mapped[list["BatchTopic"]] = relationship(back_populates="batch", cascade="all, delete-orphan")


class BatchTopic(Base):
    __tablename__ = "batch_topics"

    id: Mapped[int] = mapped_column(primary_key=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("batches.id", ondelete="CASCADE"))
    module_name: Mapped[str] = mapped_column(String(150), nullable=False)
    topic_name: Mapped[str] = mapped_column(String(150), nullable=False)
    sequence: Mapped[int] = mapped_column(Integer, default=0)
    planned_date: Mapped[date | None] = mapped_column(Date)
    actual_completion_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="not_started")
    completion_percentage: Mapped[float] = mapped_column(Numeric(5, 2), default=0)
    notes: Mapped[str | None] = mapped_column(Text)
    materials: Mapped[str | None] = mapped_column(String(255))

    batch: Mapped["Batch"] = relationship(back_populates="topics")


class ClassSession(Base):
    __tablename__ = "class_sessions"
    __table_args__ = (UniqueConstraint("batch_id", "class_date", name="uq_batch_class_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("batches.id", ondelete="CASCADE"))
    class_date: Mapped[date] = mapped_column(Date, nullable=False)
    planned_start_time: Mapped[time | None] = mapped_column(Time)
    planned_end_time: Mapped[time | None] = mapped_column(Time)
    actual_start_time: Mapped[time | None] = mapped_column(Time)
    actual_end_time: Mapped[time | None] = mapped_column(Time)
    status: Mapped[str] = mapped_column(String(20), default="scheduled")
    topics_covered: Mapped[str | None] = mapped_column(Text)
    trainer_remarks: Mapped[str | None] = mapped_column(Text)
    admin_remarks: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
