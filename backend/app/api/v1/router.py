from fastapi import APIRouter

from app.api.v1 import (
    admin,
    attendance,
    audit,
    auth,
    classes,
    custom_lists,
    dashboard,
    settings,
    students,
    subjects,
    users,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(dashboard.router)
api_router.include_router(classes.router)
api_router.include_router(students.router)
api_router.include_router(subjects.router)
api_router.include_router(attendance.router)
api_router.include_router(custom_lists.router)
api_router.include_router(users.router)
api_router.include_router(admin.router)
api_router.include_router(audit.router)
api_router.include_router(settings.router)
