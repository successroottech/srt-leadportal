"""Add staff_attendance_sessions to allow multiple login/logout pairs per day

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-25
"""
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS staff_attendance_sessions (
            id                      SERIAL PRIMARY KEY,
            staff_attendance_id     INTEGER NOT NULL REFERENCES staff_attendance(id) ON DELETE CASCADE,
            login_time              TIMESTAMPTZ NOT NULL DEFAULT now(),
            logout_time             TIMESTAMPTZ
        );
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS idx_staff_attendance_sessions_att ON staff_attendance_sessions(staff_attendance_id);")
    # Backfill: give every existing day-record with a login_time a corresponding
    # session row, so history predating this feature isn't orphaned.
    op.execute(
        """
        INSERT INTO staff_attendance_sessions (staff_attendance_id, login_time, logout_time)
        SELECT id, login_time, logout_time FROM staff_attendance
        WHERE login_time IS NOT NULL
          AND id NOT IN (SELECT DISTINCT staff_attendance_id FROM staff_attendance_sessions);
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS staff_attendance_sessions;")
