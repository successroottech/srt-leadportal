"""Extend the existing (unused) student_documents table for joining
letters, invoices, and certificates with title/amount/due_date/
issue_date/verification_code/created_by.

Revision ID: 0011
Revises: 0010
Create Date: 2026-07-27
"""
from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE student_documents ADD COLUMN IF NOT EXISTS title VARCHAR(150) NOT NULL DEFAULT '';")
    op.execute("ALTER TABLE student_documents ADD COLUMN IF NOT EXISTS amount NUMERIC(12,2);")
    op.execute("ALTER TABLE student_documents ADD COLUMN IF NOT EXISTS due_date DATE;")
    op.execute("ALTER TABLE student_documents ADD COLUMN IF NOT EXISTS issue_date DATE NOT NULL DEFAULT CURRENT_DATE;")
    op.execute("ALTER TABLE student_documents ADD COLUMN IF NOT EXISTS verification_code VARCHAR(40) UNIQUE NOT NULL;")
    op.execute("ALTER TABLE student_documents ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_student_documents_student ON student_documents(student_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_student_documents_code ON student_documents(verification_code);")


def downgrade() -> None:
    op.execute("ALTER TABLE student_documents DROP COLUMN IF EXISTS created_by;")
    op.execute("ALTER TABLE student_documents DROP COLUMN IF EXISTS verification_code;")
    op.execute("ALTER TABLE student_documents DROP COLUMN IF EXISTS issue_date;")
    op.execute("ALTER TABLE student_documents DROP COLUMN IF EXISTS due_date;")
    op.execute("ALTER TABLE student_documents DROP COLUMN IF EXISTS amount;")
    op.execute("ALTER TABLE student_documents DROP COLUMN IF EXISTS title;")
