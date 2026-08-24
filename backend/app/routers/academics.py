"""
Legacy ``/api/*`` routes the frontend still calls.

Two groups:

* **VTOP-backed** (``/student``, ``/courses``, ``/timetable``, ``/attendance``,
  ``/marks``, ``/od``, ``/faculty``, ``/exams``) — thin reads of the persisted
  sync, identical to their ``/api/vtop/*`` counterparts. Kept so existing callers
  keep working.
* **Not VTOP data** (``/assignments``, ``/fees``, ``/placements``, ``/dsa``,
  ``/ai-tasks``) — app features whose data used to come from the mock generator.
  With the generator gone they are genuinely empty, and they return ``[]`` rather
  than something plausible. ``GET /api/features`` reports which sections have a
  real source so the UI can label an empty section as "no source yet" instead of
  "you have no assignments".
"""

import logging
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.storage import empty_store, load_store, save_store
from app.vtop.hostel import fetch_laundry_schedule, fetch_mess_menu

logger = logging.getLogger("vtop.routes.academics")

router = APIRouter(prefix="/api", tags=["academics"])


class AssignmentStatusUpdate(BaseModel):
    status: str


# ---------------------------------------------------------------------------
# VTOP-backed
# ---------------------------------------------------------------------------


@router.get("/student")
def get_student_profile() -> Dict[str, Any]:
    store = load_store()
    return store.get("student") or empty_store()["student"]


@router.get("/courses")
def get_courses() -> List[Dict[str, Any]]:
    return load_store().get("courses") or []


@router.get("/timetable")
def get_timetable() -> List[Dict[str, Any]]:
    return load_store().get("timetable") or []


@router.get("/attendance")
def get_attendance() -> List[Dict[str, Any]]:
    return load_store().get("attendance") or []


@router.get("/marks")
def get_marks() -> List[Dict[str, Any]]:
    return load_store().get("marks") or []


@router.get("/od")
def get_od() -> Dict[str, Any]:
    """
    On-duty hours extracted directly from VTOP leave modules.
    """
    store = load_store()
    od = store.get("od") or empty_store()["od"]
    used = od.get("usedHours") if od.get("usedHours") is not None else (od.get("odHours") if od.get("odHours") is not None else (0 if od.get("hasValidData") else None))
    max_h = od.get("maxHours") or od.get("maxOdHours") or 40
    records = od.get("records") or od.get("odRecords") or []
    return {
        **od,
        "usedHours": used,
        "odHours": used,
        "totalOdHours": used,
        "maxHours": max_h,
        "maxOdHours": max_h,
        "records": records,
        "odRecords": records,
    }


@router.get("/faculty")
def get_faculty() -> List[Dict[str, Any]]:
    return load_store().get("faculty") or []


@router.get("/exams")
def get_exams() -> Dict[str, List[Dict[str, Any]]]:
    """Grouped by exam type, matching ``/api/vtop/exams``."""
    exams = load_store().get("exams")
    return exams if isinstance(exams, dict) else {}


@router.get("/receipts")
def get_receipts() -> List[Dict[str, Any]]:
    return load_store().get("receipts") or []


@router.get("/dues")
def get_dues() -> Dict[str, Any]:
    return load_store().get("dues") or {"hasDues": False, "totalDue": 0.0, "items": []}


@router.get("/spotlight")
def get_spotlight() -> List[Dict[str, Any]]:
    return load_store().get("spotlight") or []


@router.get("/proctor")
def get_proctor() -> Optional[Dict[str, Any]]:
    return load_store().get("proctor")


@router.get("/hostel/mess")
def get_hostel_mess(type: str = "M-N") -> List[Dict[str, Any]]:
    return fetch_mess_menu(type)


@router.get("/hostel/laundry")
def get_hostel_laundry(block: str = "A") -> List[Dict[str, Any]]:
    return fetch_laundry_schedule(block)


# ---------------------------------------------------------------------------
# app features
# ---------------------------------------------------------------------------

UNSOURCED_SECTIONS: Dict[str, str] = {
    "placements": "Placement drives are tracked via university placement portal and eligibility calculation.",
    "dsa": "The DSA tracker is a CampusOS study feature.",
}


@router.get("/features")
def get_feature_availability() -> Dict[str, Dict[str, Any]]:
    """
    Which dashboard sections currently have real data behind them.
    """
    store = load_store()
    report = (store.get("syncReport") or {}).get("modules") or {}
    is_auth = bool(store.get("authenticated"))

    def vtop_section(name: str, key: str) -> Dict[str, Any]:
        value = store.get(key)
        count = len(value) if isinstance(value, (list, dict)) else 0
        status = (report.get(name) or {}).get("status")
        return {
            "source": "vtop",
            "available": is_auth,
            "count": count,
            "status": status,
            "message": (report.get(name) or {}).get("message"),
        }

    od_data = store.get("od") or {}
    od_has_valid = bool(od_data.get("hasValidData"))
    od_count = len(od_data.get("records") or od_data.get("odRecords") or [])

    features: Dict[str, Dict[str, Any]] = {
        "attendance": vtop_section("attendance", "attendance"),
        "marks": vtop_section("marks", "marks"),
        "timetable": vtop_section("timetableGrid", "timetable"),
        "courses": vtop_section("courses", "courses"),
        "exams": vtop_section("exams", "exams"),
        "od": {
            "source": "vtop" if od_has_valid else None,
            "available": is_auth and od_has_valid,
            "count": od_count,
            "status": (report.get("od") or {}).get("status") or (od_data.get("state") if od_has_valid else "unavailable"),
            "message": (report.get("od") or {}).get("message") or od_data.get("message"),
        },
    }

    if store.get("fees"):
        features["fees"] = {
            "source": "vtop",
            "available": True,
            "count": len(store.get("fees")),
            "status": "ok",
            "message": None,
        }
    else:
        features["fees"] = {
            "source": None,
            "available": False,
            "count": 0,
            "status": "unavailable",
            "message": "Not synced yet. VTOP exposes dues and receipts at p2p/Payments and p2p/getReceiptsApplno; those parsers are not written yet.",
        }

    if store.get("assignments"):
        features["assignments"] = {
            "source": "vtop",
            "available": True,
            "count": len(store.get("assignments")),
            "status": "ok",
            "message": None,
        }
    else:
        features["assignments"] = {
            "source": None,
            "available": False,
            "count": 0,
            "status": "unavailable",
            "message": "VTOP has no assignment listing this integration can read. Digital Assignment marks do appear per course under /api/vtop/marks.",
        }

    if store.get("aiTasks"):
        features["aiTasks"] = {
            "source": "local-ai",
            "available": True,
            "count": len(store.get("aiTasks")),
            "status": "ok",
            "message": None,
        }
    else:
        features["aiTasks"] = {
            "source": None,
            "available": False,
            "count": 0,
            "status": "unavailable",
            "message": "AI study tasks are generated locally; nothing is synced yet.",
        }

    for key, reason in UNSOURCED_SECTIONS.items():
        features[key] = {
            "source": None,
            "available": False,
            "count": 0,
            "status": "unavailable",
            "message": reason,
        }
    return features


@router.get("/assignments")
def get_assignments() -> List[Dict[str, Any]]:
    return load_store().get("assignments") or []


@router.post("/assignments/{assignment_id}/status")
def update_assignment_status(
    assignment_id: str, payload: AssignmentStatusUpdate
) -> Dict[str, Any]:
    store = load_store()
    assignments = store.get("assignments") or []
    for assignment in assignments:
        if assignment.get("id") == assignment_id:
            assignment["status"] = payload.status
            save_store(store)
            return assignment
    raise HTTPException(status_code=404, detail=f"No assignment {assignment_id}")


@router.get("/fees")
def get_fees() -> List[Dict[str, Any]]:
    return load_store().get("fees") or []


@router.get("/placements")
def get_placements() -> List[Dict[str, Any]]:
    return load_store().get("placements") or []


@router.get("/dsa")
def get_dsa_topics() -> List[Dict[str, Any]]:
    return load_store().get("dsaTopics") or []


@router.get("/ai-tasks")
def get_ai_tasks() -> List[Dict[str, Any]]:
    return load_store().get("aiTasks") or []

