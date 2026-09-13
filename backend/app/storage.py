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

from __future__ import annotations

import json
import logging
import os
import tempfile
from typing import Any, Dict, Optional

from app.vtop.math_engine import calculate_attendance_metrics, calculate_od_metrics

logger = logging.getLogger("vtop.storage")

# Determine writable directory safely across local and serverless runtimes
if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
    DATA_DIR = os.path.join(tempfile.gettempdir(), "campusos_data")
else:
    DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")

DATA_FILE = os.path.join(DATA_DIR, "store.json")


def _data_file_for(reg_no: Optional[str] = None) -> Optional[str]:
    if reg_no and reg_no.strip() and reg_no.strip() not in ("Not available", "Sync Required"):
        safe_reg = "".join(c for c in reg_no.strip().upper() if c.isalnum() or c in ("-", "_"))
        if safe_reg:
            # Derive directory from current DATA_FILE so monkeypatching in tests works correctly
            current_dir = os.path.dirname(DATA_FILE) if DATA_FILE else DATA_DIR
            return os.path.join(current_dir, f"store_{safe_reg}.json")
    return None


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
        "school": None,
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


_MEM_CACHE: Dict[str, Tuple[float, Dict[str, Any]]] = {}


def get_default_local_reg() -> Optional[str]:
    """
    Find existing student store files in the active data directory.
    If a valid store exists, return the student registration number.
    This guarantees that on local, preview, or single-student deployments, data is never
    lost due to temporary session restarts or missing request headers.
    """
    target_dir = os.path.dirname(DATA_FILE) if DATA_FILE else DATA_DIR
    if not target_dir or not os.path.exists(target_dir):
        return None
    try:
        candidates = [
            f for f in os.listdir(target_dir)
            if f.startswith("store_") and f.endswith(".json") and not f.endswith(".tmp") and not f.endswith(".old")
        ]
        if not candidates:
            return None
        # Sort candidates by modification time descending to prioritize active student
        candidates.sort(key=lambda f: os.path.getmtime(os.path.join(target_dir, f)), reverse=True)
        for cand in candidates:
            reg = cand[len("store_"):-len(".json")].strip().upper()
            if reg and reg not in ("NOT AVAILABLE", "SYNC REQUIRED"):
                return reg
    except Exception as exc:
        logger.warning("[Storage] Error detecting default local store: %s", exc)
    return None


def load_store(reg_no: Optional[str] = None) -> Dict[str, Any]:
    """
    Return the synced payload for the specific student regNo, or return the shaped empty payload.
    Supports DATA_FILE when reg_no is omitted or student file does not exist (for test isolation and backwards compatibility).
    """
    target_path = None
    if reg_no and reg_no.strip() and reg_no.strip() not in ("Not available", "Sync Required"):
        p = _data_file_for(reg_no)
        if p and os.path.exists(p):
            target_path = p
        elif os.path.exists(DATA_FILE):
            target_path = DATA_FILE
    elif os.path.exists(DATA_FILE):
        target_path = DATA_FILE

    if not target_path or not os.path.exists(target_path):
        return empty_store()

    try:
        mtime = os.path.getmtime(target_path)
        cached = _MEM_CACHE.get(target_path)
        if cached and cached[0] == mtime:
            data = cached[1]
        else:
            with open(target_path, "r", encoding="utf-8") as handle:
                data = json.load(handle)
            if isinstance(data, dict) and data.get("storeVersion") == STORE_VERSION:
                _MEM_CACHE[target_path] = (mtime, data)

        if isinstance(data, dict) and data.get("storeVersion") == STORE_VERSION:
            if reg_no and reg_no.strip() and reg_no.strip() not in ("Not available", "Sync Required"):
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
    Write the payload atomically to the student-specific store and DATA_FILE.
    """
    student_reg = reg_no or (data.get("student") or {}).get("regNo")
    target = None
    if student_reg and student_reg.strip() and student_reg.strip() not in ("Not available", "Sync Required"):
        target = _data_file_for(student_reg)

    targets = [target] if target else []
    if DATA_FILE and DATA_FILE not in targets:
        targets.append(DATA_FILE)

    for tgt in targets:
        try:
            data_dir = os.path.dirname(tgt)
            if data_dir:
                os.makedirs(data_dir, exist_ok=True)

            temp_path = f"{tgt}.tmp"
            with open(temp_path, "w", encoding="utf-8") as handle:
                json.dump({**data, "storeVersion": STORE_VERSION}, handle, indent=2)
            os.replace(temp_path, tgt)
            _MEM_CACHE[tgt] = (os.path.getmtime(tgt), {**data, "storeVersion": STORE_VERSION})
            logger.info("[Storage] Saved store to %s", tgt)
        except Exception as exc:
            logger.error("[Storage] Could not write store %s: %s", tgt, exc)


def clear_store(reg_no: Optional[str] = None) -> None:
    """
    Remove the synced data on logout for the user.
    """
    targets = []
    if reg_no and reg_no.strip() and reg_no.strip() not in ("Not available", "Sync Required"):
        target = _data_file_for(reg_no)
        if target:
            targets.append(target)
    if DATA_FILE and DATA_FILE not in targets and os.path.exists(DATA_FILE):
        targets.append(DATA_FILE)

    for tgt in targets:
        _MEM_CACHE.pop(tgt, None)
        if os.path.exists(tgt):
            try:
                os.remove(tgt)
                logger.info("[Storage] Cleared store %s", tgt)
            except Exception as exc:
                logger.warning("[Storage] Could not remove store %s, overwriting with empty store: %s", tgt, exc)
                try:
                    with open(tgt, "w", encoding="utf-8") as handle:
                        json.dump(empty_store(), handle)
                except Exception as write_exc:
                    logger.error("[Storage] Could not overwrite store %s: %s", tgt, write_exc)
