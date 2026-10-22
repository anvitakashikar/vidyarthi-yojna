from fastapi import APIRouter

from app.db.mongodb import mongodb
from app.schemas.common import APIResponse

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=APIResponse)
async def health():
    db_ok = False
    if mongodb.client is not None:
        try:
            await mongodb.client.admin.command("ping")
            db_ok = True
        except Exception:
            db_ok = False

    return APIResponse(
        success=db_ok,
        message="Service is running",
        data={"database": "connected" if db_ok else "unavailable"},
    )
