import requests
from fastapi import HTTPException

def get_top100_satellites():
    # Defines URL as a JSON, top 100 brightest satellites
    # https://celestrak.org/NORAD/elements/table.php?GROUP=visual&FORMAT=tle
    url = "https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=JSON-PRETTY"

    try:
        # Request data from the celestrak URL
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        orbital_list = response.json()

        if not isinstance(orbital_list, list):
            orbital_list = [orbital_list]

        # Returns valid satellites collected (should be ~100)
        print(f"{len(orbital_list)} satellites retrieved")
        return orbital_list
    except Exception as e:
        HTTPException(status_code=503, detail=f"CelesTrak API error: {str(e)}")
