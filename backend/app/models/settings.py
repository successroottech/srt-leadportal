from datetime import datetime

from sqlalchemy import String, DateTime, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class AppSettings(Base):
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    portal_name: Mapped[str] = mapped_column(String(150), default="SRT Management Portal")
    organization_name: Mapped[str] = mapped_column(String(150), default="Success Root Technologies")
    logo_path: Mapped[str | None] = mapped_column(String(255))
    work_start_hour: Mapped[int] = mapped_column(Integer, default=9)
    work_end_hour: Mapped[int] = mapped_column(Integer, default=18)
    support_email: Mapped[str | None] = mapped_column(String(150))
    support_phone: Mapped[str | None] = mapped_column(String(20))
    address: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
