"""Add break tracking and heartbeat for live attendance monitoring

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-25
"""
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;")
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS staff_attendance_breaks (
            id                      SERIAL PRIMARY KEY,
            staff_attendance_id     INTEGER NOT NULL REFERENCES staff_attendance(id) ON DELETE CASCADE,
            break_start             TIMESTAMPTZ NOT NULL DEFAULT now(),
            break_end               TIMESTAMPTZ
        );
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS idx_staff_attendance_breaks_att ON staff_attendance_breaks(staff_attendance_id);")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS staff_attendance_breaks;")
    op.execute("ALTER TABLE staff_attendance DROP COLUMN IF EXISTS last_seen_at;")
