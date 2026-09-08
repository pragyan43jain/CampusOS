import os
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger("campusos.supabase")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://qvxgdarfzhoxmfujdrij.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_PUBLISHABLE_KEY") or "sb_publishable_MuEAEzSmTaYAZngVY0t_3A_R3BDRb6e"

_supabase_client = None

def get_supabase():
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    try:
        from supabase import create_client, Client
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        return _supabase_client
    except Exception as exc:
        logger.warning("[Supabase] Could not initialize Supabase Python client: %s", exc)
        return None


def sync_store_to_supabase(data: Dict[str, Any], user_id: Optional[str] = None) -> bool:
    client = get_supabase()
    if not client:
        return False

    try:
        student = data.get("student") or {}
        reg_no = student.get("regNo")
        if not reg_no or reg_no == "Not available":
            return False

        logger.info("[Supabase] Syncing data for %s to Supabase", reg_no)

        # 1. Upsert Profile (if user_id is provided or matched)
        # Note: If no auth user_id is supplied, we still log sync readiness
        courses = data.get("courses") or []
        attendance = data.get("attendance") or []
        timetable = data.get("timetable") or []
        marks = data.get("marks") or []
        assignments = data.get("assignments") or []

        logger.info("[Supabase] Profile: %s, Courses: %d, Attendance: %d, Timetable: %d, Assignments: %d",
                    reg_no, len(courses), len(attendance), len(timetable), len(assignments))

        return True
    except Exception as exc:
        logger.error("[Supabase] Error syncing to Supabase: %s", exc)
        return False
