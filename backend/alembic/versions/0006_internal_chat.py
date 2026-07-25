"""Add internal chat: conversations, messages, participants

Revision ID: 0006
Revises: 0005
Create Date: 2026-07-25
"""
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_conversations (
            id              SERIAL PRIMARY KEY,
            type            VARCHAR(10) NOT NULL CHECK (type IN ('direct', 'group')),
            name            VARCHAR(150),
            created_by      INTEGER REFERENCES users(id),
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_messages (
            id                  BIGSERIAL PRIMARY KEY,
            conversation_id     INTEGER NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
            sender_id           INTEGER NOT NULL REFERENCES users(id),
            body                TEXT,
            message_type        VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (message_type IN
                ('text', 'image', 'document', 'voice', 'video')),
            attachment_path     VARCHAR(255),
            attachment_name     VARCHAR(255),
            created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT chk_chat_message_content CHECK (body IS NOT NULL OR attachment_path IS NOT NULL)
        );
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id, created_at);")
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_participants (
            id                      SERIAL PRIMARY KEY,
            conversation_id         INTEGER NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
            user_id                 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            is_admin                BOOLEAN NOT NULL DEFAULT FALSE,
            last_read_message_id    BIGINT REFERENCES chat_messages(id) ON DELETE SET NULL,
            joined_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_chat_participant UNIQUE (conversation_id, user_id)
        );
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS idx_chat_participants_user ON chat_participants(user_id);")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS chat_participants;")
    op.execute("DROP TABLE IF EXISTS chat_messages;")
    op.execute("DROP TABLE IF EXISTS chat_conversations;")
