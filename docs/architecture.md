# Architecture and first milestones
- React renders the landing page, room controls, and manual device map.
- FastAPI will own room membership, host authorization, playback commands, and WebSocket events.
- MongoDB will store room/track metadata. Store MP3 bytes in object storage, not Git.
- Browser audio scheduling and clock-offset measurements belong in frontend/src/services/.
- PyTorch calibration stays in ml/ until synchronization is proven.

Suggested milestones:
1. Create/join rooms and assign host/device identifiers.
2. Broadcast state through WebSockets.
3. Schedule the same audio at a future shared timestamp; measure drift on real phones.
4. Add uploads, queue and host controls.
5. Add draggable positions, then evaluate acoustic calibration.

Room codes are invitations, not authorization: validate host actions on the server.
Browser autoplay generally needs a user gesture. Mobile microphone access needs HTTPS.
A phone’s localhost refers to that phone, so use a reachable backend URL when testing across devices.
Plan reconnects, clock drift and device output latency before promising synchronized sound.
