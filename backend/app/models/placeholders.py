"""Placeholder document models. Fields will be finalised when features are defined."""
from typing import Optional

from app.models.base import LocalizedText, MongoBaseModel


class Scheme(MongoBaseModel):
    title: LocalizedText
    description: LocalizedText
    is_active: bool = True


class Application(MongoBaseModel):
    student_id: str
    scheme_id: str
    status: str = "draft"
    remarks: Optional[LocalizedText] = None
