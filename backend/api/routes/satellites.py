from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
from services import get_top100_satellites

router = APIRouter()

# Pydantic model for satellite
class Satellite(BaseModel):
	id: str
	name: str
	position: dict  # e.g., {"lat": float, "lon": float, "alt": float}
	status: str
	# Add other standard vars as needed

# Dummy data for now
satellites_db = [
	Satellite(id="25544", name="ISS", position={"lat": 51.6, "lon": -0.1, "alt": 408}, status="active"),
	Satellite(id="40069", name="Hubble", position={"lat": 28.5, "lon": -80.6, "alt": 547}, status="active"),
]

@router.get("/satellites")
def list_satellites():
	# return satellites_db
	return get_top100_satellites()

@router.get("/satellites/{satellite_id}", response_model=Satellite)
def get_satellite(satellite_id: str):
	for sat in satellites_db:
		if sat.id == satellite_id:
			return sat
	return {"error": "Satellite not found"}

# Placeholder for tracking endpoint
@router.get("/satellites/{satellite_id}/track")
def track_satellite(satellite_id: str):
	# Integrate Celeste tracking here
	return {"satellite_id": satellite_id, "tracking": "Not implemented"}
