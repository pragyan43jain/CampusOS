"""
Hostel data manager for VIT Chennai: Mess menus and Laundry schedules.
Data source is the unmessify JSON repository used by StudentCC.
"""

import json
import logging
import urllib.request
from typing import Any, Dict, List, Optional

logger = logging.getLogger("vtop.hostel")

BASE_URL = "https://kanishka-developer.github.io/unmessify/json/en"

_MESS_CACHE: Dict[str, List[Dict[str, Any]]] = {}
_LAUNDRY_CACHE: Dict[str, List[Dict[str, Any]]] = {}


def fetch_mess_menu(mess_type: str = "M-N") -> List[Dict[str, Any]]:
    """
    Fetch mess menu for a given mess type.
    Types: M-N (Men North), M-S (Men South), M-V (Men Veg), W-N, W-S, W-V
    """
    mess_type = mess_type.upper().strip()
    if mess_type in _MESS_CACHE:
        return _MESS_CACHE[mess_type]

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
    Blocks: A, B, CB, CG, D1, D2, E
    """
    block = block.upper().strip()
    if block in _LAUNDRY_CACHE:
        return _LAUNDRY_CACHE[block]

    url = f"{BASE_URL}/VITC-{block}-L.json"
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
        )
        with urllib.request.urlopen(req, timeout=6) as res:
            data = json.loads(res.read().decode("utf-8"))
            items = data.get("list") or []
            _LAUNDRY_CACHE[block] = items
            return items
    except Exception as exc:
        logger.warning("[Hostel] Failed to fetch laundry schedule for %s: %s", block, exc)
        return _LAUNDRY_CACHE.get(block, [])
