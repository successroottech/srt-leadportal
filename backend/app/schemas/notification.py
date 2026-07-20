from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    message: str | None
    category: str | None
    reference_table: str | None
    reference_id: int | None
    status: str
    created_at: datetime
    read_at: datetime | None
