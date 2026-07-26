"""Add father_name/portal_ref to students for public registration

Revision ID: 0010
Revises: 0009
Create Date: 2026-07-26
"""
from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE students ADD COLUMN IF NOT EXISTS father_name VARCHAR(150);")
    op.execute("ALTER TABLE students ADD COLUMN IF NOT EXISTS portal_ref VARCHAR(100);")


def downgrade() -> None:
    op.execute("ALTER TABLE students DROP COLUMN IF EXISTS portal_ref;")
    op.execute("ALTER TABLE students DROP COLUMN IF EXISTS father_name;")
