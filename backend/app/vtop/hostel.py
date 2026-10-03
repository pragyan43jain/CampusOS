"""
Hostel data manager for VIT Chennai: Mess menus, Laundry schedules, and Leave tracking.
Data source is the unmessify JSON repository and VTOP Hostel Leave modules.
"""

import json
import logging
import os
import urllib.request
from typing import Any, Dict, List, Optional
from bs4 import BeautifulSoup

logger = logging.getLogger("vtop.hostel")

BASE_URL = "https://kanishka-developer.github.io/unmessify/json/en"

_MESS_CACHE: Dict[str, List[Dict[str, Any]]] = {}
_LAUNDRY_CACHE: Dict[str, List[Dict[str, Any]]] = {}

# Locate local frontend public directory for instant offline / cached fallbacks
_FRONTEND_PUBLIC = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "frontend", "public")
)


def _load_local_json(subpath: str) -> Optional[List[Dict[str, Any]]]:
    """Try loading static JSON from local frontend/public folder."""
    local_path = os.path.join(_FRONTEND_PUBLIC, subpath)
    if os.path.exists(local_path):
        try:
            with open(local_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict) and "list" in data:
                    return data["list"]
                if isinstance(data, list):
                    return data
        except Exception as exc:
            logger.debug("[Hostel] Failed to read local %s: %s", subpath, exc)
    return None


def fetch_mess_menu(mess_type: str = "M-N") -> List[Dict[str, Any]]:
    """
    Fetch mess menu for a given mess type.
    Types: M-N (Men North), M-S (Men South), M-V (Men Veg), W-N, W-S, W-V
    """
    mess_type = mess_type.upper().strip()
    if mess_type in _MESS_CACHE:
        return _MESS_CACHE[mess_type]

    # 1. Try local bundled JSON first
    local_items = _load_local_json(os.path.join("mess", f"VITC-{mess_type}.json"))
    if local_items:
        _MESS_CACHE[mess_type] = local_items
        return local_items

    # 2. Try remote unmessify repository
    url = f"{BASE_URL}/VITC-{mess_type}.json"
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
        )
        with urllib.request.urlopen(req, timeout=6) as res:
            data = json.loads(res.read().decode("utf-8"))
            items = data.get("list") or []
            _MESS_CACHE[mess_type] = items
            return items
    except Exception as exc:
        logger.warning("[Hostel] Failed to fetch mess menu for %s: %s", mess_type, exc)
        return _MESS_CACHE.get(mess_type, [])


def fetch_laundry_schedule(block: str = "A") -> List[Dict[str, Any]]:
    """
    Fetch laundry schedule for a given block.
    Blocks: A, B, CB, CG, C, D1, D2, E
    """
    block = block.upper().strip()
    if block in _LAUNDRY_CACHE:
        return _LAUNDRY_CACHE[block]

    # Possible candidate filenames (e.g. VITC-A-M-L.json, VITC-A-L.json, VITC-CB-L.json, etc.)
    candidates = [
        f"VITC-{block}-L.json",
        f"VITC-{block}-M-L.json",
        f"VITC-{block}-F-L.json",
    ]
    if block == "C":
        candidates.extend(["VITC-CB-L.json", "VITC-CG-L.json", "VITC-C-M-L.json", "VITC-C-F-L.json"])

    for candidate in candidates:
        local_items = _load_local_json(os.path.join("laundry", candidate))
        if local_items:
            _LAUNDRY_CACHE[block] = local_items
            return local_items

    # Try remote fetch
    for candidate in candidates:
        url = f"{BASE_URL}/{candidate}"
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
            )
            with urllib.request.urlopen(req, timeout=4) as res:
                data = json.loads(res.read().decode("utf-8"))
                items = data.get("list") or []
                if items:
                    _LAUNDRY_CACHE[block] = items
                    return items
        except Exception:
            continue

    return _LAUNDRY_CACHE.get(block, [])


def parse_hostel_info(html: str) -> Dict[str, Any]:
    """
    Extract hostel details from VTOP StudentProfileAllView or hostel module tables.
    """
    if not html:
        return {}

    soup = BeautifulSoup(html, "html.parser")
    info: Dict[str, Any] = {
        "gender": None,
        "isHosteller": False,
        "blockName": None,
        "roomNo": None,
        "messInfo": None,
    }

    for row in soup.find_all("tr"):
        cols = row.find_all(["td", "th"])
        if len(cols) < 2:
            continue
        for i in range(len(cols) - 1):
            label = cols[i].get_text(strip=True).upper()
            val = cols[i + 1].get_text(strip=True)
            if not label or not val:
                continue

            if "GENDER" in label or "SEX" in label:
                if not info["gender"]:
                    info["gender"] = val
            elif "HOSTELLER" in label or "DAY SCHOLAR" in label or "RESIDENTIAL" in label:
                val_u = val.upper()
                if "HOSTELLER" in val_u or "HOSTEL" in val_u:
                    info["isHosteller"] = True
                elif "DAY SCHOLAR" in val_u or "DAYSCHOLAR" in val_u:
                    info["isHosteller"] = False
            elif "BLOCK" in label:
                if not info["blockName"]:
                    info["blockName"] = val
                    info["isHosteller"] = True
            elif "ROOM" in label:
                if not info["roomNo"]:
                    info["roomNo"] = val
                    info["isHosteller"] = True
            elif "MESS" in label or "CATERER" in label:
                if not info["messInfo"]:
                    mess_val = val.upper()
                    if "NON" in mess_val:
                        info["messInfo"] = "NON VEG"
                    elif "SPECIAL" in mess_val or "FOOD" in mess_val:
                        info["messInfo"] = "SPECIAL"
                    elif "VEG" in mess_val:
                        info["messInfo"] = "VEG"
                    else:
                        info["messInfo"] = val or "NOT ALLOTTED"

    # Presence of an allotted block or room guarantees hosteller status
    if info.get("blockName") or info.get("roomNo"):
        info["isHosteller"] = True

    return info


def parse_leave_history(history_html: str, applied_html: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Parse historical and currently applied leave requests from VTOP hostel leave tables.
    """
    leaves: Dict[str, Dict[str, Any]] = {}

    if history_html:
        soup = BeautifulSoup(history_html, "html.parser")
        table = soup.find(id="LeaveHistoryTable") or soup.find("table")
        if table:
            for row in table.find_all("tr"):
                cols = row.find_all("td")
                if len(cols) >= 8:
                    leave_id = cols[1].get_text(strip=True)
                    if leave_id and leave_id.isalnum():
                        leaves[leave_id] = {
                            "leaveId": leave_id,
                            "visitPlace": cols[2].get_text(strip=True),
                            "reason": cols[3].get_text(strip=True),
                            "leaveType": cols[4].get_text(strip=True),
                            "from": cols[5].get_text(strip=True),
                            "to": cols[6].get_text(strip=True),
                            "status": cols[7].get_text(strip=True),
                            "remarks": cols[8].get_text(strip=True) if len(cols) > 8 else "",
                        }

    if applied_html:
        soup_app = BeautifulSoup(applied_html, "html.parser")
        table_app = soup_app.find(id="LeaveAppliedTable") or soup_app.find("table")
        if table_app:
            for row in table_app.find_all("tr"):
                cols = row.find_all("td")
                if len(cols) >= 9:
                    leave_id = cols[2].get_text(strip=True)
                    if leave_id and leave_id.isalnum():
                        leaves[leave_id] = {
                            "leaveId": leave_id,
                            "visitPlace": cols[3].get_text(strip=True),
                            "reason": cols[4].get_text(strip=True),
                            "leaveType": cols[5].get_text(strip=True),
                            "from": cols[6].get_text(strip=True),
                            "to": cols[7].get_text(strip=True),
                            "status": cols[8].get_text(strip=True),
                            "remarks": cols[9].get_text(strip=True) if len(cols) > 9 else "",
                        }

    return list(leaves.values())
