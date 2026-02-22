#!/usr/bin/env python3
"""Export descriptions - store as { satellite_id: description }."""
import json
from services.supabase_service import supabase

print("Fetching ALL satellites...")

# Get ALL satellites with any data
response = supabase.table("satellites").select("norad_cat_id, object_name, description, satellite_category_map(category_id, categories(name))").execute()

if not response.data:
    print("No satellites found")
    exit(1)

# Filter to only those in 'visual' category with descriptions
descriptions = {}
visual_count = 0

for sat in response.data:
    norad_id = sat["norad_cat_id"]
    desc = sat.get("description")
    
    # Check if it's in visual category
    cat_map = sat.get("satellite_category_map", [])
    is_visual = False
    if isinstance(cat_map, list):
        for cat in cat_map:
            if isinstance(cat, dict) and cat.get("categories", {}).get("name") == "visual":
                is_visual = True
                visual_count += 1
                break
    
    if is_visual and desc:
        # Skip Starlink
        name = sat.get("object_name", "").upper()
        if "STARLINK" not in name:
            descriptions[str(norad_id)] = desc

print(f"Total visual satellites: {visual_count}")
print(f"Unique non-Starlink descriptions exported: {len(descriptions)}")

# Save to src/descriptions.json
import os
export_path = os.path.join(os.path.dirname(__file__), "..", "src", "descriptions.json")
with open(export_path, 'w') as f:
    json.dump(descriptions, f, indent=2)

print(f"Saved to {export_path}")

# Show first few
if descriptions:
    for norad_id, desc in list(descriptions.items())[:3]:
        print(f"  {norad_id}: {desc[:60]}...")
