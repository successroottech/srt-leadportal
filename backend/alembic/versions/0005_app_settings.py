"""Add app_settings singleton table for portal branding and config

Revision ID: 0005
Revises: 0004
Create Date: 2026-07-25
"""
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS app_settings (
            id                  INTEGER PRIMARY KEY DEFAULT 1,
            portal_name         VARCHAR(150) NOT NULL DEFAULT 'SRT Management Portal',
            organization_name   VARCHAR(150) NOT NULL DEFAULT 'Success Root Technologies',
            logo_path           VARCHAR(255),
            work_start_hour     INTEGER NOT NULL DEFAULT 9,
            work_end_hour       INTEGER NOT NULL DEFAULT 18,
            support_email       VARCHAR(150),
            support_phone       VARCHAR(20),
            address             TEXT,
            updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT chk_app_settings_singleton CHECK (id = 1)
        );
        """
    )
    op.execute("INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS app_settings;")
