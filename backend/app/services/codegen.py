from sqlalchemy import func
from sqlalchemy.orm import Session


def next_code(db: Session, model, column, prefix: str, width: int = 4) -> str:
    """Generate the next sequential code like SRT-STU-0001 for a model/column."""
    count = db.query(func.count()).select_from(model).scalar() or 0
    for _ in range(1000):
        count += 1
        candidate = f"{prefix}{count:0{width}d}"
        exists = db.query(model).filter(column == candidate).first()
        if not exists:
            return candidate
    raise RuntimeError("Could not generate a unique code")
