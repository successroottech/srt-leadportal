from datetime import datetime

from sqlalchemy import String, DateTime, ForeignKey, BigInteger, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    student_id: Mapped[int | None] = mapped_column(ForeignKey("students.id"))
    action: Mapped[str] = mapped_column(String(30), nullable=False)
    module: Mapped[str] = mapped_column(String(50), nullable=False)
    record_id: Mapped[str | None] = mapped_column(String(50))
    previous_value: Mapped[dict | None] = mapped_column(JSONB)
    updated_value: Mapped[dict | None] = mapped_column(JSONB)
    ip_address: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
