import time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user, get_client_ip
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.user import User, LoginHistory
from app.models.role import Role
from app.schemas.auth import LoginRequest, TokenResponse, ChangePasswordRequest
from app.services.audit import log_action

router = APIRouter()

# simple in-memory login-attempt lockout tracker: {identifier: [timestamps]}
_failed_attempts: dict[str, list[float]] = {}


def _is_locked_out(identifier: str) -> bool:
    attempts = _failed_attempts.get(identifier, [])
    window_start = time.time() - settings.LOCKOUT_MINUTES * 60
    attempts = [t for t in attempts if t > window_start]
    _failed_attempts[identifier] = attempts
    return len(attempts) >= settings.MAX_LOGIN_ATTEMPTS


def _record_failure(identifier: str) -> None:
    _failed_attempts.setdefault(identifier, []).append(time.time())


def _clear_failures(identifier: str) -> None:
    _failed_attempts.pop(identifier, None)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    identifier = payload.identifier.strip().lower()

    if _is_locked_out(identifier):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed attempts. Try again after {settings.LOCKOUT_MINUTES} minutes.",
        )

    user = (
        db.query(User)
        .filter((User.email == identifier) | (User.mobile == identifier))
        .first()
    )

    if not user or not verify_password(payload.password, user.password_hash):
        _record_failure(identifier)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")

    _clear_failures(identifier)

    role = db.get(Role, user.role_id)
    if not role or not role.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Role is inactive")

    user.last_login_at = datetime.now(timezone.utc)
    ip = get_client_ip(request)
    db.add(LoginHistory(user_id=user.id, ip_address=ip, user_agent=request.headers.get("user-agent")))
    log_action(db, user_id=user.id, action="login", module="auth", record_id=user.id, ip_address=ip)
    db.commit()

    token = create_access_token({"user_id": user.id, "role": role.name})
    return TokenResponse(access_token=token, role=role.name, name=user.name, user_id=user.id)


@router.post("/logout")
def logout(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    last_login = (
        db.query(LoginHistory)
        .filter(LoginHistory.user_id == current_user.id, LoginHistory.logout_at.is_(None))
        .order_by(LoginHistory.login_at.desc())
        .first()
    )
    if last_login:
        last_login.logout_at = datetime.now(timezone.utc)
    log_action(db, user_id=current_user.id, action="logout", module="auth", record_id=current_user.id,
               ip_address=get_client_ip(request))
    db.commit()
    return {"detail": "Logged out"}


@router.get("/me")
def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    role = db.get(Role, current_user.role_id)
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "mobile": current_user.mobile,
        "role": role.name if role else None,
        "staff_code": current_user.staff_code,
        "department": current_user.department,
        "profile_photo": current_user.profile_photo,
    }


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Old password is incorrect")
    current_user.password_hash = hash_password(payload.new_password)
    current_user.must_reset_password = False
    log_action(db, user_id=current_user.id, action="update", module="auth", record_id=current_user.id)
    db.commit()
    return {"detail": "Password updated"}


@router.get("/login-history")
def login_history(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (
        db.query(LoginHistory)
        .filter(LoginHistory.user_id == current_user.id)
        .order_by(LoginHistory.login_at.desc())
        .limit(50)
        .all()
    )
    return [
        {"login_at": r.login_at, "logout_at": r.logout_at, "ip_address": r.ip_address}
        for r in rows
    ]
