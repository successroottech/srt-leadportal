"""Seed baseline data: role permissions + a default admin login.

Run after `alembic upgrade head`:
    python seed.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.session import SessionLocal
from app.core.security import hash_password
from app.models.role import Role, RolePermission
from app.models.user import User
from app.models.course import Course, CourseSyllabusModule, CourseSyllabusTopic

MODULES = [
    "roles", "staff", "leads", "candidates", "students", "courses", "batches",
    "attendance", "fees", "expenses", "leave_requests", "feedback_complaints",
    "notifications", "reports", "audit_logs",
]

ADMIN_PERMS = {m: dict(can_view=True, can_create=True, can_edit=True, can_delete=True,
                       can_export=True, can_approve=True, can_assign=True, can_status_update=True) for m in MODULES}

HR_PERMS = {
    "staff": dict(can_view=True, can_create=True, can_edit=True, can_export=True),
    "candidates": dict(can_view=True, can_create=True, can_edit=True, can_assign=True, can_export=True),
    "attendance": dict(can_view=True, can_export=True),
    "leave_requests": dict(can_view=True, can_approve=True),
    "students": dict(can_view=True, can_create=True, can_edit=True),
    "reports": dict(can_view=True, can_export=True),
}

TELECALLER_PERMS = {
    "leads": dict(can_view=True, can_create=True, can_edit=True, can_status_update=True),
    "candidates": dict(can_view=True, can_create=True, can_edit=True, can_status_update=True),
    "attendance": dict(can_view=True),
    "leave_requests": dict(can_view=True, can_create=True),
}

TRAINER_PERMS = {
    "batches": dict(can_view=True, can_status_update=True),
    "students": dict(can_view=True),
    "attendance": dict(can_view=True, can_create=True),
    "leave_requests": dict(can_view=True, can_create=True),
}

STUDENT_PERMS = {
    "attendance": dict(can_view=True),
    "fees": dict(can_view=True),
    "leave_requests": dict(can_view=True, can_create=True),
    "feedback_complaints": dict(can_view=True, can_create=True),
}

ROLE_PERM_MAP = {
    "admin": ADMIN_PERMS,
    "hr": HR_PERMS,
    "telecaller": TELECALLER_PERMS,
    "trainer": TRAINER_PERMS,
    "student": STUDENT_PERMS,
}


def seed_permissions(db):
    for role_name, perms in ROLE_PERM_MAP.items():
        role = db.query(Role).filter(Role.name == role_name).first()
        if not role:
            continue
        for module, flags in perms.items():
            existing = db.query(RolePermission).filter(RolePermission.role_id == role.id, RolePermission.module == module).first()
            if existing:
                continue
            db.add(RolePermission(role_id=role.id, module=module, **flags))
    db.commit()


def seed_admin_user(db):
    admin_role = db.query(Role).filter(Role.name == "admin").first()
    existing = db.query(User).filter(User.email == "admin@srt.local").first()
    if existing:
        print("Admin user already exists: admin@srt.local")
        return
    admin = User(
        staff_code="SRT-EMP-0001",
        name="System Administrator",
        email="admin@srt.local",
        mobile="9999999999",
        password_hash=hash_password("Admin@12345"),
        role_id=admin_role.id,
        department="Administration",
        employment_status="active",
    )
    db.add(admin)
    db.commit()
    print("Created admin login -> email: admin@srt.local | mobile: 9999999999 | password: Admin@12345")
    print("IMPORTANT: change this password immediately after first login.")


def seed_sample_course(db):
    if db.query(Course).count() > 0:
        return
    course = Course(
        course_code="SRT-CRS-0001",
        name="Full Stack Web Development",
        description="End-to-end web development covering frontend, backend and databases.",
        duration_weeks=12,
        regular_fee=45000,
        offer_fee=35000,
        category="Software Development",
    )
    db.add(course)
    db.flush()
    module = CourseSyllabusModule(course_id=course.id, module_name="Frontend Fundamentals", sequence=1)
    db.add(module)
    db.flush()
    for i, topic in enumerate(["HTML & CSS", "JavaScript Basics", "React Fundamentals"], start=1):
        db.add(CourseSyllabusTopic(module_id=module.id, topic_name=topic, sequence=i))
    db.commit()
    print("Created sample course: Full Stack Web Development")


def main():
    db = SessionLocal()
    try:
        seed_permissions(db)
        seed_admin_user(db)
        seed_sample_course(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
