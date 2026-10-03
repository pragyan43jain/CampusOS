"""
CampusOS Analytics & Telemetry Router.

Endpoints for event tracking, profile synchronization, and secure admin analytics.
"""

from __future__ import annotations

import logging
import os
import secrets
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Header, HTTPException, Query, Request, status
from pydantic import BaseModel, Field

from app.supabase_client import (
    clean_registration_number,
    get_analytics_summary,
    track_event,
    upsert_profile,
)

logger = logging.getLogger("campusos.analytics")

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

# Admin Configuration (No hardcoded default secrets)
CAMPUSOS_ADMIN_KEY = os.environ.get("CAMPUSOS_ADMIN_KEY", "").strip()
CAMPUSOS_ADMIN_REG_NOS = [
    r.strip().upper()
    for r in os.environ.get("CAMPUSOS_ADMIN_REG_NOS", "").split(",")
    if r.strip()
]


def verify_admin_authorization(
    x_admin_key: Optional[str] = None,
    x_reg_no: Optional[str] = None,
    x_session_id: Optional[str] = None,
) -> bool:
    """
    Verify whether the request is authorized to view admin analytics.
    Security (C7):
    1. Secret key accepted strictly via X-Admin-Key header (never via URL query parameter).
    2. Constant-time comparison to prevent timing side-channel attacks.
    3. No default hardcoded admin secrets.
    4. Student admin access strictly requires verified session token.
    """
    if x_admin_key and CAMPUSOS_ADMIN_KEY:
        if secrets.compare_digest(x_admin_key.strip(), CAMPUSOS_ADMIN_KEY):
            return True

    if x_session_id and CAMPUSOS_ADMIN_REG_NOS:
        try:
            from app.routers.auth import resolve_student_reg
            verified_reg = resolve_student_reg(x_session_id=x_session_id, x_reg_no=x_reg_no)
            if verified_reg and any(secrets.compare_digest(verified_reg, r) for r in CAMPUSOS_ADMIN_REG_NOS):
                return True
        except Exception:
            return False

    return False


class EventTrackRequest(BaseModel):
    event: str = Field(..., description="Standardized event name, e.g. dashboard_viewed, attendance_viewed")
    page: Optional[str] = Field(None, description="Page or route where the event occurred")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Arbitrary safe metadata payload")
    regNo: Optional[str] = Field(None, description="Optional registration number override")


class BatchEventTrackRequest(BaseModel):
    events: List[EventTrackRequest]


class ProfileSyncRequest(BaseModel):
    regNo: str = Field(..., description="Student registration number")
    name: Optional[str] = None
    email: Optional[str] = None
    program: Optional[str] = None
    branch: Optional[str] = None
    school: Optional[str] = None
    semester: Optional[str] = None
    batch: Optional[str] = None
    cgpa: Optional[float] = None
    creditsEarned: Optional[float] = None
    rank: Optional[int] = None


@router.post("/track")
def record_event(
    req: EventTrackRequest,
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    x_auth_user: Optional[str] = Header(None, alias="X-Auth-User"),
) -> Dict[str, Any]:
    """
    Record an analytics event from client or background service.
    Fails gracefully: always returns success: true so the client never crashes.
    """
    try:
        reg = req.regNo or x_reg_no or x_auth_user
        success = track_event(
            reg_no=reg,
            event_name=req.event,
            page=req.page,
            metadata=req.metadata,
        )
        return {"success": True, "recorded": success}
    except Exception as exc:
        logger.warning("[Analytics API] Unexpected error in /track: %s", exc)
        return {"success": True, "recorded": False}


@router.post("/batch")
def record_events_batch(
    req: BatchEventTrackRequest,
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    x_auth_user: Optional[str] = Header(None, alias="X-Auth-User"),
) -> Dict[str, Any]:
    """
    Record multiple analytics events in a single HTTP request.
    """
    try:
        count = 0
        for ev in req.events:
            reg = ev.regNo or x_reg_no or x_auth_user
            if track_event(reg_no=reg, event_name=ev.event, page=ev.page, metadata=ev.metadata):
                count += 1
        return {"success": True, "recordedCount": count}
    except Exception as exc:
        logger.warning("[Analytics API] Unexpected error in /batch: %s", exc)
        return {"success": True, "recordedCount": 0}


@router.post("/profile")
def record_profile_activity(
    req: ProfileSyncRequest,
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
) -> Dict[str, Any]:
    """
    Update student profile and mark student as active.
    """
    try:
        profile_data = req.model_dump()
        if not profile_data.get("regNo") and x_reg_no:
            profile_data["regNo"] = x_reg_no
        profile_id = upsert_profile(profile_data)
        return {"success": True, "profileId": profile_id}
    except Exception as exc:
        logger.warning("[Analytics API] Unexpected error in /profile: %s", exc)
        return {"success": True, "profileId": None}


# ==============================================================================
# Protected Admin Analytics Endpoints
# ==============================================================================


@router.get("/admin/summary")
def get_admin_summary(
    x_admin_key: Optional[str] = Header(None, alias="X-Admin-Key"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
) -> Dict[str, Any]:
    """
    Retrieve aggregated admin analytics data:
    - Total Users
    - Active Today, Last 7 Days, Last 30 Days
    - New Users Over Time
    - DAU / WAU / MAU
    - Feature Usage Breakdown
    - Recent Activity Feed
    - Recent Active Users List
    """
    if not verify_admin_authorization(x_admin_key=x_admin_key, x_reg_no=x_reg_no, x_session_id=x_session_id):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized. Valid admin credentials (X-Admin-Key) required to view CampusOS analytics.",
        )

    try:
        summary = get_analytics_summary()
        return {
            "success": True,
            "data": summary,
        }
    except Exception as exc:
        logger.exception("[Analytics Admin] Error generating summary: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate analytics summary: {str(exc)}",
        )
