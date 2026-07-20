from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.deps import require_roles
from app.db.session import get_db
from app.models.role import Role, RolePermission
from app.models.user import User
from app.schemas.role import RoleCreate, RoleUpdate, RoleOut
from app.services.audit import log_action

router = APIRouter()


@router.get("", response_model=list[RoleOut])
def list_roles(db: Session = Depends(get_db), _: User = Depends(require_roles("admin"))):
    return db.query(Role).options(joinedload(Role.permissions)).order_by(Role.id).all()


@router.post("", response_model=RoleOut)
def create_role(payload: RoleCreate, db: Session = Depends(get_db), user: User = Depends(require_roles("admin"))):
    if db.query(Role).filter(Role.name == payload.name).first():
        raise HTTPException(status_code=400, detail="Role name already exists")
    role = Role(name=payload.name, description=payload.description)
    db.add(role)
    db.flush()
    for perm in payload.permissions:
        db.add(RolePermission(role_id=role.id, **perm.model_dump()))
    log_action(db, user_id=user.id, action="create", module="roles", record_id=role.id)
    db.commit()
    db.refresh(role)
    return role


@router.put("/{role_id}", response_model=RoleOut)
def update_role(role_id: int, payload: RoleUpdate, db: Session = Depends(get_db), user: User = Depends(require_roles("admin"))):
    role = db.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if payload.description is not None:
        role.description = payload.description
    if payload.is_active is not None:
        role.is_active = payload.is_active
    if payload.permissions is not None:
        db.query(RolePermission).filter(RolePermission.role_id == role.id).delete()
        for perm in payload.permissions:
            db.add(RolePermission(role_id=role.id, **perm.model_dump()))
    log_action(db, user_id=user.id, action="update", module="roles", record_id=role.id)
    db.commit()
    db.refresh(role)
    return role


@router.delete("/{role_id}")
def delete_role(role_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles("admin"))):
    role = db.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.is_system:
        raise HTTPException(status_code=400, detail="System roles cannot be deleted")
    db.delete(role)
    log_action(db, user_id=user.id, action="delete", module="roles", record_id=role_id)
    db.commit()
    return {"detail": "Role deleted"}


@router.post("/{role_id}/toggle-active", response_model=RoleOut)
def toggle_role_active(role_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles("admin"))):
    role = db.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    role.is_active = not role.is_active
    log_action(db, user_id=user.id, action="status_change", module="roles", record_id=role.id)
    db.commit()
    db.refresh(role)
    return role
