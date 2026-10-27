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

    # Missing VTOP events must remain unknown, even on weekdays.
    day14 = next(d for d in parsed["days"] if d["date"] == 14)
    assert day14["events"] == []


def test_get_fallback_calendar():
    fallback = get_fallback_calendar("CH20262701")
    assert "calendars" in fallback
    assert len(fallback["calendars"]) > 0
    # Every day in each month should be present
    for cal in fallback["calendars"]:
        assert len(cal["days"]) >= 28


@pytest.mark.parametrize("post", [False, True])
def test_calendar_routes_use_selected_semester_and_ignore_unverified_cache(post):
    from app.routers import academics
    store = {"student": {"semesterId": "CH20242501"},
             "selectedSemester": {"id": "CH20262701"},
             "calendar": {"semesterId": "CH20262701", "calendars": [{"month": "WRONG"}]}}
    with patch.object(academics, "resolve_student_reg", return_value="TEST"), \
         patch.object(academics, "load_store", return_value=store):
        kwargs = dict(x_session_id=None, x_reg_no=None, sessionId=None, regNo=None, authorization=None)
        result = (academics.post_calendar_route(academics.CalendarPostBody(), **kwargs) if post
                  else academics.get_calendar(semesterId=None, type="ALL", **kwargs))
    assert result["semesterId"] == "CH20262701"
    assert result["source"] == "unavailable"
    assert result["calendars"][0]["month"] == "JULY 2026"
    assert all(not day["events"] for month in result["calendars"] for day in month["days"])


def test_login_page_is_not_a_calendar():
    session = MagicMock()
    session.authorized_id = "TEST"
    session.post_calendar.return_value = '<h4>Login</h4><table><tr><td>Calendar menu</td></tr></table>'
    result = fetch_vtop_academic_calendar(session, "CH20262701")
    assert result["source"] == "unavailable"
    assert all(not day["events"] for month in result["calendars"] for day in month["days"])


def test_live_calendar_reports_failed_months():
    session = MagicMock()
    session.authorized_id = "TEST"
    session.post_calendar.side_effect = lambda sem, date, group: SAMPLE_CALENDAR_HTML if "OCT" in date else '<h4>Login</h4>'
    result = fetch_vtop_academic_calendar(session, "CH20262701")
    assert result["source"] == "vtop"
    assert len(result["missingMonths"]) == 5
    assert result["classGroupId"] == "ALL"
    assert result["syncedAt"]
    assert result["calendars"][0]["days"][0]["events"] == []


@pytest.mark.parametrize("post", [False, True])
@pytest.mark.parametrize("requested_group, expected_source", [("ALL", "cached"), ("ALL03", "unavailable")])
def test_cached_calendar_must_match_cohort(post, requested_group, expected_source):
    from app.routers import academics
    store = {"student": {"semesterId": "CH20262701"}, "calendar": {
        "semesterId": "CH20262701", "source": "vtop", "classGroupId": "ALL",
        "calendars": [{"month": "OCTOBER 2026", "days": []}]}}
    with patch.object(academics, "resolve_student_reg", return_value="TEST"), \
         patch.object(academics, "load_store", return_value=store):
        kwargs = dict(x_session_id=None, x_reg_no=None, sessionId=None, regNo=None, authorization=None)
        result = (academics.post_calendar_route(academics.CalendarPostBody(type=requested_group), **kwargs) if post
                  else academics.get_calendar(semesterId=None, type=requested_group, **kwargs))
    assert result["source"] == expected_source
    assert store["calendar"]["source"] == "vtop"


def test_vtop_wrong_month_response_is_rejected():
    session = MagicMock()
    session.authorized_id = "TEST"
    session.post_calendar.return_value = SAMPLE_CALENDAR_HTML
    result = fetch_vtop_academic_calendar(session, "CH20262701")
    assert len(result["missingMonths"]) == 5
    assert result["calendars"][0]["days"][0]["events"] == []


def test_heading_without_year_uses_requested_year():
    assert _derive_month_year("JANUARY", "01-JAN-2025") == ("JANUARY 2025", 2025, 1)
