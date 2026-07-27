"""Add invoice_number/payment_date/payment_made/mode to student_documents

Revision ID: 0012
Revises: 0011
Create Date: 2026-07-27
"""
from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE student_documents ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(30);")
    op.execute("ALTER TABLE student_documents ADD COLUMN IF NOT EXISTS payment_date DATE;")
    op.execute("ALTER TABLE student_documents ADD COLUMN IF NOT EXISTS payment_made NUMERIC(12,2);")
    op.execute("ALTER TABLE student_documents ADD COLUMN IF NOT EXISTS mode VARCHAR(30);")


def downgrade() -> None:
    op.execute("ALTER TABLE student_documents DROP COLUMN IF EXISTS mode;")
    op.execute("ALTER TABLE student_documents DROP COLUMN IF EXISTS payment_made;")
    op.execute("ALTER TABLE student_documents DROP COLUMN IF EXISTS payment_date;")
    op.execute("ALTER TABLE student_documents DROP COLUMN IF EXISTS invoice_number;")
