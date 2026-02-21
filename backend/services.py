from fastapi import requests

def get_top100_satellites():
    # Defines URL as a JSON, top 100 brightest satellites
    # https://celestrak.org/NORAD/elements/table.php?GROUP=visual&FORMAT=tle
    url = "https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=JSON-PRETTY"

    try:
        # Request data from the celestrak URL
        response = requests.get(url)
        response.raise_for_status()
        orbital_list = response.json()

        # Returns valid satellites collected (should be ~100)
        print(f"{len(orbital_list)} satellites retrieved")
        return orbital_list
    except Exception as e:
         return f"celestrak api error ${e}"