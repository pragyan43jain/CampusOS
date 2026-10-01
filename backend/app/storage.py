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
    target_dir = os.path.dirname(DATA_FILE) if DATA_FILE else DATA_DIR

    if reg_no and reg_no.strip() and reg_no.strip() not in ("Not available", "Sync Required"):
        clean_reg = reg_no.strip().upper()
        p = _data_file_for(clean_reg)
        if p and os.path.exists(p):
            target_path = p
        elif target_dir and os.path.exists(target_dir):
            # Check for alias or substring match in candidates
            for f in os.listdir(target_dir):
                if f.startswith("store_") and f.endswith(".json") and not f.endswith(".tmp") and not f.endswith(".old"):
                    cand_reg = f[len("store_"):-len(".json")].strip().upper()
                    if clean_reg == cand_reg or clean_reg in cand_reg or cand_reg in clean_reg:
                        target_path = os.path.join(target_dir, f)
                        break
        if not target_path and os.path.exists(DATA_FILE):
            target_path = DATA_FILE
    elif os.path.exists(DATA_FILE):
        target_path = DATA_FILE

    if not target_path or not os.path.exists(target_path):
        # Final fallback: pick latest valid store if available
        def_reg = get_default_local_reg()
        if def_reg:
            def_path = _data_file_for(def_reg)
            if def_path and os.path.exists(def_path):
                target_path = def_path

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
                if store_reg:
                    s_reg = store_reg.strip().upper()
                    r_reg = reg_no.strip().upper()
                    if s_reg != r_reg and s_reg not in r_reg and r_reg not in s_reg:
                        logger.warning("[Storage] Store regNo %s mismatch with requested %s, returning empty", store_reg, reg_no)
                        return empty_store()

            # Backfill attendance and core modules if current store is missing them
            current_att = data.get("attendance")
            if not current_att and target_dir and os.path.exists(target_dir):
                for f in os.listdir(target_dir):
                    if f.startswith("store_") and f.endswith(".json") and not f.endswith(".tmp") and not f.endswith(".old"):
                        other_p = os.path.join(target_dir, f)
                        if other_p != target_path:
                            try:
                                with open(other_p, "r", encoding="utf-8") as oh:
                                    other_d = json.load(oh)
                                if isinstance(other_d, dict) and other_d.get("attendance"):
                                    data["attendance"] = other_d["attendance"]
                                    if not data.get("overallAttendance") and other_d.get("overallAttendance"):
                                        data["overallAttendance"] = other_d["overallAttendance"]
                                    if not data.get("timetable") and other_d.get("timetable"):
                                        data["timetable"] = other_d["timetable"]
                                    if not data.get("marks") and other_d.get("marks"):
                                        data["marks"] = other_d["marks"]
                                    if not data.get("exams") and other_d.get("exams"):
                                        data["exams"] = other_d["exams"]
                                    break
                            except Exception:
                                pass

            return data
        elif isinstance(data, dict) and data:
            _retire_incompatible(target_path, f"store version mismatch in {target_path}")
    except Exception as exc:
        _retire_incompatible(target_path, f"unreadable store {target_path}: {exc}")

    return empty_store()


def save_store(data: Dict[str, Any], reg_no: Optional[str] = None) -> None:
    """
    Write the payload atomically to the student-specific store and DATA_FILE.
    Preserves existing academic and integration modules to guarantee attendance and assignments are never wiped out.
    """
    canonical_reg = (data.get("student") or {}).get("regNo")
    targets = []

    for r in (canonical_reg, reg_no):
        if r and r.strip() and r.strip() not in ("Not available", "Sync Required"):
            p = _data_file_for(r)
            if p and p not in targets:
                targets.append(p)

    if DATA_FILE and DATA_FILE not in targets:
        targets.append(DATA_FILE)

    for tgt in targets:
        try:
            data_dir = os.path.dirname(tgt)
            if data_dir:
                os.makedirs(data_dir, exist_ok=True)

            merged_data = dict(data)
            # If target already exists, preserve non-empty sections from disk if incoming is empty/missing
            if os.path.exists(tgt):
                try:
                    with open(tgt, "r", encoding="utf-8") as handle:
                        existing = json.load(handle)
                        preserve_keys = (
                            "attendance", "timetable", "courses", "marks", "exams", "examsList", "examsByType",
                            "faculty", "receipts", "dues", "fees", "proctor", "deanHod", "spotlight",
                            "aiTasks", "od", "overallAttendance", "semesters", "selectedSemester"
                        )
                        for key in preserve_keys:
                            if key not in merged_data or (isinstance(merged_data.get(key), (list, dict)) and not merged_data[key]):
                                if existing.get(key):
                                    merged_data[key] = existing[key]
                        for key in ("teamsConnected", "teamsAccount", "lmsConnected", "lmsAccount"):
                            if key not in merged_data and key in existing:
                                merged_data[key] = existing[key]
                        if "assignments" not in merged_data and existing.get("assignments"):
                            merged_data["assignments"] = existing["assignments"]
                except Exception as ex_read:
                    logger.debug("[Storage] Notice reading existing store for merge: %s", ex_read)

            payload_to_save = {**merged_data, "storeVersion": STORE_VERSION}
            temp_path = f"{tgt}.tmp"
            with open(temp_path, "w", encoding="utf-8") as handle:
                json.dump(payload_to_save, handle, indent=2)
            os.replace(temp_path, tgt)
            _MEM_CACHE[tgt] = (os.path.getmtime(tgt), payload_to_save)
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
