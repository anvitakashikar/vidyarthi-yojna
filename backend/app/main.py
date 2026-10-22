import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.router import api_router
from app.core.config import settings
from app.core.errors import AppError
from app.db.indexes import create_indexes
from app.db.mongodb import close_mongo_connection, connect_to_mongo, get_database
from app.repositories.students import refresh_eligibility
from app.repositories.users import seed_admin

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    try:
        await create_indexes(get_database())
        await seed_admin(get_database())
        rechecked = await refresh_eligibility(get_database())
        if rechecked:
            logger.info("Re-checked scheme eligibility for %d students", rechecked)
    except Exception as exc:
        logger.warning("Database setup skipped: %s", exc)
    if settings.JWT_SECRET.startswith("change-me"):
        logger.warning("JWT_SECRET is using the default value. Set a strong secret in .env!")
    yield
    await close_mongo_connection()


app = FastAPI(title=settings.APP_NAME, version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    return JSONResponse(status_code=exc.status_code, content=exc.to_dict())


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    code = "error.not_found" if exc.status_code == 404 else "error.http"
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "code": code, "message": str(exc.detail), "data": None},
        headers=getattr(exc, "headers", None),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "code": "error.validation",
            "message": "Some of the submitted data is invalid",
            "data": jsonable_encoder(exc.errors()),
        },
    )


app.include_router(api_router, prefix=settings.API_PREFIX)


@app.get("/")
async def root():
    return {"name": settings.APP_NAME, "docs": "/docs"}
