"""
Persistence for the last successful VTOP sync.

One JSON file holding one student's most recent scrape. There is deliberately no
seeding, no defaulting and no backfilling: if a field is absent from the store it
is returned as ``None``, and the UI is expected to say "not available" rather
than show a plausible-looking number.

The disconnected state is a *shaped empty payload* — same keys as a real sync, no
values. That matters because it means every consumer sees one shape whether or
not VTOP has ever been reached, so "not synced" cannot be mistaken for data.
"""

import json
import logging
import os
from typing import Any, Dict

from app.vtop.math_engine import calculate_attendance_metrics, calculate_od_metrics

logger = logging.getLogger("vtop.storage")

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
DATA_FILE = os.path.join(DATA_DIR, "store.json")


def _data_file_for(reg_no: Optional[str] = None) -> str:
    if reg_no and reg_no.strip() and reg_no.strip() != "Not available":
        safe_reg = "".join(c for c in reg_no.strip().upper() if c.isalnum() or c in ("-", "_"))
        return os.path.join(DATA_DIR, f"store_{safe_reg}.json")
    return DATA_FILE

# Bumped whenever the payload shape changes incompatibly.
STORE_VERSION = 2

NOT_CONNECTED_MESSAGE = "VTOP is not connected. Sign in to sync your data."


def empty_student() -> Dict[str, Any]:
    return {
        "name": None,
        "regNo": None,
        "email": None,
        "program": None,
        "branch": None,
        "semester": None,
        "semesterId": None,
        "batch": None,
        "cgpa": None,
        "creditsEarned": None,
        "totalCreditsRequired": None,
        "registeredCredits": None,
        "rank": None,
        "overallAttendance": calculate_attendance_metrics(None, None),
        "semesterGpa": [],
        "lastSynced": None,
    }


def empty_store() -> Dict[str, Any]:
    """The shape of a sync payload, with nothing in it."""
    return {
        "storeVersion": STORE_VERSION,
        "authenticated": False,
        "message": NOT_CONNECTED_MESSAGE,
        "student": empty_student(),
        "semesters": [],
        "selectedSemester": None,
        "courses": [],
        "attendance": [],
        "marks": [],
        "timetable": [],
        "exams": {},
        "faculty": [],
        "receipts": [],
        "dues": {"hasDues": False, "totalDue": 0.0, "items": []},
        "fees": [],
        "spotlight": [],
        "proctor": None,
        "deanHod": [],
        "assignments": [],
        "aiTasks": [],
        "od": {**calculate_od_metrics(None), "records": [], "odRecords": [], "approvedHours": 0, "pendingHours": 0, "rejectedHours": 0},
        "registry": None,
        "syncReport": None,
        "lastSynced": None,
    }


def _retire_incompatible(path: str, reason: str) -> None:
    backup = f"{path}.old"
    try:
        os.replace(path, backup)
        logger.warning(
            "[Storage] %s — moved to %s and starting from a clean, empty store.",
            reason,
            os.path.basename(backup),
        )
    except Exception as exc:
        logger.error("[Storage] Could not set aside old store %s: %s", path, exc)


def load_store(reg_no: Optional[str] = None) -> Dict[str, Any]:
    """
    Return the synced payload for the specific student regNo, or fallback to active store,
    or return the shaped empty payload.
    """
    target_path = _data_file_for(reg_no)
    if not os.path.exists(target_path) and target_path != DATA_FILE:
        target_path = DATA_FILE

    if os.path.exists(target_path):
        try:
            with open(target_path, "r", encoding="utf-8") as handle:
                data = json.load(handle)
            if isinstance(data, dict) and data.get("storeVersion") == STORE_VERSION:
                # Ownership validation: if reg_no was requested, ensure the store belongs to that reg_no
                if reg_no and reg_no.strip() and reg_no.strip() != "Not available":
                    store_reg = (data.get("student") or {}).get("regNo")
                    if store_reg and store_reg.strip().upper() != reg_no.strip().upper():
                        logger.warning("[Storage] Store regNo %s mismatch with requested %s, returning empty", store_reg, reg_no)
                        return empty_store()
                return data
            elif isinstance(data, dict) and data:
                _retire_incompatible(target_path, f"store version mismatch in {target_path}")
        except Exception as exc:
            _retire_incompatible(target_path, f"unreadable store {target_path}: {exc}")

    return empty_store()


def save_store(data: Dict[str, Any], reg_no: Optional[str] = None) -> None:
    """
    Write the payload atomically to the student-specific store and active store.
    """
    try:
        os.makedirs(DATA_DIR, exist_ok=True)
        student_reg = reg_no or (data.get("student") or {}).get("regNo")
        targets = [DATA_FILE]
        if student_reg and student_reg.strip() and student_reg.strip() != "Not available":
            user_path = _data_file_for(student_reg)
            if user_path not in targets:
                targets.append(user_path)

        for target in targets:
            temp_path = f"{target}.tmp"
            with open(temp_path, "w", encoding="utf-8") as handle:
                json.dump({**data, "storeVersion": STORE_VERSION}, handle, indent=2)
            os.replace(temp_path, target)
        logger.info("[Storage] Saved VTOP sync for %s", student_reg or "active user")
    except Exception as exc:
        logger.error("[Storage] Could not write store: %s", exc)


def clear_store(reg_no: Optional[str] = None) -> None:
    """
    Remove the synced data on logout for the user and globally.
    """
    targets = [DATA_FILE]
    if reg_no and reg_no.strip() and reg_no.strip() != "Not available":
        targets.append(_data_file_for(reg_no))

    for target in targets:
        if os.path.exists(target):
            try:
                os.remove(target)
                logger.info("[Storage] Cleared %s", target)
            except Exception as exc:
                try:
                    with open(target, "w", encoding="utf-8") as handle:
                        json.dump(empty_store(), handle, indent=2)
                    logger.info("[Storage] Overwrote %s with empty store", target)
                except Exception:
                    pass
