import math
from typing import Dict, Any, Optional, Tuple

def calculate_attendance_metrics(
    attended: Optional[int], 
    conducted: Optional[int], 
    min_required_pct: float = 75.0
) -> Dict[str, Any]:
    """
    Authoritative attendance calculations based on VTOP attended and conducted counts.
    
    Formula for safe to miss (x):
        (attended / (conducted + x)) * 100 >= T
        => attended * 100 >= T * conducted + T * x
        => T * x <= attended * 100 - T * conducted
        => x <= (attended * 100 - T * conducted) / T
        => x <= (attended - (T/100) * conducted) / (T/100)
        
    Formula for need to attend (y):
        ((attended + y) / (conducted + y)) * 100 >= T
        => (1 - T/100) * y >= (T/100) * conducted - attended
        => y >= ((T/100) * conducted - attended) / (1 - T/100)
    """
    if attended is None or conducted is None or conducted <= 0:
        return {
            "attended": attended if attended is not None else None,
            "total": conducted if conducted is not None else None,
            "percentage": None,
            "displayPercentage": "Not available",
            "safeToMiss": None,
            "needToAttend": None,
            "isCritical": False,
            "status": "Not available",
            "hasValidData": False,
        }
    
    # Retain full float precision internally
    raw_percentage = (attended / conducted) * 100.0
    display_percentage = round(raw_percentage, 1)
    is_critical = raw_percentage < min_required_pct
    
    t_ratio = min_required_pct / 100.0
    
    if raw_percentage >= min_required_pct:
        # Maximum integer classes that can be missed without dropping below T%
        margin = attended - (t_ratio * conducted)
        safe_to_miss = max(0, math.floor(margin / t_ratio))
        need_to_attend = 0
        status = "Safe"
    else:
        # Minimum integer classes that must be attended consecutively to reach T%
        deficit = (t_ratio * conducted) - attended
        need_to_attend = max(1, math.ceil(deficit / (1.0 - t_ratio)))
        safe_to_miss = 0
        status = "Shortage"
        
    return {
        "attended": attended,
        "total": conducted,
        "rawPercentage": raw_percentage,
        "percentage": display_percentage,
        "displayPercentage": f"{display_percentage}%",
        "safeToMiss": safe_to_miss,
        "needToAttend": need_to_attend,
        "isCritical": is_critical,
        "status": status,
        "hasValidData": True,
    }

def calculate_od_metrics(used_hours: Optional[int], max_hours: int = 40) -> Dict[str, Any]:
    """
    Authoritative On-Duty calculations with 40-hour institutional limit.
    """
    if used_hours is None:
        return {
            "usedHours": None,
            "odHours": None,
            "totalOdHours": None,
            "maxHours": max_hours,
            "maxOdHours": max_hours,
            "remainingHours": None,
            "percentageUsed": None,
            "hasValidData": False,
        }
    
    clamped_used = max(0, used_hours)
    remaining = max(0, max_hours - clamped_used)
    percentage_used = round((clamped_used / max_hours) * 100.0, 1)
    
    return {
        "usedHours": clamped_used,
        "odHours": clamped_used,
        "totalOdHours": clamped_used,
        "maxHours": max_hours,
        "maxOdHours": max_hours,
        "remainingHours": remaining,
        "percentageUsed": percentage_used,
        "hasValidData": True,
    }

