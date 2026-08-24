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

DATA_FILE = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), "data", "store.json"
)

# Bumped whenever the payload shape changes incompatibly.
#
# 1 = the original build (exams was a list; student carried invented defaults like
#     cgpa and totalCreditsRequired=160; no syncReport or registry).
# 2 = the VTOP-sync rewrite (exams grouped by type, strict nulls, syncReport).
#
# A store written by an older version is discarded rather than served. Without
# this, an existing store.json full of the old placeholder data would be read back
# as though it were a real sync — the dashboard would show a CGPA of 8.85 and a
# room called "Academic Block 1" while /status correctly reported "not connected".
# Silently plausible stale data is the exact failure this rewrite exists to remove.
STORE_VERSION = 2

NOT_CONNECTED_MESSAGE = "VTOP is not connected. Sign in to sync your data."


def empty_student() -> Dict[str, Any]:
    """
    A student header with no data in it.

    Every field is ``None`` — not "Not available", not 0, not 160. A string
    placeholder in a data field eventually gets rendered as though it were a
    value, or compared against as though it were a real registration number,
    which is exactly what the previous version did.
    """
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
        # Grouped by exam type ("CAT 1", "FAT", ...), so a mapping rather than a
        # list. An empty mapping means nothing was published.
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
        "od": {**calculate_od_metrics(None), "records": []},
        "registry": None,
        "syncReport": None,
        "lastSynced": None,
    }


def _retire_incompatible(reason: str) -> None:
    """
    Move an unusable store aside instead of deleting it.

    Renaming rather than removing means a store written by a future version — or
    one we misjudged — is still on disk to inspect, and the user's own data is
    never destroyed by an upgrade.
    """
    backup = f"{DATA_FILE}.old"
    try:
        os.replace(DATA_FILE, backup)
        logger.warning(
            "[Storage] %s — moved to %s and starting from a clean, empty store. "
            "Sign in to VTOP to sync real data.",
            reason,
            os.path.basename(backup),
        )
    except Exception as exc:
        logger.error("[Storage] Could not set aside the old store: %s", exc)


def load_store() -> Dict[str, Any]:
    """
    Return the last synced payload, or the shaped empty payload.

    A corrupt file is treated as absent rather than raising: losing the cache is
    recoverable by syncing again, whereas a 500 on every read is not. A store from
    an incompatible version is treated the same way — see ``STORE_VERSION``.
    """
    if os.path.exists(DATA_FILE):
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as handle:
                data = json.load(handle)
            if not isinstance(data, dict) or not data:
                logger.warning(
                    "[Storage] store.json held %s, ignoring", type(data).__name__
                )
            elif data.get("storeVersion") != STORE_VERSION:
                _retire_incompatible(
                    f"store.json was written by an incompatible version "
                    f"(found {data.get('storeVersion')!r}, need {STORE_VERSION})"
                )
            else:
                return data
        except Exception as exc:
            _retire_incompatible(f"store.json was unreadable or corrupt: {exc}")

    return empty_store()


def save_store(data: Dict[str, Any]) -> None:
    """
    Write the payload atomically, stamped with the current shape version.

    The temp-file-then-rename dance matters: a crash midway through a plain write
    leaves truncated JSON, and the next read would silently fall back to the
    empty store — the user would see their whole dashboard blank with no
    explanation.
    """
    try:
        os.makedirs(os.path.dirname(DATA_FILE), exist_ok=True)
        temp_path = f"{DATA_FILE}.tmp"
        with open(temp_path, "w", encoding="utf-8") as handle:
            json.dump({**data, "storeVersion": STORE_VERSION}, handle, indent=2)
        os.replace(temp_path, DATA_FILE)
        logger.info("[Storage] Saved VTOP sync to store.json")
    except Exception as exc:
        logger.error("[Storage] Could not write store.json: %s", exc)


def clear_store() -> None:
    """
    Remove the synced data on logout.

    If the file cannot be unlinked, it is overwritten with the empty store rather
    than left alone. Deletion fails for ordinary reasons — a read-only mount, a
    synced folder, Windows holding the handle open — and the old code logged the
    error and returned, so ``POST /vtop/logout`` reported success while the
    previous student's name, registration number, CGPA and attendance stayed
    readable on disk and were served again on the next request. Overwriting is the
    weaker guarantee but it is the one that actually clears the data.
    """
    if not os.path.exists(DATA_FILE):
        return

    try:
        os.remove(DATA_FILE)
        logger.info("[Storage] Cleared store.json")
        return
    except Exception as exc:
        logger.warning(
            "[Storage] Could not delete store.json (%s) — overwriting it instead", exc
        )

    try:
        with open(DATA_FILE, "w", encoding="utf-8") as handle:
            json.dump(empty_store(), handle, indent=2)
        logger.info("[Storage] Overwrote store.json with an empty store")
    except Exception as exc:
        # Both paths failed, so the data is still on disk. This must be loud: the
        # caller has told the user they are logged out.
        logger.error(
            "[Storage] COULD NOT CLEAR store.json (%s). Synced academic data is "
            "still on disk at %s — delete it manually.",
            exc,
            DATA_FILE,
        )
