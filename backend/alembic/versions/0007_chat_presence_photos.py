"""Add presence heartbeat column and group photo support

Revision ID: 0007
Revises: 0006
Create Date: 2026-07-26
"""
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;")
    op.execute("ALTER TABLE chat_conversations ADD COLUMN IF NOT EXISTS image_path VARCHAR(255);")


def downgrade() -> None:
    op.execute("ALTER TABLE chat_conversations DROP COLUMN IF EXISTS image_path;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS last_active_at;")
