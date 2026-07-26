"""Add trainer handoff field to candidates

Revision ID: 0008
Revises: 0007
Create Date: 2026-07-26
"""
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS assigned_trainer_id INTEGER REFERENCES users(id);")


def downgrade() -> None:
    op.execute("ALTER TABLE candidates DROP COLUMN IF EXISTS assigned_trainer_id;")
