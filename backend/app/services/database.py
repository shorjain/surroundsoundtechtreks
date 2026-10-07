"""Lazy MongoDB access for future database-backed routes."""
from functools import lru_cache
from pymongo import MongoClient
from app.core.config import settings

@lru_cache
def get_client() -> MongoClient:
    if not settings.mongodb_uri:
        raise RuntimeError("Set MONGODB_URI before using database-backed routes")
    return MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=5000)

def get_database():
    return get_client()[settings.mongodb_db]
