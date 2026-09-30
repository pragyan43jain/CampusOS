"""
Tests for VTOP Academic Calendar Parser, Fetcher, and API routes.
"""

from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.vtop.calendar import (
    _derive_month_year,
    get_semester_calendar_months,
    parse_calendar_html,
    get_fallback_calendar,
    fetch_vtop_academic_calendar,
)


SAMPLE_CALENDAR_HTML = """
<div align="center">
    <h4>OCTOBER 2026</h4>
</div>
<table class="table table-bordered calendar-table">
    <thead>
        <tr>
            <th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Sat</th><th>Sun</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td></td>
            <td></td>
            <td></td>
            <td>
                <span>1</span>
                <span style="color:#10b981;">Instructional Day (Thursday Order of Day)</span>
            </td>
            <td>
                <span>2</span>
                <span style="color:#ef4444;">Holiday (Gandhi Jayanti)</span>
            </td>
            <td>
                <span>3</span>
                <span>Saturday</span>
            </td>
            <td>
                <span>4</span>
                <span>Sunday</span>
            </td>
        </tr>
        <tr>
            <td>
                <span>12</span>
                <span style="color:#c084fc;">Continuous Assessment Test - II (CAT-II)</span>
            </td>
            <td>
                <span>13</span>
                <span style="color:#8b5cf6;">TechnoVIT 2026 Day 1</span>
            </td>
            <td>
                <span>14</span>
            </td>
            <td>
                <span>15</span>
                <span style="color:#10b981;">Instructional Day</span>
            </td>
            <td></td>
            <td></td>
            <td></td>
        </tr>
    </tbody>
</table>
"""


def test_derive_month_year():
    m_lbl, yr, m_idx = _derive_month_year("OCTOBER 2026")
    assert m_lbl == "OCTOBER 2026"
    assert yr == 2026
    assert m_idx == 10

    m_lbl2, yr2, m_idx2 = _derive_month_year("", "01-JUL-2025")
    assert m_lbl2 == "JULY 2025"
    assert yr2 == 2025
    assert m_idx2 == 7


def test_get_semester_calendar_months():
    fall_months = get_semester_calendar_months("CH20252601")
    assert len(fall_months) == 6
    assert fall_months[0] == "01-JUL-2025"
    assert fall_months[-1] == "01-DEC-2025"

    winter_months = get_semester_calendar_months("CH20252605")
    assert len(winter_months) == 6
    assert winter_months[0] == "01-DEC-2025"
    assert winter_months[1] == "01-JAN-2026"
    assert winter_months[-1] == "01-MAY-2026"

    summer_months = get_semester_calendar_months("CH20252607")
    assert len(summer_months) == 3
    assert summer_months[0] == "01-MAY-2026"


def test_parse_calendar_html():
    parsed = parse_calendar_html(SAMPLE_CALENDAR_HTML)
    assert parsed["month"] == "OCTOBER 2026"
    assert parsed["year"] == 2026
    assert len(parsed["days"]) == 31  # October has 31 days

    # Day 1: Instructional Day with Thursday Order of Day
    day1 = next(d for d in parsed["days"] if d["date"] == 1)
    assert len(day1["events"]) >= 1
    assert day1["events"][0]["type"] == "Instructional Day"
    assert "Thursday Order of Day" in day1["events"][0]["category"]

    # Day 2: Holiday (Gandhi Jayanti)
    day2 = next(d for d in parsed["days"] if d["date"] == 2)
    assert len(day2["events"]) >= 1
    assert day2["events"][0]["type"] == "Holiday"
    assert "Gandhi Jayanti" in day2["events"][0]["category"]

    # Day 12: Exam (CAT-II)
    day12 = next(d for d in parsed["days"] if d["date"] == 12)
    assert len(day12["events"]) >= 1
    assert day12["events"][0]["type"] == "Exam"

    # Day 13: Festival
    day13 = next(d for d in parsed["days"] if d["date"] == 13)
    assert len(day13["events"]) >= 1
    assert day13["events"][0]["type"] == "Festival"

    # Day 14: Day had no explicit event in HTML, but is Wednesday -> backfilled with Instructional Day!
    day14 = next(d for d in parsed["days"] if d["date"] == 14)
    assert len(day14["events"]) >= 1
    assert day14["events"][0]["type"] == "Instructional Day"


def test_get_fallback_calendar():
    fallback = get_fallback_calendar("CH20262701")
    assert "calendars" in fallback
    assert len(fallback["calendars"]) > 0
    # Every day in each month should be present
    for cal in fallback["calendars"]:
        assert len(cal["days"]) >= 28


def test_calendar_api_endpoints():
    client = TestClient(app)

    # 1. GET /api/calendar
    res = client.get("/api/calendar?semesterId=CH20262701")
    assert res.status_code == 200
    data = res.json()
    assert "calendars" in data
    assert len(data["calendars"]) > 0

    # 2. POST /api/calendar
    post_res = client.post("/api/calendar", json={
        "semesterId": "CH20262701",
        "type": "ALL"
    })
    assert post_res.status_code == 200
    post_data = post_res.json()
    assert "calendars" in post_data
