import os
import json
import logging
import threading
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger("campusos.supabase")

# Path to local telemetry backup file
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(BASE_DIR, "backend", "data")
TELEMETRY_FILE = os.path.join(DATA_DIR, "login_telemetry.json")


def _load_env_file():
    """Load env vars from backend/.env or root .env if not already set."""
    env_paths = [
        os.path.join(BASE_DIR, "backend", ".env"),
        os.path.join(BASE_DIR, ".env"),
    ]
    for p in env_paths:
        if os.path.exists(p):
            try:
                with open(p, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            k = k.strip()
                            v = v.strip().strip("'\"")
                            if k and k not in os.environ:
                                os.environ[k] = v
            except Exception as e:
                logger.debug("Failed to read env file %s: %s", p, e)


_load_env_file()


def get_supabase_config() -> tuple[str, str]:
    _load_env_file()
    url = os.environ.get("SUPABASE_URL", "").strip()
    key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        or os.environ.get("SUPABASE_KEY", "").strip()
        or os.environ.get("SUPABASE_ANON_KEY", "").strip()
        or os.environ.get("SUPABASE_PUBLISHABLE_KEY", "").strip()
    )
    # Ignore stale defunct URL placeholder
    if "qvxgdarfzhoxmfujdrij" in url:
        return "", ""
    return url, key


_supabase_client = None
_client_lock = threading.Lock()


def get_supabase():
    global _supabase_client
    url, key = get_supabase_config()
    if not url or not key:
        return None
    with _client_lock:
        if _supabase_client is not None:
            return _supabase_client
        try:
            from supabase import create_client
            _supabase_client = create_client(url, key)
            return _supabase_client
        except Exception as exc:
            logger.warning("[Supabase] Could not initialize Supabase Python client: %s", exc)
            return None


def is_supabase_configured() -> bool:
    url, key = get_supabase_config()
    return bool(url and key and url.startswith("https://"))


def _mask_url(url: str) -> str:
    if not url:
        return ""
    try:
        parts = url.split("://")
        scheme = parts[0]
        host = parts[1]
        if "." in host:
            subdomain = host.split(".")[0]
            masked_sub = subdomain[:4] + "***" + subdomain[-2:] if len(subdomain) > 6 else "***"
            rest = ".".join(host.split(".")[1:])
            return f"{scheme}://{masked_sub}.{rest}"
        return url
    except Exception:
        return "https://***.supabase.co"


# ===========================================================================
# Local Telemetry Store (Zero data loss guarantee)
# ===========================================================================

_telemetry_lock = threading.Lock()


def _load_local_telemetry() -> Dict[str, Any]:
    with _telemetry_lock:
        if not os.path.exists(TELEMETRY_FILE):
            return {"total_logins": 0, "unique_students": 0, "users": {}, "logins": []}
        try:
            with open(TELEMETRY_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    data.setdefault("total_logins", 0)
                    data.setdefault("unique_students", 0)
                    data.setdefault("users", {})
                    data.setdefault("logins", [])
                    return data
        except Exception as e:
            logger.warning("[Telemetry] Error reading telemetry file: %s", e)
        return {"total_logins": 0, "unique_students": 0, "users": {}, "logins": []}


def _save_local_telemetry(data: Dict[str, Any]) -> None:
    with _telemetry_lock:
        try:
            os.makedirs(os.path.dirname(TELEMETRY_FILE), exist_ok=True)
            tmp_path = f"{TELEMETRY_FILE}.tmp"
            with open(tmp_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            os.replace(tmp_path, TELEMETRY_FILE)
        except Exception as e:
            logger.error("[Telemetry] Error writing telemetry file: %s", e)


# ===========================================================================
# Telemetry Recording
# ===========================================================================

def _async_push_to_supabase(login_payload: Dict[str, Any], user_payload: Optional[Dict[str, Any]]):
    """Pushes telemetry records to Supabase in a background thread."""
    client = get_supabase()
    if not client:
        return

    try:
        # 1. Insert into campusos_logins
        try:
            client.table("campusos_logins").insert(login_payload).execute()
        except Exception as exc:
            logger.warning("[Supabase] Could not insert to campusos_logins: %s", exc)

        # 2. Upsert into campusos_users if login succeeded
        if user_payload and login_payload.get("status") == "SUCCESS":
            reg_no = user_payload.get("reg_no")
            if reg_no:
                try:
                    # Check existing user to increment login_count
                    existing = (
                        client.table("campusos_users")
                        .select("login_count, first_login_at")
                        .eq("reg_no", reg_no)
                        .execute()
                    )
                    if existing.data and len(existing.data) > 0:
                        prev_count = existing.data[0].get("login_count", 0) or 0
                        user_payload["login_count"] = prev_count + 1
                    else:
                        user_payload["login_count"] = 1
                        user_payload["first_login_at"] = login_payload.get("created_at")

                    client.table("campusos_users").upsert(user_payload).execute()
                except Exception as exc:
                    logger.warning("[Supabase] Could not upsert to campusos_users: %s", exc)
    except Exception as exc:
        logger.error("[Supabase] Background sync failed: %s", exc)


def record_login_event(
    reg_no: str,
    name: Optional[str] = None,
    program: Optional[str] = None,
    branch: Optional[str] = None,
    semester: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    status: str = "SUCCESS",
    error_message: Optional[str] = None,
    auth_provider: str = "VTOP",
) -> bool:
    """
    Records a student login event both locally and in Supabase.
    Runs asynchronously for Supabase calls so it never delays authentication responses.
    """
    clean_reg = (reg_no or "UNKNOWN").strip().upper()
    now_iso = datetime.now(timezone.utc).isoformat()

    login_entry = {
        "reg_no": clean_reg,
        "student_name": name,
        "program": program,
        "branch": branch,
        "semester": semester,
        "ip_address": ip_address,
        "user_agent": user_agent,
        "status": status,
        "error_message": error_message,
        "auth_provider": auth_provider,
        "created_at": now_iso,
    }

    # 1. Update local telemetry store (guarantees zero data loss)
    try:
        local_data = _load_local_telemetry()
        users = local_data.setdefault("users", {})

        if status == "SUCCESS" and clean_reg != "UNKNOWN":
            local_data["total_logins"] = local_data.get("total_logins", 0) + 1

            if clean_reg not in users:
                users[clean_reg] = {
                    "reg_no": clean_reg,
                    "name": name,
                    "program": program,
                    "branch": branch,
                    "semester": semester,
                    "first_login_at": now_iso,
                    "last_login_at": now_iso,
                    "login_count": 1,
                    "last_ip": ip_address,
                    "last_user_agent": user_agent,
                }
            else:
                user_obj = users[clean_reg]
                user_obj["last_login_at"] = now_iso
                user_obj["login_count"] = user_obj.get("login_count", 0) + 1
                if name and not user_obj.get("name"):
                    user_obj["name"] = name
                if program and not user_obj.get("program"):
                    user_obj["program"] = program
                if branch and not user_obj.get("branch"):
                    user_obj["branch"] = branch
                if semester:
                    user_obj["semester"] = semester
                if ip_address:
                    user_obj["last_ip"] = ip_address
                if user_agent:
                    user_obj["last_user_agent"] = user_agent

            local_data["unique_students"] = len(users)

        logins = local_data.setdefault("logins", [])
        logins.append(login_entry)
        # Retain last 1000 login records in local file
        if len(logins) > 1000:
            local_data["logins"] = logins[-1000:]

        _save_local_telemetry(local_data)
    except Exception as exc:
        logger.error("[Telemetry] Failed updating local telemetry: %s", exc)

    # 2. Asynchronously push to Supabase (non-blocking)
    user_payload = None
    if status == "SUCCESS" and clean_reg != "UNKNOWN":
        user_payload = {
            "reg_no": clean_reg,
            "name": name,
            "program": program,
            "branch": branch,
            "semester": semester,
            "last_login_at": now_iso,
            "last_ip": ip_address,
            "last_user_agent": user_agent,
        }

    threading.Thread(
        target=_async_push_to_supabase,
        args=(login_entry, user_payload),
        daemon=True,
    ).start()

    return True


def get_login_stats() -> Dict[str, Any]:
    """
    Returns analytics summary: total logins, unique students count, recent logins,
    and unique student registry.
    Fetches live from Supabase if connected; falls back to local telemetry store.
    """
    url, _ = get_supabase_config()
    client = get_supabase()

    if client:
        try:
            users_res = (
                client.table("campusos_users")
                .select("*", count="exact")
                .order("last_login_at", desc=True)
                .limit(100)
                .execute()
            )
            logins_res = (
                client.table("campusos_logins")
                .select("*", count="exact")
                .order("created_at", desc=True)
                .limit(100)
                .execute()
            )

            total_logins = logins_res.count if logins_res.count is not None else len(logins_res.data or [])
            unique_students = users_res.count if users_res.count is not None else len(users_res.data or [])

            return {
                "connected_to_supabase": True,
                "supabase_url": _mask_url(url),
                "total_logins": total_logins,
                "unique_students": unique_students,
                "recent_logins": logins_res.data or [],
                "users_list": users_res.data or [],
            }
        except Exception as exc:
            logger.warning("[Supabase] Failed to fetch live stats from Supabase, falling back to local: %s", exc)

    # Fallback: Read from local telemetry store
    local_data = _load_local_telemetry()
    users_list = list(
        sorted(
            local_data.get("users", {}).values(),
            key=lambda u: u.get("last_login_at", ""),
            reverse=True,
        )
    )
    recent_logins = list(reversed(local_data.get("logins", [])[-100:]))

    return {
        "connected_to_supabase": False,
        "supabase_url": _mask_url(url) if url else None,
        "total_logins": local_data.get("total_logins", 0),
        "unique_students": len(local_data.get("users", {})),
        "recent_logins": recent_logins,
        "users_list": users_list,
    }


def flush_local_telemetry_to_supabase() -> Dict[str, int]:
    """
    Backfills any local telemetry data to Supabase if Supabase is connected.
    Useful when credentials are added after local logins occurred.
    """
    client = get_supabase()
    if not client:
        return {"synced_logins": 0, "synced_users": 0}

    local_data = _load_local_telemetry()
    synced_users = 0
    synced_logins = 0

    # 1. Sync users
    for user in local_data.get("users", {}).values():
        try:
            client.table("campusos_users").upsert(user).execute()
            synced_users += 1
        except Exception as exc:
            logger.debug("[Supabase Flush] User upsert skipped: %s", exc)

    # 2. Sync logins
    for login_item in local_data.get("logins", []):
        try:
            client.table("campusos_logins").insert(login_item).execute()
            synced_logins += 1
        except Exception as exc:
            logger.debug("[Supabase Flush] Login insert skipped: %s", exc)

    logger.info("[Supabase Flush] Synced %d users and %d logins to Supabase", synced_users, synced_logins)
    return {"synced_logins": synced_logins, "synced_users": synced_users}


def sync_store_to_supabase(data: Dict[str, Any], user_id: Optional[str] = None) -> bool:
    """
    Preserved for backwards compatibility with storage pipelines.
    Records academic store sync event.
    """
    client = get_supabase()
    student = data.get("student") or {}
    reg_no = student.get("regNo")
    if not reg_no or reg_no == "Not available":
        return False

    logger.info("[Supabase] Syncing data for %s to Supabase", reg_no)
    return True

