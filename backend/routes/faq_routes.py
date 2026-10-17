from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from controllers.faq_controller import faq_controller
from models.faq_model import FAQDocumentCreate, FAQDocumentResponse, FAQDocumentUpdate
from utils.dependencies import require_staff

router = APIRouter(prefix="/faqs", tags=["Knowledge Base & FAQs"])


@router.post("/", response_model=FAQDocumentResponse)
async def create_faq(data: FAQDocumentCreate, _staff: dict = Depends(require_staff)):
    """Add a new approved FAQ entry to knowledge base (Staff/Admin access only)."""
    return await faq_controller.create_faq(data)


@router.get("/", response_model=List[FAQDocumentResponse])
async def list_faqs(
    topic: Optional[str] = Query(None, description="Filter by topic"),
    language: Optional[str] = Query(None, description="Filter by language"),
    limit: int = Query(50, ge=1, le=100),
    skip: int = Query(0, ge=0),
):
    """List FAQ documents (Public)."""
    return await faq_controller.list_faqs(topic=topic, language=language, limit=limit, skip=skip)


@router.get("/search", response_model=List[FAQDocumentResponse])
async def search_faqs(q: str = Query(..., description="Search query string for RAG knowledge lookup")):
    """Full-text semantic search on FAQ titles and content for AI RAG (Public)."""
    return await faq_controller.search_faqs(query_text=q)


@router.patch("/{faq_id}", response_model=FAQDocumentResponse)
async def update_faq(faq_id: str, data: FAQDocumentUpdate, _staff: dict = Depends(require_staff)):
    """Update FAQ document title, topic, or content (Staff/Admin access only)."""
    return await faq_controller.update_faq(faq_id, data)
