"""MongoDB connection management using PyMongo's native async client."""
import logging
from typing import Optional

from pymongo import AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase

from app.core.config import settings

logger = logging.getLogger(__name__)


class MongoDB:
    client: Optional[AsyncMongoClient] = None
    db: Optional[AsyncDatabase] = None


mongodb = MongoDB()


async def connect_to_mongo() -> None:
    mongodb.client = AsyncMongoClient(settings.MONGODB_URI, tz_aware=True)
    mongodb.db = mongodb.client[settings.MONGODB_DB_NAME]
    try:
        await mongodb.client.admin.command("ping")
        logger.info("Connected to MongoDB database '%s'", settings.MONGODB_DB_NAME)
    except Exception as exc:  # app still starts; /health reports the problem
        logger.error("Could not connect to MongoDB: %s", exc)


async def close_mongo_connection() -> None:
    if mongodb.client is not None:
        await mongodb.client.close()
        logger.info("MongoDB connection closed")


def get_database() -> AsyncDatabase:
    """FastAPI dependency / helper that returns the active database."""
    if mongodb.db is None:
        raise RuntimeError("MongoDB is not initialised. Did the app start up?")
    return mongodb.db
