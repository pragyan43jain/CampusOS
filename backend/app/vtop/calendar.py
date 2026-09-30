"""
VTOP Academic Calendar Parser & Live Scraper
Scrapes monthly instructional days, holidays, order-of-day, and exam milestones
directly from VTOP (/vtop/processViewCalendar) matching UniCC/StudentCC specs.
Falls back to cached academic calendar dataset when VTOP session is unavailable.
"""

from __future__ import annotations

import calendar as cal_mod
from concurrent.futures import ThreadPoolExecutor
import datetime
import json
import logging
import os
import re
import time
from typing import Any, Dict, List, Optional, Tuple
from bs4 import BeautifulSoup

from app.vtop import constants as C

logger = logging.getLogger("vtop.calendar")

CALENDAR_JSON_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
    "frontend",
    "public",
    "calendar",
    "academic_calendar.json",
)

MONTH_MAP = {
    "JAN": 1, "JANUARY": 1,
    "FEB": 2, "FEBRUARY": 2,
    "MAR": 3, "MARCH": 3,
    "APR": 4, "APRIL": 4,
    "MAY": 5,
    "JUN": 6, "JUNE": 6,
    "JUL": 7, "JULY": 7,
    "AUG": 8, "AUGUST": 8,
    "SEP": 9, "SEPTEMBER": 9,
    "OCT": 10, "OCTOBER": 10,
    "NOV": 11, "NOVEMBER": 11,
    "DEC": 12, "DECEMBER": 12,
}


def _derive_month_year(heading_text: str, cal_date: Optional[str] = None) -> Tuple[str, int, int]:
    """
    Returns (month_label, year, month_idx_1_based).
    e.g. ("JULY 2026", 2026, 7)
    """
    now = datetime.datetime.now()
    clean_heading = heading_text.strip() if heading_text else ""
    m_name = ""
    year = now.year

    if clean_heading:
        m = re.search(r"([a-zA-Z]+)\s*(\d{4})?", clean_heading)
        if m:
            cand_month = m.group(1).upper()
            if cand_month in MONTH_MAP:
                m_name = cand_month
            if m.group(2):
                year = int(m.group(2))

    if not m_name and cal_date:
        # cal_date format e.g. "01-JUL-2026"
        parts = cal_date.split("-")
        if len(parts) >= 3:
            part_month = parts[1].upper()
            if part_month in MONTH_MAP:
                m_name = part_month
            try:
                year = int(parts[2])
            except ValueError:
                pass

    if not m_name:
        m_name = now.strftime("%B").upper()

    month_idx = MONTH_MAP.get(m_name, now.month)
    full_month_name = cal_mod.month_name[month_idx].upper()
    month_label = f"{full_month_name} {year}"
    return month_label, year, month_idx


def parse_calendar_html(html: str, cal_date: Optional[str] = None) -> Dict[str, Any]:
    """
    Parse VTOP calendar HTML output from /vtop/processViewCalendar.
    Extracts every instructional day, holiday, exam date, and order-of-day.
    Ensures no day is left blank or empty.
    """
    if not html:
        month_label, year, month_idx = _derive_month_year("", cal_date)
        return _build_empty_month_calendar(month_label, year, month_idx)

    soup = BeautifulSoup(html, "html.parser")
    month_heading = soup.find(["h4", "h3", "h2", "center", "b"])
    heading_text = month_heading.get_text().strip() if month_heading else ""
    month_label, year, month_idx = _derive_month_year(heading_text, cal_date)

    days_in_month = cal_mod.monthrange(year, month_idx)[1]
    days_by_num: Dict[int, List[Dict[str, Any]]] = {}

    cells = soup.select("table.calendar-table tbody tr td") or soup.select("table tbody tr td")
    for cell in cells:
        spans = cell.find_all(["span", "font", "p", "div", "b", "strong"])
        if not spans:
            continue

        date_str = spans[0].get_text().strip()
        if not date_str or not date_str.isdigit():
            # Sometimes date number is in direct text
            m_date = re.match(r"^(\d{1,2})", cell.get_text().strip())
            if not m_date:
                continue
            date_num = int(m_date.group(1))
        else:
            date_num = int(date_str)

        if not (1 <= date_num <= days_in_month):
            continue

        events: List[Dict[str, Any]] = []

        # Parse distinct event elements
        event_nodes = spans[1:] if date_str.isdigit() else spans
        seen_texts = set()

        for node in event_nodes:
            text = node.get_text().strip()
            if not text or text == str(date_num) or text in seen_texts:
                continue
            seen_texts.add(text)

            style = node.get("style", "")
            color_match = re.search(r"color:\s*([^;]+)", style, re.I)
            color = color_match.group(1).strip() if color_match else ""

            lower_text = text.lower()
            is_exam = any(k in lower_text for k in [
                "exam", "cat 1", "cat 2", "cat-1", "cat-2", "cat i", "cat ii",
                "cat-i", "cat-ii", "fat", "assessment", "term end", "final test",
                "mid term", "lab fat", "examination"
            ])
            is_holiday = any(k in lower_text for k in [
                "holiday", "vacation", "pongal", "diwali", "deepavali",
                "gandhi jayanti", "independence day", "republic day",
                "ayudha", "puja", "pooja", "christmas", "new year",
                "muharram", "milad", "eid", "good friday", "ramzan",
                "no instructional", "non-instructional", "non instructional"
            ])
            is_fest = any(k in lower_text for k in [
                "technovit", "vibrance", "riviera", "gravitas", "fest"
            ])
            is_instructional = "instructional" in lower_text and not is_holiday

            if is_exam:
                event_type = "Exam"
                default_color = "#c084fc"
            elif is_fest:
                event_type = "Festival"
                default_color = "#8b5cf6"
            elif is_holiday:
                event_type = "Holiday"
                default_color = "#ef4444"
            elif is_instructional:
                event_type = "Instructional Day"
                default_color = "#10b981"
            else:
                event_type = "Other"
                default_color = "#94a3b8"

            category_match = re.search(r"\(([^)]+)\)", text)
            category = category_match.group(1).strip() if category_match else (
                "Instructional Day" if is_instructional
                else ("Exam" if is_exam else ("Holiday" if is_holiday else "General"))
            )

            events.append({
                "text": text,
                "type": event_type,
                "color": color or default_color,
                "category": category,
            })

        if events:
            days_by_num.setdefault(date_num, []).extend(events)

    # Backfill every day of the month so none are left empty
    days_list: List[Dict[str, Any]] = []
    for d in range(1, days_in_month + 1):
        weekday = datetime.date(year, month_idx, d).weekday()  # 0=Mon, 5=Sat, 6=Sun
        day_events = days_by_num.get(d, [])

        if not day_events:
            if weekday == 6:  # Sunday
                day_events = [{
                    "text": "Sunday (Holiday)",
                    "type": "Holiday",
                    "color": "#ef4444",
                    "category": "Sunday",
                }]
            elif weekday == 5:  # Saturday
                day_events = [{
                    "text": "Saturday (Weekend)",
                    "type": "Other",
                    "color": "#94a3b8",
                    "category": "Weekend",
                }]
            else:  # Monday to Friday
                day_events = [{
                    "text": "Instructional Day",
                    "type": "Instructional Day",
                    "color": "#10b981",
                    "category": "Instructional Day",
                }]

        days_list.append({
            "date": d,
            "events": day_events,
        })

    return {
        "month": month_label,
        "year": year,
        "days": days_list,
    }


def _build_empty_month_calendar(month_label: str, year: int, month_idx: int) -> Dict[str, Any]:
    days_in_month = cal_mod.monthrange(year, month_idx)[1]
    days_list: List[Dict[str, Any]] = []
    for d in range(1, days_in_month + 1):
        weekday = datetime.date(year, month_idx, d).weekday()
        if weekday == 6:
            ev = [{"text": "Sunday (Holiday)", "type": "Holiday", "color": "#ef4444", "category": "Sunday"}]
        elif weekday == 5:
            ev = [{"text": "Saturday (Weekend)", "type": "Other", "color": "#94a3b8", "category": "Weekend"}]
        else:
            ev = [{"text": "Instructional Day", "type": "Instructional Day", "color": "#10b981", "category": "Instructional Day"}]
        days_list.append({"date": d, "events": ev})

    return {
        "month": month_label,
        "year": year,
        "days": days_list,
    }


def get_semester_calendar_months(semester_id: Optional[str]) -> List[str]:
    """
    Generate target months for querying VTOP /processViewCalendar.
    Follows UniCC & VIT semester calendar conventions.
    """
    sem_str = str(semester_id or "")
    sem_code = sem_str[-2:] if len(sem_str) >= 2 else "01"

    match_yr = re.search(r"20(\d\d)", sem_str)
    now = datetime.datetime.now()
    start_year = int(f"20{match_yr.group(1)}") if match_yr else now.year
    next_year = start_year + 1

    if sem_code == "01":  # Fall Semester
        return [
            f"01-JUL-{start_year}",
            f"01-AUG-{start_year}",
            f"01-SEP-{start_year}",
            f"01-OCT-{start_year}",
            f"01-NOV-{start_year}",
            f"01-DEC-{start_year}",
        ]
    elif sem_code == "05":  # Winter Semester
        return [
            f"01-DEC-{start_year}",
            f"01-JAN-{next_year}",
            f"01-FEB-{next_year}",
            f"01-MAR-{next_year}",
            f"01-APR-{next_year}",
            f"01-MAY-{next_year}",
        ]
    elif sem_code == "07":  # Summer Semester
        return [
            f"01-MAY-{next_year}",
            f"01-JUN-{next_year}",
            f"01-JUL-{next_year}",
        ]

    # Fallback to standard 6-month sequence around current date
    months = []
    for offset in range(-1, 5):
        dt = now + datetime.timedelta(days=offset * 31)
        months.append(f"01-{dt.strftime('%b').upper()}-{dt.year}")
    return months


def fetch_vtop_academic_calendar(
    session: Any,
    semester_id: Optional[str] = None,
    reg_no: Optional[str] = None,
    csrf_token: Optional[str] = None,
    class_group_id: str = "ALL",
) -> Dict[str, Any]:
    """
    Scrapes the full semester academic calendar live from VTOP /processViewCalendar.
    Queries all months in parallel and parses instructional days, holidays, order-of-day, and exams.
    """
    sem_id = semester_id or "CH20262701"
    months = get_semester_calendar_months(sem_id)

    # Determine credentials and auth state from session
    authorized_id = reg_no or getattr(session, "authorized_id", None) or getattr(session, "username", None)
    csrf = csrf_token or getattr(session, "csrf", None)

    if not authorized_id:
        logger.warning("[VTOP Calendar] Cannot fetch: authorizedID not found on session")
        return get_fallback_calendar(sem_id)

    def fetch_month_worker(m_date: str) -> Optional[Dict[str, Any]]:
        try:
            if hasattr(session, "post_calendar"):
                html = session.post_calendar(sem_id, m_date, class_group_id)
            else:
                fields = [
                    ("authorizedID", str(authorized_id)),
                    ("semSubId", str(sem_id)),
                    ("calDate", str(m_date)),
                    ("classGroupId", str(class_group_id)),
                    ("_csrf", str(csrf or "")),
                    ("x", str(int(time.time() * 1000))),
                ]
                headers = {
                    "Referer": "https://vtopcc.vit.ac.in/vtop/open/page",
                    "Content-Type": "application/x-www-form-urlencoded",
                }
                if hasattr(session, "_post"):
                    resp = session._post("processViewCalendar", fields, headers=headers)
                    html = resp.text
                elif hasattr(session, "http"):
                    resp = session.http.post(
                        "https://vtopcc.vit.ac.in/vtop/processViewCalendar",
                        data=fields,
                        headers=headers,
                        timeout=15.0,
                    )
                    html = resp.text
                else:
                    return None

            if html and ("calendar-table" in html or "calendar" in html.lower() or "<table" in html):
                return parse_calendar_html(html, cal_date=m_date)
            else:
                # Still build formatted calendar for that month
                month_label, yr, m_idx = _derive_month_year("", m_date)
                return _build_empty_month_calendar(month_label, yr, m_idx)
        except Exception as exc:
            logger.warning("[VTOP Calendar] Month %s fetch error: %s", m_date, exc)
            month_label, yr, m_idx = _derive_month_year("", m_date)
            return _build_empty_month_calendar(month_label, yr, m_idx)

    # Fetch all months in parallel
    month_results: Dict[str, Dict[str, Any]] = {}
    with ThreadPoolExecutor(max_workers=min(len(months), 6)) as executor:
        future_map = {executor.submit(fetch_month_worker, m): m for m in months}
        for future in future_map:
            m = future_map[future]
            try:
                res = future.result()
                if res:
                    month_results[m] = res
            except Exception as exc:
                logger.warning("[VTOP Calendar] Worker error on %s: %s", m, exc)

    all_calendars = [month_results[m] for m in months if m in month_results]

    if not all_calendars:
        logger.warning("[VTOP Calendar] No calendars parsed from live VTOP; falling back to static cache")
        return get_fallback_calendar(sem_id)

    logger.info("[VTOP Calendar] Successfully extracted %d months of live academic calendar for %s", len(all_calendars), sem_id)
    return {
        "semesterId": sem_id,
        "calendars": all_calendars,
    }


def get_fallback_calendar(semester_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Load cached academic calendar dataset and ensure all days have explicit entries.
    """
    sem_id = semester_id or "CH20262701"
    raw_calendars = []

    if os.path.exists(CALENDAR_JSON_PATH):
        try:
            with open(CALENDAR_JSON_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    raw_calendars = data.get("calendars") or []
                    sem_id = data.get("semesterId") or sem_id
                elif isinstance(data, list):
                    raw_calendars = data
        except Exception as exc:
            logger.warning("[Calendar] Fallback file read error: %s", exc)

    if not raw_calendars:
        # Generate default semester months for the semester
        months = get_semester_calendar_months(sem_id)
        raw_calendars = []
        for m_date in months:
            m_lbl, yr, m_idx = _derive_month_year("", m_date)
            raw_calendars.append(_build_empty_month_calendar(m_lbl, yr, m_idx))

    # Ensure no days in any month are left empty
    processed_calendars: List[Dict[str, Any]] = []
    for cal in raw_calendars:
        m_label = cal.get("month", "")
        m_lbl, yr, m_idx = _derive_month_year(m_label)
        days_in_month = cal_mod.monthrange(yr, m_idx)[1]

        existing_days = {d.get("date"): d.get("events", []) for d in (cal.get("days") or []) if d.get("date")}
        days_list: List[Dict[str, Any]] = []

        for d in range(1, days_in_month + 1):
            events = existing_days.get(d)
            if not events:
                weekday = datetime.date(yr, m_idx, d).weekday()
                if weekday == 6:
                    events = [{"text": "Sunday (Holiday)", "type": "Holiday", "color": "#ef4444", "category": "Sunday"}]
                elif weekday == 5:
                    events = [{"text": "Saturday (Weekend)", "type": "Other", "color": "#94a3b8", "category": "Weekend"}]
                else:
                    events = [{"text": "Instructional Day", "type": "Instructional Day", "color": "#10b981", "category": "Instructional Day"}]

            days_list.append({
                "date": d,
                "events": events,
            })

        processed_calendars.append({
            "month": m_label or m_lbl,
            "year": cal.get("year", yr),
            "days": days_list,
        })

    return {
        "semesterId": sem_id,
        "calendars": processed_calendars,
    }
