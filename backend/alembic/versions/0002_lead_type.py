"""Add lead_type to leads (course / job / internal_staff)

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-22
"""
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE leads
            ADD COLUMN IF NOT EXISTS lead_type VARCHAR(20) NOT NULL DEFAULT 'course';
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'leads_lead_type_check'
            ) THEN
                ALTER TABLE leads ADD CONSTRAINT leads_lead_type_check
                    CHECK (lead_type IN ('course','job','internal_staff'));
            END IF;
        END $$;
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS idx_leads_type ON leads(lead_type);")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_leads_type;")
    op.execute("ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_lead_type_check;")
    op.execute("ALTER TABLE leads DROP COLUMN IF EXISTS lead_type;")
