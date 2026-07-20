from pydantic import BaseModel


class Msg(BaseModel):
    detail: str


class Page(BaseModel):
    total: int
    items: list
