from typing import Annotated

from pydantic import BaseModel, BeforeValidator, EmailStr


class Msg(BaseModel):
    detail: str


class Page(BaseModel):
    total: int
    items: list


def _blank_to_none(value):
    if isinstance(value, str) and value.strip() == "":
        return None
    return value


# EmailStr rejects "" outright (unlike None). Frontend forms send "" for an
# untouched optional email field, so treat blank the same as not provided.
OptionalEmail = Annotated[EmailStr | None, BeforeValidator(_blank_to_none)]
