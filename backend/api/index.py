import logging
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes.satellites import router as satellites_router
from core.config import settings

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="Satellite Tracking API", version="1.0")

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(satellites_router)

@app.get("/")
def root():
    return {"message": "Welcome to the Satellite Tracking API"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)