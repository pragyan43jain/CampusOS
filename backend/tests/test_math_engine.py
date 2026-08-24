import pytest
from app.vtop.math_engine import calculate_attendance_metrics, calculate_od_metrics

def test_attendance_above_threshold():
    # 20 attended out of 23 conducted = 86.9565...% -> display 87.0%
    metrics = calculate_attendance_metrics(20, 23, min_required_pct=75.0)
    assert metrics["hasValidData"] is True
    assert round(metrics["rawPercentage"], 4) == 86.9565
    assert metrics["percentage"] == 87.0
    assert metrics["safeToMiss"] == 3
    assert metrics["needToAttend"] == 0
    assert metrics["isCritical"] is False
    assert metrics["status"] == "Safe"

def test_attendance_below_threshold():
    # 14 attended out of 20 conducted = 70.0% -> shortage
    metrics = calculate_attendance_metrics(14, 20, min_required_pct=75.0)
    assert metrics["hasValidData"] is True
    assert metrics["percentage"] == 70.0
    assert metrics["safeToMiss"] == 0
    # (0.75 * 20 - 14) / 0.25 = 1 / 0.25 = 4
    assert metrics["needToAttend"] == 4
    assert metrics["isCritical"] is True
    assert metrics["status"] == "Shortage"

def test_attendance_zero_attended():
    # 0 attended out of 10 conducted = 0.0%
    metrics = calculate_attendance_metrics(0, 10, min_required_pct=75.0)
    assert metrics["hasValidData"] is True
    assert metrics["percentage"] == 0.0
    assert metrics["safeToMiss"] == 0
    assert metrics["needToAttend"] == 30
    assert metrics["isCritical"] is True

def test_attendance_hundred_percent():
    # 20 attended out of 20 conducted = 100.0%
    metrics = calculate_attendance_metrics(20, 20, min_required_pct=75.0)
    assert metrics["hasValidData"] is True
    assert metrics["percentage"] == 100.0
    # (20 - 0.75 * 20) / 0.75 = 5 / 0.75 = 6.666 -> floor = 6
    assert metrics["safeToMiss"] == 6
    assert metrics["needToAttend"] == 0
    assert metrics["isCritical"] is False

def test_attendance_missing_data():
    # Incomplete / missing values should not convert to 0
    metrics = calculate_attendance_metrics(None, None)
    assert metrics["hasValidData"] is False
    assert metrics["percentage"] is None
    assert metrics["displayPercentage"] == "Not available"
    assert metrics["safeToMiss"] is None
    assert metrics["needToAttend"] is None

def test_od_metrics():
    # 12 hours out of 40 = 30.0%, 28 remaining
    od = calculate_od_metrics(12, max_hours=40)
    assert od["hasValidData"] is True
    assert od["usedHours"] == 12
    assert od["maxHours"] == 40
    assert od["remainingHours"] == 28
    assert od["percentageUsed"] == 30.0

def test_od_metrics_none():
    od = calculate_od_metrics(None, max_hours=40)
    assert od["hasValidData"] is False
    assert od["usedHours"] is None
    assert od["remainingHours"] is None
