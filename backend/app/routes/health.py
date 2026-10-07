from fastapi import APIRouter
router = APIRouter()

@router.get("/health", tags=["health"])
def health():
    """Application liveness only; this does not test MongoDB."""
    return {"status": "ok"}
