from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.session import get_db
from app.models.user import User
from app.models.role import Role
from app.models.chat import ChatConversation, ChatMessage, ChatParticipant
from app.schemas.chat import (
    ChatMessageCreate, ChatMessageOut, ChatConversationCreate, ChatConversationOut,
    ChatParticipantOut, AddParticipant, StaffDirectoryEntry,
)

router = APIRouter()

STAFF_ROLES = ("admin", "hr", "telecaller", "trainer")


def _require_participant(db: Session, conversation_id: int, user_id: int) -> ChatParticipant:
    participant = (
        db.query(ChatParticipant)
        .filter(ChatParticipant.conversation_id == conversation_id, ChatParticipant.user_id == user_id)
        .first()
    )
    if not participant:
        raise HTTPException(status_code=403, detail="You are not part of this conversation")
    return participant


def _unread_count(db: Session, conversation_id: int, participant: ChatParticipant) -> int:
    q = db.query(func.count(ChatMessage.id)).filter(
        ChatMessage.conversation_id == conversation_id,
        ChatMessage.sender_id != participant.user_id,
    )
    if participant.last_read_message_id:
        q = q.filter(ChatMessage.id > participant.last_read_message_id)
    return q.scalar() or 0


def _serialize_message(db: Session, message: ChatMessage) -> ChatMessageOut:
    sender = db.get(User, message.sender_id)
    out = ChatMessageOut.model_validate(message)
    out.sender_name = sender.name if sender else None
    return out


def _serialize_conversation(db: Session, conversation: ChatConversation, viewer_id: int) -> ChatConversationOut:
    participants = db.query(ChatParticipant).filter(ChatParticipant.conversation_id == conversation.id).all()
    participant_out = []
    my_participant = None
    other_name = None
    for p in participants:
        user = db.get(User, p.user_id)
        if not user:
            continue
        role = db.get(Role, user.role_id)
        participant_out.append(ChatParticipantOut(user_id=user.id, name=user.name, role=role.name if role else "", is_admin=p.is_admin))
        if p.user_id == viewer_id:
            my_participant = p
        elif conversation.type == "direct":
            other_name = user.name

    if conversation.type == "group":
        display_name = conversation.name or "Group"
    else:
        display_name = other_name or "Direct message"

    last_message_row = (
        db.query(ChatMessage)
        .filter(ChatMessage.conversation_id == conversation.id)
        .order_by(ChatMessage.id.desc())
        .first()
    )
    last_message = _serialize_message(db, last_message_row) if last_message_row else None
    unread = _unread_count(db, conversation.id, my_participant) if my_participant else 0

    return ChatConversationOut(
        id=conversation.id, type=conversation.type, name=conversation.name, display_name=display_name,
        created_at=conversation.created_at, participants=participant_out,
        last_message=last_message, unread_count=unread,
    )


@router.get("/staff-directory", response_model=list[StaffDirectoryEntry])
def staff_directory(db: Session = Depends(get_db), current_user: User = Depends(require_roles(*STAFF_ROLES))):
    rows = (
        db.query(User)
        .join(Role)
        .filter(Role.name.in_(STAFF_ROLES), User.is_active.is_(True), User.id != current_user.id)
        .order_by(User.name)
        .all()
    )
    out = []
    for u in rows:
        role = db.get(Role, u.role_id)
        out.append(StaffDirectoryEntry(id=u.id, name=u.name, role=role.name if role else "", department=u.department))
    return out


@router.get("/conversations", response_model=list[ChatConversationOut])
def list_conversations(db: Session = Depends(get_db), current_user: User = Depends(require_roles(*STAFF_ROLES))):
    my_conv_ids = [p.conversation_id for p in db.query(ChatParticipant).filter(ChatParticipant.user_id == current_user.id).all()]
    if not my_conv_ids:
        return []
    conversations = db.query(ChatConversation).filter(ChatConversation.id.in_(my_conv_ids)).all()
    results = [_serialize_conversation(db, c, current_user.id) for c in conversations]
    results.sort(key=lambda c: c.last_message.created_at if c.last_message else c.created_at, reverse=True)
    return results


@router.post("/conversations", response_model=ChatConversationOut)
def create_conversation(payload: ChatConversationCreate, db: Session = Depends(get_db), current_user: User = Depends(require_roles(*STAFF_ROLES))):
    if payload.type == "direct":
        other = db.get(User, payload.other_user_id)
        if not other:
            raise HTTPException(status_code=404, detail="User not found")
        if other.id == current_user.id:
            raise HTTPException(status_code=400, detail="Cannot start a direct conversation with yourself")

        mine = db.query(ChatParticipant.conversation_id).filter(ChatParticipant.user_id == current_user.id)
        theirs = db.query(ChatParticipant.conversation_id).filter(ChatParticipant.user_id == other.id)
        shared_ids = {row[0] for row in mine} & {row[0] for row in theirs}
        if shared_ids:
            existing = (
                db.query(ChatConversation)
                .filter(ChatConversation.id.in_(shared_ids), ChatConversation.type == "direct")
                .first()
            )
            if existing:
                return _serialize_conversation(db, existing, current_user.id)

        conversation = ChatConversation(type="direct", created_by=current_user.id)
        db.add(conversation)
        db.flush()
        db.add(ChatParticipant(conversation_id=conversation.id, user_id=current_user.id))
        db.add(ChatParticipant(conversation_id=conversation.id, user_id=other.id))
        db.commit()
        return _serialize_conversation(db, conversation, current_user.id)

    # group
    member_ids = {m for m in payload.member_ids if m != current_user.id}
    members = db.query(User).filter(User.id.in_(member_ids)).all() if member_ids else []
    conversation = ChatConversation(type="group", name=payload.name, created_by=current_user.id)
    db.add(conversation)
    db.flush()
    db.add(ChatParticipant(conversation_id=conversation.id, user_id=current_user.id, is_admin=True))
    for m in members:
        db.add(ChatParticipant(conversation_id=conversation.id, user_id=m.id))
    db.commit()
    return _serialize_conversation(db, conversation, current_user.id)


@router.get("/conversations/{conversation_id}/messages", response_model=list[ChatMessageOut])
def list_messages(
    conversation_id: int, before_id: int | None = None, limit: int = 50,
    db: Session = Depends(get_db), current_user: User = Depends(require_roles(*STAFF_ROLES)),
):
    _require_participant(db, conversation_id, current_user.id)
    q = db.query(ChatMessage).filter(ChatMessage.conversation_id == conversation_id)
    if before_id:
        q = q.filter(ChatMessage.id < before_id)
    rows = q.order_by(ChatMessage.id.desc()).limit(min(limit, 100)).all()
    rows.reverse()
    return [_serialize_message(db, m) for m in rows]


@router.post("/conversations/{conversation_id}/messages", response_model=ChatMessageOut)
def send_message(
    conversation_id: int, payload: ChatMessageCreate,
    db: Session = Depends(get_db), current_user: User = Depends(require_roles(*STAFF_ROLES)),
):
    participant = _require_participant(db, conversation_id, current_user.id)
    message = ChatMessage(
        conversation_id=conversation_id, sender_id=current_user.id,
        body=payload.body, message_type=payload.message_type,
        attachment_path=payload.attachment_path, attachment_name=payload.attachment_name,
    )
    db.add(message)
    db.flush()
    participant.last_read_message_id = message.id
    db.commit()
    db.refresh(message)
    return _serialize_message(db, message)


@router.post("/conversations/{conversation_id}/read")
def mark_read(conversation_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_roles(*STAFF_ROLES))):
    participant = _require_participant(db, conversation_id, current_user.id)
    latest = (
        db.query(ChatMessage)
        .filter(ChatMessage.conversation_id == conversation_id)
        .order_by(ChatMessage.id.desc())
        .first()
    )
    if latest:
        participant.last_read_message_id = latest.id
        db.commit()
    return {"detail": "ok"}


@router.get("/unread-count")
def unread_count(db: Session = Depends(get_db), current_user: User = Depends(require_roles(*STAFF_ROLES))):
    participants = db.query(ChatParticipant).filter(ChatParticipant.user_id == current_user.id).all()
    total = sum(_unread_count(db, p.conversation_id, p) for p in participants)
    return {"count": total}


@router.post("/conversations/{conversation_id}/participants", response_model=ChatConversationOut)
def add_participant(
    conversation_id: int, payload: AddParticipant,
    db: Session = Depends(get_db), current_user: User = Depends(require_roles(*STAFF_ROLES)),
):
    conversation = db.get(ChatConversation, conversation_id)
    if not conversation or conversation.type != "group":
        raise HTTPException(status_code=404, detail="Group conversation not found")
    _require_participant(db, conversation_id, current_user.id)
    if not db.get(User, payload.user_id):
        raise HTTPException(status_code=404, detail="User not found")
    existing = (
        db.query(ChatParticipant)
        .filter(ChatParticipant.conversation_id == conversation_id, ChatParticipant.user_id == payload.user_id)
        .first()
    )
    if not existing:
        db.add(ChatParticipant(conversation_id=conversation_id, user_id=payload.user_id))
        db.commit()
    return _serialize_conversation(db, conversation, current_user.id)


@router.delete("/conversations/{conversation_id}/participants/{user_id}")
def remove_participant(
    conversation_id: int, user_id: int,
    db: Session = Depends(get_db), current_user: User = Depends(require_roles(*STAFF_ROLES)),
):
    conversation = db.get(ChatConversation, conversation_id)
    if not conversation or conversation.type != "group":
        raise HTTPException(status_code=404, detail="Group conversation not found")
    me = _require_participant(db, conversation_id, current_user.id)
    if user_id != current_user.id and not me.is_admin:
        raise HTTPException(status_code=403, detail="Only a group admin can remove other members")
    target = (
        db.query(ChatParticipant)
        .filter(ChatParticipant.conversation_id == conversation_id, ChatParticipant.user_id == user_id)
        .first()
    )
    if target:
        db.delete(target)
        db.commit()
    return {"detail": "Removed from group"}
