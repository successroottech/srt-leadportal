from datetime import datetime

from pydantic import BaseModel, ConfigDict, model_validator

MESSAGE_TYPES = ("text", "image", "document", "voice", "video")


class ChatMessageCreate(BaseModel):
    body: str | None = None
    message_type: str = "text"
    attachment_path: str | None = None
    attachment_name: str | None = None

    @model_validator(mode="after")
    def check_content(self):
        if not (self.body and self.body.strip()) and not self.attachment_path:
            raise ValueError("Message must have text or an attachment")
        if self.message_type not in MESSAGE_TYPES:
            raise ValueError(f"message_type must be one of {MESSAGE_TYPES}")
        return self


class ChatMessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    conversation_id: int
    sender_id: int
    sender_name: str | None = None
    sender_photo: str | None = None
    body: str | None
    message_type: str
    attachment_path: str | None
    attachment_name: str | None
    created_at: datetime


class ChatConversationCreate(BaseModel):
    type: str
    name: str | None = None
    other_user_id: int | None = None
    member_ids: list[int] = []

    @model_validator(mode="after")
    def check_shape(self):
        if self.type not in ("direct", "group"):
            raise ValueError("type must be 'direct' or 'group'")
        if self.type == "direct" and not self.other_user_id:
            raise ValueError("other_user_id is required for a direct conversation")
        if self.type == "group" and not self.name:
            raise ValueError("name is required for a group conversation")
        return self


class ChatParticipantOut(BaseModel):
    user_id: int
    name: str
    role: str
    is_admin: bool
    profile_photo: str | None = None
    is_online: bool = False


class ChatConversationOut(BaseModel):
    id: int
    type: str
    name: str | None
    image_path: str | None
    display_name: str
    display_photo: str | None
    created_at: datetime
    participants: list[ChatParticipantOut]
    last_message: ChatMessageOut | None
    unread_count: int


class AddParticipant(BaseModel):
    user_id: int


class ConversationUpdate(BaseModel):
    name: str | None = None
    image_path: str | None = None


class ReadReceipt(BaseModel):
    user_id: int
    last_read_message_id: int | None


class MessagesPage(BaseModel):
    messages: list[ChatMessageOut]
    read_receipts: list[ReadReceipt]


class StaffDirectoryEntry(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    role: str
    department: str | None
    profile_photo: str | None = None
    is_online: bool = False
