# SurroundSound
A web app that aims to turn phones in one room into a synchronized speaker system with a shared device map.

**Current status:** project scaffold only. The frontend checks the backend health endpoint.
Room joining, uploads, playback synchronization and calibration are future work.

## Repository layout
```text
frontend/             React + Vite (JavaScript)
  src/components/     Shared UI components
  src/pages/          Future landing, room and map pages
  src/hooks/          Shared React behavior
  src/services/       API and future audio/WebSocket logic
backend/              FastAPI
  app/core/           Environment settings
  app/routes/         HTTP endpoints
  app/models/         Future request/database models
  app/services/       MongoDB and future room/audio logic
ml/                   Separate PyTorch research environment
docs/                 Architecture and implementation milestones
render.yaml           Render API and static-site deployment
CONTRIBUTING.md        Team branch and review workflow
```
Git stores files, so empty starter folders contain .gitkeep or __init__.py.

## Prerequisites
- Node.js 22.12+ and npm (use `nvm use` if you have nvm).
- Python 3.12 and Git.
- MongoDB Atlas or local MongoDB when database features are added.

## Run locally
Clone the repo, then open two terminals:
```sh
git clone https://github.com/shorjain/surroundsoundtechtreks.git
cd surroundsoundtechtreks
```

Backend terminal:
```sh
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```
Windows PowerShell: activate with `.venv\Scripts\Activate.ps1` and use
`Copy-Item .env.example .env` instead of cp.

Frontend terminal, starting from the repository root:
```sh
cd frontend
cp .env.example .env
npm ci
npm run dev
```
Open http://localhost:5173. API docs: http://localhost:8000/docs.
Health check: http://localhost:8000/api/health.
The app runs without MongoDB; the health endpoint checks application liveness only.

## Environment variables
- frontend/.env: VITE_API_URL is the browser-visible API URL. VITE_ values are public; never put secrets there.
- backend/.env: CORS_ORIGINS is a JSON array of allowed frontend origins.
- MONGODB_URI is a private connection string; MONGODB_DB selects the database.
Use a dedicated MongoDB database user and configure network access for the deployment.
Copy env examples; keep real .env files out of Git.

## Deploy on Render
Create a Blueprint from this repo using render.yaml. Review service plans and costs before deploying.
Supply:
- Backend CORS_ORIGINS: `["https://YOUR-FRONTEND.onrender.com"]`
- Backend MONGODB_URI: your Atlas connection string (database features are still pending).
- Frontend VITE_API_URL: `https://YOUR-API.onrender.com`
After Render assigns URLs, update these values and redeploy the frontend; Vite embeds its URL during build.
MongoDB is configured separately; the Blueprint does not provision it.
ML is intentionally not installed in the API service.
Render local files are not a durable upload store; add object storage before implementing MP3 uploads.

## Next Git steps
The scaffold is already committed on main. Each teammate can clone it and start a feature branch:
```sh
git switch main
git pull origin main
git switch -c feat/room-joining
# Make and check your changes.
git add frontend/src backend/app docs
git commit -m "Add room joining"
git push -u origin feat/room-joining
```
Then open a pull request on GitHub and request a teammate review.
See CONTRIBUTING.md and docs/architecture.md for the team workflow and first milestones.
