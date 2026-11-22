from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.routes.health import router as health_router
from app.routes.rooms import router as rooms_router

app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(health_router, prefix="/api")
app.include_router(rooms_router, prefix="/api")
