from datetime import datetime

from pydantic import BaseModel, ConfigDict


class PermissionIn(BaseModel):
    module: str
    can_view: bool = False
    can_create: bool = False
    can_edit: bool = False
    can_delete: bool = False
    can_export: bool = False
    can_approve: bool = False
    can_assign: bool = False
    can_status_update: bool = False


class PermissionOut(PermissionIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


class RoleCreate(BaseModel):
    name: str
    description: str | None = None
    permissions: list[PermissionIn] = []


class RoleUpdate(BaseModel):
    description: str | None = None
    is_active: bool | None = None
    permissions: list[PermissionIn] | None = None


class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    description: str | None
    is_system: bool
    is_active: bool
    created_at: datetime
    permissions: list[PermissionOut] = []
