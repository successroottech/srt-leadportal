from datetime import datetime

from sqlalchemy import String, Boolean, DateTime, ForeignKey, Numeric, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    duration_weeks: Mapped[int | None] = mapped_column(Integer)
    regular_fee: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    offer_fee: Mapped[float | None] = mapped_column(Numeric(12, 2))
    category: Mapped[str | None] = mapped_column(String(100))
    syllabus_file: Mapped[str | None] = mapped_column(String(255))
    image_file: Mapped[str | None] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    materials: Mapped[list["CourseMaterial"]] = relationship(back_populates="course", cascade="all, delete-orphan")
    modules: Mapped[list["CourseSyllabusModule"]] = relationship(back_populates="course", cascade="all, delete-orphan")


class CourseMaterial(Base):
    __tablename__ = "course_materials"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    material_type: Mapped[str] = mapped_column(String(20), nullable=False)
    file_path: Mapped[str | None] = mapped_column(String(255))
    external_link: Mapped[str | None] = mapped_column(String(500))
    uploaded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    course: Mapped["Course"] = relationship(back_populates="materials")


class CourseSyllabusModule(Base):
    __tablename__ = "course_syllabus_modules"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="CASCADE"))
    module_name: Mapped[str] = mapped_column(String(150), nullable=False)
    sequence: Mapped[int] = mapped_column(Integer, default=0)

    course: Mapped["Course"] = relationship(back_populates="modules")
    topics: Mapped[list["CourseSyllabusTopic"]] = relationship(back_populates="module", cascade="all, delete-orphan")


class CourseSyllabusTopic(Base):
    __tablename__ = "course_syllabus_topics"

    id: Mapped[int] = mapped_column(primary_key=True)
    module_id: Mapped[int] = mapped_column(ForeignKey("course_syllabus_modules.id", ondelete="CASCADE"))
    topic_name: Mapped[str] = mapped_column(String(150), nullable=False)
    sequence: Mapped[int] = mapped_column(Integer, default=0)

    module: Mapped["CourseSyllabusModule"] = relationship(back_populates="topics")
