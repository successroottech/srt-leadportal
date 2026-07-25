from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.deps import require_roles, get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.course import Course, CourseMaterial, CourseSyllabusModule, CourseSyllabusTopic
from app.schemas.course import (
    CourseCreate, CourseUpdate, CourseOut, SyllabusModuleIn, SyllabusModuleOut,
    CourseMaterialCreate, CourseMaterialOut,
)
from app.services.audit import log_action
from app.services.codegen import next_code

router = APIRouter()

MANAGE_ROLES = ("admin",)


@router.get("", response_model=list[CourseOut])
def list_courses(is_active: bool | None = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    q = db.query(Course)
    if is_active is not None:
        q = q.filter(Course.is_active == is_active)
    return q.order_by(Course.id.desc()).all()


@router.post("", response_model=CourseOut)
def create_course(payload: CourseCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(*MANAGE_ROLES))):
    course = Course(course_code=next_code(db, Course, Course.course_code, "SRT-CRS-"), **payload.model_dump())
    db.add(course)
    db.flush()
    log_action(db, user_id=user.id, action="create", module="courses", record_id=course.id)
    db.commit()
    db.refresh(course)
    return course


@router.get("/{course_id}", response_model=CourseOut)
def get_course(course_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


@router.put("/{course_id}", response_model=CourseOut)
def update_course(course_id: int, payload: CourseUpdate, db: Session = Depends(get_db), user: User = Depends(require_roles(*MANAGE_ROLES))):
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(course, field, value)
    log_action(db, user_id=user.id, action="update", module="courses", record_id=course.id)
    db.commit()
    db.refresh(course)
    return course


@router.delete("/{course_id}")
def delete_course(course_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles(*MANAGE_ROLES))):
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    db.delete(course)
    log_action(db, user_id=user.id, action="delete", module="courses", record_id=course_id)
    db.commit()
    return {"detail": "Course deleted"}


@router.post("/{course_id}/toggle-active", response_model=CourseOut)
def toggle_active(course_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles(*MANAGE_ROLES))):
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    course.is_active = not course.is_active
    log_action(db, user_id=user.id, action="status_change", module="courses", record_id=course.id)
    db.commit()
    db.refresh(course)
    return course


@router.get("/{course_id}/syllabus", response_model=list[SyllabusModuleOut])
def get_syllabus(course_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return (
        db.query(CourseSyllabusModule)
        .options(joinedload(CourseSyllabusModule.topics))
        .filter(CourseSyllabusModule.course_id == course_id)
        .order_by(CourseSyllabusModule.sequence)
        .all()
    )


@router.put("/{course_id}/syllabus", response_model=list[SyllabusModuleOut])
def set_syllabus(course_id: int, modules: list[SyllabusModuleIn], db: Session = Depends(get_db), user: User = Depends(require_roles(*MANAGE_ROLES))):
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    db.query(CourseSyllabusModule).filter(CourseSyllabusModule.course_id == course_id).delete()
    db.flush()
    result = []
    for m in modules:
        module = CourseSyllabusModule(course_id=course_id, module_name=m.module_name, sequence=m.sequence)
        db.add(module)
        db.flush()
        for t in m.topics:
            db.add(CourseSyllabusTopic(module_id=module.id, topic_name=t.topic_name, sequence=t.sequence))
        result.append(module)
    log_action(db, user_id=user.id, action="update", module="course_syllabus", record_id=course_id)
    db.commit()
    return get_syllabus(course_id, db, user)


@router.get("/{course_id}/materials", response_model=list[CourseMaterialOut])
def list_materials(course_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return db.query(CourseMaterial).filter(CourseMaterial.course_id == course_id).order_by(CourseMaterial.uploaded_at.desc()).all()


@router.post("/{course_id}/materials", response_model=CourseMaterialOut)
def add_material(course_id: int, payload: CourseMaterialCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(*MANAGE_ROLES))):
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if not payload.file_path and not payload.external_link:
        raise HTTPException(status_code=400, detail="Either file_path or external_link is required")
    material = CourseMaterial(course_id=course_id, uploaded_by=user.id, **payload.model_dump())
    db.add(material)
    log_action(db, user_id=user.id, action="create", module="course_materials", record_id=course_id)
    db.commit()
    db.refresh(material)
    return material


@router.delete("/{course_id}/materials/{material_id}")
def delete_material(course_id: int, material_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles(*MANAGE_ROLES))):
    material = db.get(CourseMaterial, material_id)
    if not material or material.course_id != course_id:
        raise HTTPException(status_code=404, detail="Material not found")
    db.delete(material)
    log_action(db, user_id=user.id, action="delete", module="course_materials", record_id=material_id)
    db.commit()
    return {"detail": "Material deleted"}
