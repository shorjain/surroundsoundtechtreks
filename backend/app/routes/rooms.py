"""Rooms, devices, the room's track, synced playback and the per-device mixer.

Sync idea: phones learn the server clock from GET /time, and the host's play command
names a server time ~2 s ahead. Every phone schedules the track for that moment.

Collections: rooms {_id: code, hostToken, playback}
             devices {_id, room, name, lastSeen, offsetMs, rttMs, volume, muted, channel}
             tracks {_id: code, name, type, data}
"""
import secrets
import time
from typing import Literal
from fastapi import APIRouter, Header, HTTPException, Request, Response
from pydantic import BaseModel
from app.services.database import get_database

router = APIRouter(tags=["rooms"])
START_DELAY_MS = 2000  # time for every phone to hear about a play command before it starts
ONLINE_MS = 5000       # a device that has not pinged for this long shows as offline

def now_ms():
    return time.time() * 1000

def get_room(code, host_token=None):
    room = get_database().rooms.find_one({"_id": code})
    if not room:
        raise HTTPException(404, "No room with that code")
    if host_token is not None and host_token != room["hostToken"]:
        raise HTTPException(403, "Only the host can do that")
    return room

def room_state(room):
    devices = list(get_database().devices.find({"room": room["_id"]}))
    for d in devices:
        d["id"] = d.pop("_id")
        d["online"] = now_ms() - d["lastSeen"] < ONLINE_MS
    return {"code": room["_id"], "party": room.get("party"), "playback": room["playback"], "devices": devices}

class NewRoom(BaseModel):
    name: str = "Party"
    vibe: str = "Disco"
    mode: Literal["surround", "mono"] = "surround"
    maxPhones: int = 20

class Join(BaseModel):
    name: str

class Ping(BaseModel):
    offsetMs: float  # server clock minus this phone's clock
    rttMs: float     # round trip of the best clock sample; the offset is good to about half of this

class Play(BaseModel):
    track: Literal["clicks", "upload"]  # clicks = test beat the phones generate themselves

class Mix(BaseModel):
    volume: float = 1.0
    muted: bool = False
    channel: Literal["both", "left", "right"] = "both"

@router.get("/time")
def server_time():
    return {"serverTime": now_ms()}

@router.post("/rooms")
def create_room(body: NewRoom | None = None):
    party = (body or NewRoom()).model_dump()
    code = f"{secrets.randbelow(10**6):06d}"
    while get_database().rooms.find_one({"_id": code}):
        code = f"{secrets.randbelow(10**6):06d}"
    room = {"_id": code, "hostToken": secrets.token_urlsafe(16), "playback": None, "party": party}
    get_database().rooms.insert_one(room)
    return {"code": code, "hostToken": room["hostToken"]}

@router.get("/rooms/{code}")
def read_room(code: str):
    return room_state(get_room(code))

@router.post("/rooms/{code}/devices")
def join_room(code: str, body: Join):
    get_room(code)
    device = {"_id": secrets.token_urlsafe(8), "room": code, "name": body.name, "lastSeen": now_ms(),
              "offsetMs": None, "rttMs": None, **Mix().model_dump()}
    get_database().devices.insert_one(device)
    return {"id": device["_id"]}

@router.post("/rooms/{code}/devices/{device_id}/ping")
def ping(code: str, device_id: str, body: Ping):
    room = get_room(code)
    found = get_database().devices.update_one({"_id": device_id, "room": code},
                                              {"$set": {"lastSeen": now_ms(), **body.model_dump()}})
    if not found.matched_count:
        raise HTTPException(404, "Device not in this room")
    return room_state(room)

@router.patch("/rooms/{code}/devices/{device_id}")
def mix_device(code: str, device_id: str, body: Mix, x_host_token: str = Header()):
    get_room(code, x_host_token)
    get_database().devices.update_one({"_id": device_id, "room": code}, {"$set": body.model_dump()})
    return body

@router.put("/rooms/{code}/track")
async def upload_track(code: str, request: Request, name: str, x_host_token: str = Header()):
    get_room(code, x_host_token)
    data = await request.body()
    if len(data) > 15_000_000:  # a MongoDB document holds at most 16 MB
        raise HTTPException(413, "Track must be under 15 MB")
    track = {"name": name, "type": request.headers.get("content-type", "audio/mpeg"), "data": data}
    get_database().tracks.replace_one({"_id": code}, track, upsert=True)
    return {"name": name, "bytes": len(data)}

@router.get("/rooms/{code}/track")
def download_track(code: str):
    track = get_database().tracks.find_one({"_id": code})
    if not track:
        raise HTTPException(404, "No track uploaded")
    return Response(bytes(track["data"]), media_type=track["type"])

@router.post("/rooms/{code}/play")
def play(code: str, body: Play, x_host_token: str = Header()):
    get_room(code, x_host_token)
    playback = {"id": secrets.token_urlsafe(6), "track": body.track, "startAt": now_ms() + START_DELAY_MS}
    get_database().rooms.update_one({"_id": code}, {"$set": {"playback": playback}})
    return playback

@router.post("/rooms/{code}/stop")
def stop(code: str, x_host_token: str = Header()):
    get_room(code, x_host_token)
    get_database().rooms.update_one({"_id": code}, {"$set": {"playback": None}})
    return {"playback": None}
