from datetime import date, datetime

from sqlalchemy import String, DateTime, Date, ForeignKey, Numeric, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Expense(Base):
    __tablename__ = "expenses"

    id: Mapped[int] = mapped_column(primary_key=True)
    expense_date: Mapped[date] = mapped_column(Date, nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    payment_mode: Mapped[str | None] = mapped_column(String(20))
    paid_to: Mapped[str | None] = mapped_column(String(150))
    invoice_file: Mapped[str | None] = mapped_column(String(255))
    entered_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    approval_status: Mapped[str] = mapped_column(String(20), default="pending")
    approved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    remarks: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
