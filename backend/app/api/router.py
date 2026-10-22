from fastapi import APIRouter

from app.api.routes import admin, auth, donations, donors, health, payments, students

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(students.router)
api_router.include_router(donors.router)
api_router.include_router(donations.router)
api_router.include_router(admin.router)
api_router.include_router(payments.router)

# Feature routers go here, e.g.:
# api_router.include_router(schemes.router, prefix="/schemes")
