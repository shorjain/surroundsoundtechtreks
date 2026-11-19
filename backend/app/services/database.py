"""MongoDB access. Without MONGODB_URI an in-memory stand-in is used (wiped on restart)."""
from functools import lru_cache
import mongomock
from pymongo import MongoClient
from app.core.config import settings

@lru_cache
def get_database():
    if settings.mongodb_uri:
        return MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=5000)[settings.mongodb_db]
    return mongomock.MongoClient()[settings.mongodb_db]
