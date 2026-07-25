from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AppSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    portal_name: str
    organization_name: str
    logo_path: str | None
    work_start_hour: int
    work_end_hour: int
    support_email: str | None
    support_phone: str | None
    address: str | None
    updated_at: datetime


class AppSettingsUpdate(BaseModel):
    portal_name: str | None = None
    organization_name: str | None = None
    logo_path: str | None = None
    work_start_hour: int | None = None
    work_end_hour: int | None = None
    support_email: str | None = None
    support_phone: str | None = None
    address: str | None = None
