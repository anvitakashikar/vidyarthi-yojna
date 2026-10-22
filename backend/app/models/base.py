"""Shared building blocks for MongoDB documents."""
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field
from typing_extensions import Annotated

# Accepts an ObjectId or a string and always exposes it as a string in the API
PyObjectId = Annotated[str, BeforeValidator(lambda v: str(v) if isinstance(v, ObjectId) else v)]


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class LocalizedText(BaseModel):
    """Text stored in both languages, e.g. a scheme title.

    Stored in MongoDB as: {"en": "Scholarship", "mr": "शिष्यवृत्ती"}
    """

    en: str
    mr: str

    def get(self, lang: str) -> str:
        return getattr(self, lang, None) or self.en


class MongoBaseModel(BaseModel):
    """Base for every document read from MongoDB."""

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

    id: Optional[PyObjectId] = Field(default=None, alias="_id")
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)
