from fastapi import APIRouter, HTTPException
from typing import List
from services.satellite_service import get_top100_satellites, get_satellite_by_id
from models.satellite import SatelliteData
from services.supabase_service import insert_satellite_data

router = APIRouter()


@router.get("/satellites/cache")
@router.post("/satellites/cache")
def cache_satellites():
    fetched_data = get_top100_satellites()
    results = []
    for sat in fetched_data:
        try:
            validated = SatelliteData(**sat)
            insert_satellite_data(validated)
            results.append({"object_id": validated.OBJECT_ID, "status": "success"})
        except Exception as e:
            results.append({"object_id": sat.get("OBJECT_ID", "unknown"), "error": str(e)})
    return {"results": results}

@router.get("/satellites", response_model=List[SatelliteData])
def list_satellites():
    return get_top100_satellites()


@router.get("/satellites/{satellite_norad_id}", response_model=SatelliteData)
def get_satellite(satellite_norad_id: str):
    return get_satellite_by_id(satellite_norad_id)