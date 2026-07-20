from datetime import date, datetime

from sqlalchemy import String, DateTime, Date, ForeignKey, Numeric, Integer, Text, func, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class StudentFee(Base):
    __tablename__ = "student_fees"

    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id", ondelete="CASCADE"), unique=True)
    total_course_fee: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    discount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    final_fee: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    initial_payment: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    balance_fee: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    number_of_emis: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    student: Mapped["Student"] = relationship(back_populates="fee")
    emis: Mapped[list["FeeEmi"]] = relationship(back_populates="student_fee", cascade="all, delete-orphan")


class FeeEmi(Base):
    __tablename__ = "fee_emis"
    __table_args__ = (UniqueConstraint("student_fee_id", "emi_number", name="uq_fee_emi_number"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    student_fee_id: Mapped[int] = mapped_column(ForeignKey("student_fees.id", ondelete="CASCADE"))
    emi_number: Mapped[int] = mapped_column(Integer, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    paid_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    status: Mapped[str] = mapped_column(String(20), default="pending")

    student_fee: Mapped["StudentFee"] = relationship(back_populates="emis")


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    receipt_number: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    course_id: Mapped[int | None] = mapped_column(ForeignKey("courses.id"))
    payment_date: Mapped[date] = mapped_column(Date)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    payment_mode: Mapped[str] = mapped_column(String(20), nullable=False)
    transaction_number: Mapped[str | None] = mapped_column(String(100))
    collected_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    remarks: Mapped[str | None] = mapped_column(Text)
    receipt_file: Mapped[str | None] = mapped_column(String(255))
    emi_id: Mapped[int | None] = mapped_column(ForeignKey("fee_emis.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
