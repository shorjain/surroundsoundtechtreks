from fastapi.testclient import TestClient
from app.main import app

api = TestClient(app)

def test_room_flow():
    room = api.post("/api/rooms").json()
    code, host = room["code"], {"X-Host-Token": room["hostToken"]}
    phone = api.post(f"/api/rooms/{code}/devices", json={"name": "Maya"}).json()["id"]

    state = api.post(f"/api/rooms/{code}/devices/{phone}/ping", json={"offsetMs": 12, "rttMs": 30}).json()
    assert [(d["name"], d["online"], d["offsetMs"]) for d in state["devices"]] == [("Maya", True, 12)]

    assert api.put(f"/api/rooms/{code}/track?name=a.mp3", content=b"ID3", headers=host).json()["bytes"] == 3
    assert api.get(f"/api/rooms/{code}/track").content == b"ID3"

    before = api.get("/api/time").json()["serverTime"]
    playback = api.post(f"/api/rooms/{code}/play", json={"track": "upload"}, headers=host).json()
    assert playback["startAt"] > before + 1000  # starts in the future so every phone can schedule it

    api.patch(f"/api/rooms/{code}/devices/{phone}", json={"volume": 0.5, "channel": "left"}, headers=host)
    device = api.get(f"/api/rooms/{code}").json()["devices"][0]
    assert (device["volume"], device["channel"]) == (0.5, "left")

    api.post(f"/api/rooms/{code}/stop", headers=host)
    assert api.get(f"/api/rooms/{code}").json()["playback"] is None

def test_only_host_controls():
    code = api.post("/api/rooms").json()["code"]
    assert api.post(f"/api/rooms/{code}/play", json={"track": "clicks"}, headers={"X-Host-Token": "x"}).status_code == 403
    assert api.get("/api/rooms/nope").status_code == 404
