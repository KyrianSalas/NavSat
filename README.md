# BrisHack Satellite Tracker

This project is a full-stack satellite tracking platform built for BrisHack. It features a FastAPI backend for real-time and historical satellite data, and a modern frontend for visualization and interaction.

## Features
- Fetches and validates satellite data from Celeste
- Stores satellite data in Supabase for caching and historical queries
- REST API endpoints for satellite information
- Scheduled updates every two hours
- Pydantic models for data validation
- Interactive frontend for satellite visualization and search

## Tech Stack
### Backend
- **FastAPI**: Web framework for building APIs
- **Celeste**: Satellite tracking and data provider
- **Supabase**: Database and authentication backend
- **Pydantic**: Data validation and settings management
- **Uvicorn**: ASGI server for FastAPI
- **Python**: Core language


### Frontend

## Setup
### Backend
1. Clone the repository
2. Create a virtual environment and install dependencies
3. Copy `backend/.env.example` to `backend/.env` and fill in your keys
4. Run the backend:
	- For development: `uvicorn backend.main:app --reload`
	- Or: `python3 backend/main.py reload`


### Frontend
1. Navigate to the frontend directory
2. Run `npm install` to install dependencies
3. Run `npm run dev` to start the Vite development server

## Folder Structure
- `backend/main.py`: FastAPI app entry point
- `backend/core/config.py`: Configuration and environment variables
- `backend/models/satellite.py`: Pydantic model for satellite data
- `backend/services/supabase_service.py`: Supabase integration
- `backend/api/routes/satellites.py`: API endpoints
- `frontend/`: Frontend application (React/Svelte/Vue)

## Satellite Loading Optimisations
The frontend and API client include targeted optimisations to improve how quickly satellites appear and how responsive group switching feels.

### 1. Faster API fallback from local to remote
- File: `src/api/satelliteService.js`
- `LOCAL_REQUEST_TIMEOUT_MS` (1100ms) is used for local API requests.
- If local API is slow/unavailable, the client quickly falls back to `https://api.navsat.co.uk`.
- Benefit: reduced startup delay when local backend is not running.

### 2. In-memory caching by satellite group
- File: `src/api/satelliteService.js`
- `satelliteGroupCache` stores results per group with `SATELLITE_CACHE_TTL_MS` (60 seconds).
- Benefit: repeat requests for the same group return immediately for a short window.

### 3. In-flight request de-duplication
- File: `src/api/satelliteService.js`
- `inflightSatelliteRequests` ensures only one active network request per group at a time.
- Benefit: avoids duplicate fetches and reduces unnecessary network/CPU load.

### 4. Abort-aware fetching
- Files: `src/api/satelliteService.js`, `src/main.js`
- Uses `AbortController` so canceled group loads stop network work early.
- Benefit: prevents stale results and speeds up rapid group switching.

### 5. Race-safe group switching
- File: `src/main.js`
- `satelliteLoadToken` + `satelliteLoadController` ensure only the latest group load can populate the scene.
- Benefit: older requests cannot overwrite newer selections.

### 6. Initial satellite transform seeded at build time
- File: `src/main.js`
- During mesh creation (`buildSatelliteMeshes`), each satellite gets an initial propagated position.
- Benefit: satellites appear in valid positions sooner after load.

### 7. Throttled satellite orbit updates
- File: `src/main.js`
- `SATELLITE_UPDATE_INTERVAL_MS` is set to `120`.
- Benefit: heavy orbital math runs less frequently, improving frame stability on larger groups.
- Tradeoff: slightly less smooth motion than per-frame updates.

### 8. Reduced per-update computation
- File: `src/main.js`
- Reuses computed values (for example `gmstNow` once per update cycle).
- Precomputes constants such as `TRAIL_STEP_MS`.
- Benefit: less repeated math in hot paths.

### 9. Lower allocation pressure (less GC churn)
- File: `src/main.js`
- Reuses a shared `THREE.Color` for instance colors.
- Stores per-satellite `Float32Array` trail buffers (`trailPositions`) and rewrites them in place.
- Benefit: fewer short-lived allocations during animation updates.

### 10. Faster satellite selection lookup
- File: `src/main.js`
- Click handling now uses direct indexing: `activeSatellites[instanceId]`.
- Benefit: avoids per-click linear search (`find`) across all satellites.

### Tunable performance knobs
- `src/main.js`: `SATELLITE_UPDATE_INTERVAL_MS`
  - Lower value = smoother updates, higher CPU usage.
  - Higher value = better performance, less smooth updates.
- `src/api/satelliteService.js`: `LOCAL_REQUEST_TIMEOUT_MS`
  - Lower value = faster remote fallback.
  - Higher value = waits longer for local backend before fallback.
- `src/api/satelliteService.js`: `SATELLITE_CACHE_TTL_MS`
  - Higher value = more cache hits, less freshness.
  - Lower value = fresher data, more network calls.

## License
MIT
