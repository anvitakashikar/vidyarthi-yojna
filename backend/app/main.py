import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
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
FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"


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
    logger.info("CORS allowed origins: %s", settings.cors_origins_list)
    if settings.JWT_SECRET.startswith("change-me"):
        logger.warning("JWT_SECRET is using the default value. Set a strong secret in .env!")
    if not (settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET):
        logger.warning("RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set: online donations are switched off.")
    if not (settings.SMTP_HOST and settings.SMTP_FROM):
        logger.warning("SMTP_HOST / SMTP_FROM are not set: donation receipts will not be emailed.")
    if settings.OTP_PROVIDER == "twilio":
        if not (settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN and settings.TWILIO_VERIFY_SERVICE_SID):
            logger.error("OTP_PROVIDER=twilio but the TWILIO_* settings are missing. OTP SMS will fail.")
    else:
        logger.warning("OTP_PROVIDER=%s: OTP codes are printed in this log, not sent by SMS.", settings.OTP_PROVIDER)
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
    frontend_index = FRONTEND_DIST / "index.html"
    if frontend_index.is_file():
        return FileResponse(frontend_index)
    return {"name": settings.APP_NAME, "docs": "/docs"}


@app.get("/{path:path}")
async def frontend_routes(path: str):
    api_prefix = settings.API_PREFIX.strip("/")
    if path == api_prefix or path.startswith(f"{api_prefix}/"):
        raise StarletteHTTPException(status_code=404, detail="Not Found")

    frontend_index = FRONTEND_DIST / "index.html"
    if not frontend_index.is_file():
        raise StarletteHTTPException(status_code=404, detail="Not Found")

    frontend_root = FRONTEND_DIST.resolve()
    requested_file = (FRONTEND_DIST / path).resolve()
    if requested_file.is_relative_to(frontend_root) and requested_file.is_file():
        return FileResponse(requested_file)
    if path.startswith("assets/"):
        raise StarletteHTTPException(status_code=404, detail="Not Found")
    return FileResponse(frontend_index)
