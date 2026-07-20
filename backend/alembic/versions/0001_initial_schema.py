"""Initial schema - creates all SRT Management Portal tables

Revision ID: 0001
Revises:
Create Date: 2026-07-20

Executes database/schema.sql (the canonical, hand-reviewed DDL for this
project) so there is a single source of truth for table definitions.
"""
from pathlib import Path

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

SCHEMA_FILE = Path(__file__).resolve().parents[3] / "database" / "schema.sql"


def upgrade() -> None:
    sql = SCHEMA_FILE.read_text()
    op.execute(sql)


def downgrade() -> None:
    op.execute(
        """
        DROP TABLE IF EXISTS
            audit_logs, feedback_complaints, notifications, expenses, leave_requests,
            student_attendance, staff_attendance, candidate_interviews, candidates,
            lead_followups, leads, payments, fee_emis, student_fees, student_documents,
            student_batch_history, students, class_sessions, batch_topics, batches,
            course_syllabus_topics, course_syllabus_modules, course_materials, courses,
            login_history, users, role_permissions, roles
        CASCADE;
        """
    )
