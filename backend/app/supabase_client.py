"""
CampusOS Supabase Client & Telemetry Module.

Handles student profile resolution, activity updates, and analytics event logging.
Features:
- Source of truth: CampusOS registration number (regNo).
- Graceful degradation: If Supabase is slow, offline, or returns an error, the operation
  fails silently/logs a warning and buffers to local storage. CampusOS core operations
  (VTOP, LMS, Teams, attendance, academics) NEVER fail due to analytics.
- Privacy & Security: Sensitive credentials (passwords, tokens, cookies, auth headers)
  are strictly stripped and NEVER saved.
"""

from __future__ import annotations

import json
import logging
import os
import re
import tempfile
import threading
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger("campusos.supabase")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://qvxgdarfzhoxmfujdrij.supabase.co")
# Prioritize service role key if configured on the server, otherwise use publishable/anon key
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_KEY = (
    SUPABASE_SERVICE_ROLE_KEY
    or os.environ.get("SUPABASE_KEY")
    or os.environ.get("SUPABASE_PUBLISHABLE_KEY")
    or "sb_publishable_MuEAEzSmTaYAZngVY0t_3A_R3BDRb6e"
)

# Local buffering directory for zero-data-loss fallback
if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
    LOCAL_DATA_DIR = os.path.join(tempfile.gettempdir(), "campusos_data")
else:
    LOCAL_DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")

EVENTS_LOG_FILE = os.path.join(LOCAL_DATA_DIR, "analytics_events.jsonl")
PROFILES_FILE = os.path.join(LOCAL_DATA_DIR, "profiles_cache.json")

_supabase_client = None
_client_lock = threading.Lock()

# Sensitive keys and patterns that must NEVER be persisted in analytics or profiles
SENSITIVE_EXACT_KEYS = {
    "password", "pass", "passwd", "pwd", "token", "accesstoken", "access_token",
    "refreshtoken", "refresh_token", "refresh", "cookie", "cookies", "sessionid",
    "session_id", "sessiontoken", "session_token", "auth", "authorization",
    "authtoken", "auth_token", "secret", "apikey", "api_key", "jwt", "bearer",
    "otp", "pin", "credential", "credentials"
}

SENSITIVE_SUBSTRINGS = (
    "password", "passwd", "token", "secret", "apikey", "api_key", "cookie", "sessionid"
)


def is_sensitive_key(key: str) -> bool:
    clean = str(key).strip().lower()
    norm = re.sub(r"[_\-\s]", "", clean)
    if norm in SENSITIVE_EXACT_KEYS or clean in SENSITIVE_EXACT_KEYS:
        return True
    if any(sub in norm for sub in SENSITIVE_SUBSTRINGS):
        return True
    tokens = set(re.findall(r"[a-z0-9]+", clean))
    if any(t in SENSITIVE_EXACT_KEYS for t in tokens):
        return True
    return False


def is_sensitive_value(val: Any) -> bool:
    if not isinstance(val, str):
        return False
    s = val.strip()
    if s.lower().startswith("bearer "):
        return True
    if re.match(r"^ey[A-Za-z0-9_-]{10,}\.ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$", s):
        return True
    return False


def sanitize_metadata(data: Any) -> Any:
    """Recursively strip any sensitive authentication tokens or credentials (H6, M24)."""
    if isinstance(data, dict):
        clean = {}
        for k, v in data.items():
            if is_sensitive_key(str(k)):
                continue
            if is_sensitive_value(v):
                continue
            clean[k] = sanitize_metadata(v)
        return clean
    elif isinstance(data, list):
        return [sanitize_metadata(item) for item in data if not is_sensitive_value(item)]
    return data


def clean_registration_number(reg_no: Optional[str]) -> Optional[str]:
    """Normalize student registration number (uppercase, stripped)."""
    if not reg_no or not isinstance(reg_no, str):
        return None
    val = reg_no.strip().upper()
    if val in ("NOT AVAILABLE", "SYNC REQUIRED", "NONE", "NULL", "ANONYMOUS", ""):
        return None
    # Registration numbers are alphanumeric (e.g. 21BCE1234)
    safe = "".join(c for c in val if c.isalnum() or c in ("-", "_"))
    return safe if safe else None


def get_supabase():
    """Lazy initialize and return singleton Supabase client."""
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    with _client_lock:
        if _supabase_client is not None:
            return _supabase_client
        if not SUPABASE_URL or not SUPABASE_KEY:
            logger.warning("[Supabase] SUPABASE_URL or SUPABASE_KEY is missing.")
            return None
        try:
            from supabase import create_client
            _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
            logger.info("[Supabase] Client initialized successfully for %s", SUPABASE_URL)
            return _supabase_client
        except Exception as exc:
            logger.warning("[Supabase] Could not initialize Supabase Python client: %s", exc)
            return None


def _buffer_event_locally(event: Dict[str, Any]) -> None:
    """Persist event to local JSONL file so data is never lost if Supabase is offline."""
    try:
        os.makedirs(LOCAL_DATA_DIR, exist_ok=True)
        with open(EVENTS_LOG_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(event) + "\n")
    except Exception as exc:
        logger.debug("[Analytics] Failed to buffer event locally: %s", exc)


def _buffer_profile_locally(profile: Dict[str, Any]) -> None:
    """Persist profile to local profiles cache."""
    reg = profile.get("reg_no")
    if not reg:
        return
    try:
        os.makedirs(LOCAL_DATA_DIR, exist_ok=True)
        existing = {}
        if os.path.exists(PROFILES_FILE):
            try:
                with open(PROFILES_FILE, "r", encoding="utf-8") as f:
                    existing = json.load(f)
            except Exception:
                existing = {}
        existing[reg] = {
            **existing.get(reg, {}),
            **profile,
            "last_active_at": datetime.now(timezone.utc).isoformat(),
        }
        temp_file = f"{PROFILES_FILE}.tmp"
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(existing, f, indent=2)
        os.replace(temp_file, PROFILES_FILE)
    except Exception as exc:
        logger.debug("[Analytics] Failed to buffer profile locally: %s", exc)


def upsert_profile(student_data: Dict[str, Any]) -> Optional[str]:
    """
    Register or update a student profile in Supabase.
    Returns the profile ID if successful, or None.
    Never throws exceptions.
    """
    if not student_data or not isinstance(student_data, dict):
        return None

    raw_reg = student_data.get("regNo") or student_data.get("reg_no")
    clean_reg = clean_registration_number(raw_reg)
    if not clean_reg:
        return None

    name = student_data.get("name")
    email = student_data.get("email")
    program = student_data.get("program")
    branch = student_data.get("branch")
    school = student_data.get("school")
    semester = str(student_data.get("semester")) if student_data.get("semester") is not None else None
    semester_id = student_data.get("semesterId") or student_data.get("semester_id")
    batch = student_data.get("batch")
    
    cgpa = student_data.get("cgpa")
    try:
        cgpa_val = float(cgpa) if cgpa is not None else 0.00
    except (ValueError, TypeError):
        cgpa_val = 0.00

    credits_earned = student_data.get("creditsEarned") or student_data.get("credits_earned")
    try:
        credits_val = float(credits_earned) if credits_earned is not None else 0.00
    except (ValueError, TypeError):
        credits_val = 0.00

    rank = student_data.get("rank")
    try:
        rank_val = int(rank) if rank is not None else 0
    except (ValueError, TypeError):
        rank_val = 0

    profile_payload = {
        "reg_no": clean_reg,
        "name": name,
        "email": email,
        "program": program,
        "branch": branch,
        "school": school,
        "semester": semester,
        "semester_id": semester_id,
        "batch": batch,
        "cgpa": cgpa_val,
        "credits_earned": credits_val,
        "rank": rank_val,
        "last_active_at": datetime.now(timezone.utc).isoformat(),
        "last_synced": datetime.now(timezone.utc).isoformat(),
    }

    # Buffer profile locally for resilient backup
    _buffer_profile_locally(profile_payload)

    client = get_supabase()
    if not client:
        return None

    # 1. First attempt: Call the atomic database stored procedure
    try:
        res = client.rpc("upsert_student_profile", {
            "p_reg_no": clean_reg,
            "p_name": name,
            "p_email": email,
            "p_program": program,
            "p_branch": branch,
            "p_school": school,
            "p_semester": semester,
            "p_semester_id": semester_id,
            "p_batch": batch,
            "p_cgpa": cgpa_val,
            "p_credits_earned": credits_val,
            "p_rank": rank_val,
        }).execute()
        if res and res.data:
            return str(res.data)
    except Exception as rpc_exc:
        logger.debug("[Supabase] upsert_student_profile RPC notice: %s, falling back to direct upsert", rpc_exc)

    # 2. Fallback: Direct table upsert on public.profiles
    try:
        res = client.table("profiles").upsert(
            profile_payload,
            on_conflict="reg_no"
        ).execute()
        if res and res.data and len(res.data) > 0:
            return str(res.data[0].get("id"))
    except Exception as exc:
        logger.debug("[Supabase] Direct profile upsert notice: %s", exc)

    return None


def track_event(
    reg_no: Optional[str],
    event_name: str,
    page: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> bool:
    """
    Record an analytics event in Supabase.
    Ensures safe metadata, touches last_active_at for the student, and fails gracefully.
    Never throws exceptions.
    """
    clean_reg = clean_registration_number(reg_no) or "ANONYMOUS"
    clean_meta = sanitize_metadata(metadata or {})
    event_time = datetime.now(timezone.utc).isoformat()

    event_record = {
        "reg_no": clean_reg,
        "event_name": event_name.strip(),
        "page": page,
        "metadata": clean_meta,
        "created_at": event_time,
    }

    # Always buffer locally first to guarantee zero loss under network disruptions
    _buffer_event_locally(event_record)

    client = get_supabase()
    if not client:
        return True

    # 1. First attempt: Call atomic stored procedure track_campus_event
    try:
        res = client.rpc("track_campus_event", {
            "p_reg_no": clean_reg,
            "p_event_name": event_name.strip(),
            "p_page": page,
            "p_metadata": clean_meta,
        }).execute()
        if res and res.data:
            return True
    except Exception as rpc_exc:
        logger.debug("[Supabase] track_campus_event RPC notice: %s, trying direct insert", rpc_exc)

    # 2. Fallback: Direct insert into analytics_events table
    try:
        client.table("analytics_events").insert(event_record).execute()
        # Touch profile last_active_at if student is registered
        if clean_reg != "ANONYMOUS":
            try:
                client.table("profiles").update({
                    "last_active_at": event_time
                }).eq("reg_no", clean_reg).execute()
            except Exception:
                pass
        return True
    except Exception as exc:
        logger.debug("[Supabase] Direct event insert notice: %s", exc)
        return False


def get_analytics_summary() -> Dict[str, Any]:
    """
    Retrieve comprehensive analytics summary.
    Attempts Supabase stored procedure / table queries, with seamless local fallback.
    """
    client = get_supabase()
    if client:
        # 1. Attempt database stored procedure get_admin_analytics_summary
        try:
            res = client.rpc("get_admin_analytics_summary").execute()
            if res and res.data:
                return res.data
        except Exception as rpc_exc:
            logger.debug("[Supabase] get_admin_analytics_summary RPC notice: %s", rpc_exc)

        # 2. Fallback to direct Supabase table aggregation
        try:
            profiles_res = client.table("profiles").select("*").neq("reg_no", "ANONYMOUS").execute()
            profiles_data = profiles_res.data or []

            events_res = client.table("analytics_events").select("*").order("created_at", desc=True).limit(200).execute()
            events_data = events_res.data or []

            return _compute_summary_from_records(profiles_data, events_data)
        except Exception as query_exc:
            logger.debug("[Supabase] Direct table query notice: %s", query_exc)

    # 3. Resilient fallback: compute from local buffer files
    return _compute_summary_from_local_storage()


def _compute_summary_from_records(
    profiles: List[Dict[str, Any]],
    events: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Compute all 11 required analytics metrics from record sets."""
    now = datetime.now(timezone.utc)
    total_users = len(profiles)

    active_today_count = 0
    active_7d_count = 0
    active_30d_count = 0
    new_users_7d = 0
    new_users_30d = 0

    for p in profiles:
        last_active = p.get("last_active_at")
        if last_active:
            try:
                dt = datetime.fromisoformat(last_active.replace("Z", "+00:00"))
                delta_days = (now - dt).total_seconds() / 86400.0
                if delta_days <= 1.0:
                    active_today_count += 1
                if delta_days <= 7.0:
                    active_7d_count += 1
                if delta_days <= 30.0:
                    active_30d_count += 1
            except Exception:
                pass

        created = p.get("created_at")
        if created:
            try:
                dt_c = datetime.fromisoformat(created.replace("Z", "+00:00"))
                delta_days_c = (now - dt_c).total_seconds() / 86400.0
                if delta_days_c <= 7.0:
                    new_users_7d += 1
                if delta_days_c <= 30.0:
                    new_users_30d += 1
            except Exception:
                pass

    # Feature usage breakdown
    feature_counts: Dict[str, Dict[str, Any]] = {}
    for ev in events:
        name = ev.get("event_name") or "unknown"
        if name not in feature_counts:
            feature_counts[name] = {"event_name": name, "count": 0, "users": set(), "last_triggered_at": None}
        feature_counts[name]["count"] += 1
        reg = ev.get("reg_no")
        if reg and reg != "ANONYMOUS":
            feature_counts[name]["users"].add(reg)
        feature_counts[name]["last_triggered_at"] = ev.get("created_at")

    feature_usage = [
        {
            "event_name": v["event_name"],
            "count": v["count"],
            "unique_users": len(v["users"]),
            "last_triggered_at": v["last_triggered_at"],
        }
        for v in sorted(feature_counts.values(), key=lambda x: x["count"], reverse=True)
    ]

    # Daily Active Users (by date)
    daily_users: Dict[str, set] = {}
    for ev in events:
        created = ev.get("created_at")
        reg = ev.get("reg_no")
        if created and reg and reg != "ANONYMOUS":
            date_key = str(created)[:10]
            if date_key not in daily_users:
                daily_users[date_key] = set()
            daily_users[date_key].add(reg)

    daily_active = [
        {"date": d, "active_users": len(u)}
        for d, u in sorted(daily_users.items())
    ]

    # Sorted recent users
    sorted_profiles = sorted(
        profiles,
        key=lambda x: x.get("last_active_at") or "",
        reverse=True
    )[:25]

    return {
        "totalUsers": total_users,
        "activeToday": active_today_count,
        "activeLast7Days": active_7d_count,
        "activeLast30Days": active_30d_count,
        "newUsersLast7Days": new_users_7d,
        "newUsersLast30Days": new_users_30d,
        "dailyActiveUsers": daily_active,
        "weeklyActiveUsers": active_7d_count,
        "monthlyActiveUsers": active_30d_count,
        "recentUsers": sorted_profiles,
        "featureUsage": feature_usage,
        "recentActivity": events[:50],
        "generatedAt": now.isoformat(),
    }


def _compute_summary_from_local_storage() -> Dict[str, Any]:
    """Compute summary from local JSONL buffer files when remote is unreachable."""
    profiles: List[Dict[str, Any]] = []
    if os.path.exists(PROFILES_FILE):
        try:
            with open(PROFILES_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                profiles = list(data.values()) if isinstance(data, dict) else []
        except Exception as e:
            logger.debug("[Analytics] Error reading local profiles: %s", e)

    events: List[Dict[str, Any]] = []
    if os.path.exists(EVENTS_LOG_FILE):
        try:
            with open(EVENTS_LOG_FILE, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            events.append(json.loads(line))
                        except Exception:
                            pass
        except Exception as e:
            logger.debug("[Analytics] Error reading local events: %s", e)

    events.reverse()  # Latest first
    return _compute_summary_from_records(profiles, events)


def sync_store_to_supabase(data: Dict[str, Any], user_id: Optional[str] = None) -> bool:
    """
    Sync student academic profile and activity timestamp to Supabase.
    Preserves existing function signature for backwards compatibility.
    """
    try:
        student = data.get("student") or {}
        reg = student.get("regNo") or student.get("reg_no")
        if not reg:
            return False

        upsert_profile(student)
        track_event(
            reg_no=reg,
            event_name="sync_completed",
            page="/vtop/sync",
            metadata={
                "coursesCount": len(data.get("courses") or []),
                "attendanceCount": len(data.get("attendance") or []),
                "timetableCount": len(data.get("timetable") or []),
            }
        )
        return True
    except Exception as exc:
        logger.error("[Supabase] Error in sync_store_to_supabase: %s", exc)
        return False
