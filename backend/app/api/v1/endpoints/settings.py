from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import require_roles
from app.db.session import get_db
from app.models.user import User
from app.models.settings import AppSettings
from app.schemas.settings import AppSettingsOut, AppSettingsUpdate
from app.services.audit import log_action

router = APIRouter()


def get_or_create_settings(db: Session) -> AppSettings:
    settings = db.get(AppSettings, 1)
    if not settings:
        settings = AppSettings(id=1)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.get("", response_model=AppSettingsOut)
def read_settings(db: Session = Depends(get_db)):
    # Intentionally no auth dependency: the login screen (pre-authentication)
    # needs the portal name/logo for branding.
    return get_or_create_settings(db)


@router.put("", response_model=AppSettingsOut)
def update_settings(payload: AppSettingsUpdate, db: Session = Depends(get_db), user: User = Depends(require_roles("admin"))):
    settings = get_or_create_settings(db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(settings, field, value)
    log_action(db, user_id=user.id, action="update", module="settings", record_id=1)
    db.commit()
    db.refresh(settings)
    return settings
