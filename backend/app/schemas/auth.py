from pydantic import BaseModel, field_validator


class LoginRequest(BaseModel):
    identifier: str  # email or mobile
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    name: str
    user_id: int


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def min_len(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class ResetPasswordRequest(BaseModel):
    user_id: int
    new_password: str


class UpdatePhotoRequest(BaseModel):
    file_path: str | None = None
