from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth, roles, staff, courses, batches, students, leads, candidates,
    attendance, fees, expenses, leave, notifications, feedback, dashboards, audit, uploads, settings,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(roles.router, prefix="/roles", tags=["roles"])
api_router.include_router(staff.router, prefix="/staff", tags=["staff"])
api_router.include_router(courses.router, prefix="/courses", tags=["courses"])
api_router.include_router(batches.router, prefix="/batches", tags=["batches"])
api_router.include_router(students.router, prefix="/students", tags=["students"])
api_router.include_router(leads.router, prefix="/leads", tags=["leads"])
api_router.include_router(candidates.router, prefix="/candidates", tags=["candidates"])
api_router.include_router(attendance.router, prefix="/attendance", tags=["attendance"])
api_router.include_router(fees.router, prefix="/fees", tags=["fees"])
api_router.include_router(expenses.router, prefix="/expenses", tags=["expenses"])
api_router.include_router(leave.router, prefix="/leave", tags=["leave"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(feedback.router, prefix="/feedback", tags=["feedback"])
api_router.include_router(dashboards.router, prefix="/dashboards", tags=["dashboards"])
api_router.include_router(audit.router, prefix="/audit-logs", tags=["audit"])
api_router.include_router(uploads.router, prefix="/uploads", tags=["uploads"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
