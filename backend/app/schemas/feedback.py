from datetime import datetime

from pydantic import BaseModel, ConfigDict


class FeedbackCreate(BaseModel):
    type: str
    subject: str
    description: str | None = None
    rating: int | None = None


class FeedbackResponse(BaseModel):
    status: str
    admin_response: str | None = None


class FeedbackOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    student_id: int
    type: str
    subject: str
    description: str | None
    rating: int | None
    attachment: str | None
    status: str
    admin_response: str | None
    created_at: datetime
    updated_at: datetime
