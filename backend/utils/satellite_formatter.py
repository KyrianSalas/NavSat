"""
Helper functions to normalize satellite data from database format to satellite.js format
"""

def normalize_satellite_record(db_record: dict) -> dict:
    """
    Convert database snake_case format to uppercase satellite.js format.
    Removes nested relationships and extracts only orbital element fields.
    
    Args:
        db_record: Database record with snake_case keys
        
    Returns:
        Normalized record with uppercase keys for satellite.js compatibility
    """
    return {
        "OBJECT_NAME": db_record.get("object_name"),
        "OBJECT_ID": db_record.get("object_id"),
        "EPOCH": db_record.get("epoch"),
        "MEAN_MOTION": db_record.get("mean_motion"),
        "ECCENTRICITY": db_record.get("eccentricity"),
        "INCLINATION": db_record.get("inclination"),
        "RA_OF_ASC_NODE": db_record.get("ra_of_asc_node"),
        "ARG_OF_PERICENTER": db_record.get("arg_of_pericenter"),
        "MEAN_ANOMALY": db_record.get("mean_anomaly"),
        "EPHEMERIS_TYPE": db_record.get("ephemeris_type"),
        "CLASSIFICATION_TYPE": db_record.get("classification_type"),
        "NORAD_CAT_ID": db_record.get("norad_cat_id"),
        "ELEMENT_SET_NO": db_record.get("element_set_no"),
        "REV_AT_EPOCH": db_record.get("rev_at_epoch"),
        "BSTAR": db_record.get("bstar"),
        "MEAN_MOTION_DOT": db_record.get("mean_motion_dot"),
        "MEAN_MOTION_DDOT": db_record.get("mean_motion_ddot"),
    }


def normalize_satellite_list(db_records: list) -> list:
    """
    Normalize a list of database records to satellite.js format.
    
    Args:
        db_records: List of database records
        
    Returns:
        List of normalized records
    """
    return [normalize_satellite_record(record) for record in db_records]
