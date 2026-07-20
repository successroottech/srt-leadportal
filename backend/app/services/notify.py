from sqlalchemy.orm import Session

from app.models.notification import Notification


def notify_user(db: Session, user_id: int, title: str, message: str = "", category: str = "system",
                 reference_table: str | None = None, reference_id: int | None = None) -> None:
    db.add(Notification(
        user_id=user_id, title=title, message=message, category=category,
        reference_table=reference_table, reference_id=reference_id,
    ))


def notify_student(db: Session, student_id: int, title: str, message: str = "", category: str = "system",
                    reference_table: str | None = None, reference_id: int | None = None) -> None:
    db.add(Notification(
        student_id=student_id, title=title, message=message, category=category,
        reference_table=reference_table, reference_id=reference_id,
    ))
