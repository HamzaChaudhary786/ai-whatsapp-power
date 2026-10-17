from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field


class FAQDocumentModel(BaseModel):
    """MongoDB FAQ Document Representation for AI Assistant Knowledge Base & RAG."""
    id: Optional[str] = Field(default=None, alias="_id")
    title: str = Field(..., description="FAQ question / header title", index=True)
    topic: str = Field(..., description="Topic category (e.g. shipping, returns, sizes, payment)", index=True)
    approved_content: str = Field(..., description="Verified knowledge base answer used by AI assistant")
    language: str = Field(default="en", description="Language code (e.g. en, ur, es, ar)", index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = ConfigDict(
        populate_by_name=True,
        json_schema_extra={
            "example": {
                "title": "What is your return policy for dresses?",
                "topic": "returns",
                "approved_content": "We offer a 14-day hassle-free return policy on all unworn dresses with original tags attached.",
                "language": "en",
            }
        },
    )


class FAQDocumentCreate(BaseModel):
    title: str
    topic: str
    approved_content: str
    language: str = "en"


class FAQDocumentUpdate(BaseModel):
    title: Optional[str] = None
    topic: Optional[str] = None
    approved_content: Optional[str] = None
    language: Optional[str] = None


class FAQDocumentResponse(BaseModel):
    id: str
    title: str
    topic: str
    approved_content: str
    language: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
