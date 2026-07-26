"""Add assigned_at timestamp to candidates for daily auto-assignment tracking

Revision ID: 0009
Revises: 0008
Create Date: 2026-07-26
"""
from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;")


def downgrade() -> None:
    op.execute("ALTER TABLE candidates DROP COLUMN IF EXISTS assigned_at;")
