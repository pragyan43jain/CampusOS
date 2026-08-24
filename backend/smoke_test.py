#!/usr/bin/env python3
"""
Live VTOP verification, run by hand on your own machine.

Nothing in the automated suite can prove the sync works: the fixture tests prove
the parsers are correct about markup we wrote down, and no sandbox can reach
vit.ac.in. This script is the missing half — it signs in to the real portal with
your real credentials and reports, module by module, what came back.

    cd backend
    python3 smoke_test.py

Your password is read with getpass (not echoed), passed to VTOP, and dropped. It
is never written to disk, never logged, and never kept on the session object — so
this script cannot be turned into a stored-credential feature by accident.

By default the local store is NOT touched, so running this cannot damage data your
dashboard is already showing. Pass --save to write the result.

Useful flags:

    --semester CH20242501   sync a specific semester instead of the newest
    --save                  persist the result to backend/data/store.json
    --dump DIR              write every raw HTML response to DIR (for parser work)
    --json FILE             write the assembled payload to FILE
    --no-open               don't try to open the captcha image automatically
"""

from __future__ import annotations

import argparse
import base64
import getpass
import json
import os
import sys
import tempfile
import webbrowser
from typing import Any, Dict, List

# Runnable as `python3 smoke_test.py` from the backend directory.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.vtop import constants as C  # noqa: E402
from app.vtop.scraper import sync  # noqa: E402
from app.vtop.session import VTOPAuthError, VTOPSession  # noqa: E402

MAX_CAPTCHA_ATTEMPTS = 4

# Strings the old build invented. If any of them show up in live output, a
# fabrication path has survived somewhere.
FORBIDDEN_VALUES = [
    "AB-2 • Room 304",
    "AB-2 402",
    "Academic Block",
    "Not assigned",
    "Assigned upon entry",
    "Course CSE1002",
    "Not connected",
    "Not synced yet",
]


# ---------------------------------------------------------------------------
# output helpers
# ---------------------------------------------------------------------------

BOLD, DIM, GREEN, YELLOW, RED, RESET = (
    ("\033[1m", "\033[2m", "\033[32m", "\033[33m", "\033[31m", "\033[0m")
    if sys.stdout.isatty()
    else ("", "", "", "", "", "")
)


def heading(text: str) -> None:
    print(f"\n{BOLD}{text}{RESET}\n{'-' * len(text)}")


def ok(text: str) -> None:
    print(f"  {GREEN}✓{RESET} {text}")


def warn(text: str) -> None:
    print(f"  {YELLOW}!{RESET} {text}")


def bad(text: str) -> None:
    print(f"  {RED}✗{RESET} {text}")


def note(text: str) -> None:
    print(f"    {DIM}{text}{RESET}")


def preview(value: Any, width: int = 88) -> str:
    text = json.dumps(value, ensure_ascii=False, default=str)
    return text if len(text) <= width else text[: width - 1] + "…"


# ---------------------------------------------------------------------------
# a session that keeps every response
# ---------------------------------------------------------------------------


class RecordingSession:
    """
    Wraps a VTOPSession and keeps each raw response body.

    Delegates everything else, so the pipeline cannot tell the difference. The
    point is that when a parser returns nothing, you need the exact HTML it saw —
    guessing at the markup is how the previous implementation got written.
    """

    def __init__(self, session: VTOPSession):
        self._session = session
        self.pages: Dict[str, str] = {}

    def __getattr__(self, name: str) -> Any:
        return getattr(self._session, name)

    def _record(self, path: str, body: str) -> str:
        self.pages[path] = body
        return body

    def post_menu(self, path: str, with_win_image: bool = False) -> str:
        return self._record(path, self._session.post_menu(path, with_win_image))

    def post_semester(self, path: str, semester_id: str, csrf_first: bool = True) -> str:
        return self._record(
            path, self._session.post_semester(path, semester_id, csrf_first)
        )

    def post_simple(self, path: str) -> str:
        return self._record(path, self._session.post_simple(path))


# ---------------------------------------------------------------------------
# sign-in
# ---------------------------------------------------------------------------


def show_captcha(data_url: str, open_it: bool) -> str:
    """Write the captcha to a PNG and return its path."""
    payload = data_url.split("base64,", 1)[1] if "base64," in data_url else data_url
    path = os.path.join(tempfile.gettempdir(), "campusos_captcha.png")
    with open(path, "wb") as handle:
        handle.write(base64.b64decode(payload))
    print(f"    captcha image: {path}")
    if open_it:
        try:
            webbrowser.open(f"file://{path}")
        except Exception:
            note("(could not open it automatically — open the path above)")
    return path


def sign_in(session: VTOPSession, open_captcha: bool) -> None:
    """
    Interactive sign-in, retrying while the captcha is the problem.

    A wrong captcha is retryable and gets a fresh challenge; a wrong password is
    not, and retrying would only walk you towards VTOP's lockout.
    """
    heading("1. Sign in")

    if not sys.stdin.isatty():
        raise SystemExit(
            "This script needs an interactive terminal — it prompts for your "
            "registration number, password and captcha."
        )

    reg_no = input("  Registration number: ").strip()
    if not reg_no:
        raise SystemExit("No registration number given.")
    password = getpass.getpass("  Password (not echoed, not stored): ")
    if not password:
        raise SystemExit("No password given.")

    print("\n  Reaching the portal…")
    session.start_handshake()
    ok(f"login form served ({session.captcha_kind} captcha)")

    for attempt in range(1, MAX_CAPTCHA_ATTEMPTS + 1):
        captcha = session.fetch_captcha()

        if captcha.get("captchaKind") == "grecaptcha":
            raise SystemExit(
                "  VTOP is serving Google reCAPTCHA right now, which cannot be "
                "solved outside a browser. This is usually temporary — try again "
                "later.\n"
            )
        if not captcha.get("captchaImage"):
            raise SystemExit(
                f"  VTOP returned no captcha image: {captcha.get('message')}"
            )

        show_captcha(captcha["captchaImage"], open_captcha)
        guess = captcha.get("solvedCaptcha")
        if guess:
            note(f"OCR guess: {guess}  (press Enter to accept, or type the correct one)")
            answer = input(f"    captcha [{guess}]: ").strip() or guess
        else:
            note("OCR could not read it — type what you see")
            answer = input("    captcha: ").strip()

        try:
            session.login(reg_no, password, answer)
        except VTOPAuthError as exc:
            if exc.retryable and attempt < MAX_CAPTCHA_ATTEMPTS:
                warn(f"{exc.message}")
                note(f"attempt {attempt} of {MAX_CAPTCHA_ATTEMPTS}; fetching a new captcha")
                continue
            raise SystemExit(f"\n  {RED}Sign-in failed:{RESET} {exc.message}\n")
        else:
            ok(f"authenticated as {session.username}")
            note(f"authorizedID = {session.authorized_id}")
            # Freed as soon as VTOP has seen it.
            del password
            return

    raise SystemExit("\n  Ran out of captcha attempts.\n")


# ---------------------------------------------------------------------------
# reporting
# ---------------------------------------------------------------------------


def report_modules(payload: Dict[str, Any]) -> List[str]:
    """Print the per-module table. Returns the names of failed modules."""
    heading("3. Module results")

    report = payload.get("syncReport") or {}
    modules: Dict[str, Any] = report.get("modules") or {}
    failed: List[str] = []

    width = max((len(name) for name in modules), default=10)
    for name, info in modules.items():
        status = info.get("status")
        count = info.get("count")
        label = f"{name.ljust(width)}  {str(status).ljust(12)}"
        # The two *Page steps record the length of the HTML they fetched, not a
        # number of records — calling that "rows" would be a lie in the one report
        # whose whole job is to be trustworthy.
        unit = "bytes of HTML" if name.endswith("Page") else "row(s)"
        detail = "" if count is None else f"{count} {unit}"

        if status == "ok":
            ok(f"{label}{detail}")
        elif status == "empty":
            # Not an error: VTOP answered, and the answer was "nothing yet".
            warn(f"{label}nothing published")
        elif status == "unavailable":
            warn(f"{label}{info.get('message') or 'not scraped'}")
        else:
            failed.append(name)
            bad(f"{label}{detail}")
            if info.get("message"):
                note(info["message"])
    return failed


def report_data(payload: Dict[str, Any]) -> None:
    """Show enough of each module to eyeball whether it is actually right."""
    heading("4. What came back")

    modules = (payload.get("syncReport") or {}).get("modules") or {}

    # Two payload keys are named differently from the step that produces them:
    # the timetable comes from the grid step, and the faculty list is a projection
    # of the course table. Without this mapping a failed step would leave those
    # lines looking like a legitimately empty result.
    STEP_FOR = {"timetable": "timetableGrid", "faculty": "courses"}

    def status_of(name: str) -> str:
        """Distinguish 'you have none' from 'we could not fetch it'."""
        status = (modules.get(STEP_FOR.get(name, name)) or {}).get("status")
        if status == "failed":
            return f"  {RED}(fetch failed — not actually empty){RESET}"
        if status == "unavailable":
            return f"  {DIM}(not scraped){RESET}"
        return ""

    student = payload.get("student") or {}
    print(f"  {BOLD}Student{RESET}")
    for field in ("name", "regNo", "program", "branch", "email", "semester"):
        value = student.get(field)
        print(f"    {field:<12} {value if value is not None else DIM + 'null' + RESET}")
    overall = student.get("overallAttendance") or {}
    print(
        f"    {'attendance':<12} "
        f"{overall.get('attended')}/{overall.get('total')} = "
        f"{overall.get('displayPercentage')}"
    )
    print(f"    {'credits':<12} {student.get('registeredCredits')} registered")

    for key in ("courses", "attendance", "marks", "timetable", "faculty"):
        rows = payload.get(key) or []
        print(f"\n  {BOLD}{key}{RESET} — {len(rows)} record(s){status_of(key)}")
        if rows:
            note(f"first: {preview(rows[0])}")

    exams = payload.get("exams") or {}
    total_exams = sum(len(v) for v in exams.values())
    print(
        f"\n  {BOLD}exams{RESET} — {total_exams} across "
        f"{len(exams)} type(s){status_of('exams')}"
    )
    for exam_type, entries in exams.items():
        note(f"{exam_type}: {len(entries)}")
        if entries:
            note(f"  first: {preview(entries[0])}")


def report_joins(payload: Dict[str, Any]) -> List[str]:
    """
    Check the joins — the part fixtures can least guarantee.

    Everything here is about whether live slot codes bind to live courses. If they
    do not, attendance and marks are attached to the wrong course or to nothing,
    which is the failure that made the old dashboard untrustworthy.
    """
    heading("5. Course binding")
    problems: List[str] = []

    registry = payload.get("registry") or {}
    print(f"  {registry.get('courseCount', 0)} registered course(s)")
    note(f"slots per namespace: {registry.get('slotCounts')}")

    conflicts = registry.get("conflicts") or []
    if conflicts:
        problems.append(f"{len(conflicts)} slot conflict(s)")
        bad(f"{len(conflicts)} slot(s) map to more than one course — those rows resolve to nothing")
        for conflict in conflicts[:5]:
            note(f"{conflict.get('type')} slot {conflict.get('slot')}: {conflict.get('courses')}")
    else:
        ok("no slot conflicts")

    unmatched = registry.get("unmatched") or []
    if unmatched:
        problems.append(f"{len(unmatched)} unmatched slot(s)")
        bad(f"{len(unmatched)} slot(s) appeared in other modules but not in your course list")
        for row in unmatched[:8]:
            note(f"{row.get('type')} slot {row.get('slot')} ({row.get('occurrences')}x)")
    else:
        ok("every slot seen elsewhere exists in the course list")

    for key in ("attendance", "marks", "timetable"):
        rows = payload.get(key) or []
        unresolved = [r for r in rows if not r.get("resolved")]
        if not rows:
            continue
        if unresolved:
            problems.append(f"{len(unresolved)} unbound {key} row(s)")
            bad(f"{len(unresolved)} of {len(rows)} {key} rows are not bound to a course")
            for row in unresolved[:5]:
                note(preview(row))
        else:
            ok(f"all {len(rows)} {key} rows bound to a registered course")

    warnings = (payload.get("syncReport") or {}).get("warnings") or []
    if warnings:
        print(f"\n  {len(warnings)} warning(s):")
        for warning in warnings:
            warn(warning)
    return problems


def check_no_fabrication(payload: Dict[str, Any]) -> List[str]:
    """Confirm none of the old invented values reached the live payload."""
    heading("6. Fabrication check")
    # ensure_ascii=False matters: the invented venue contained a bullet ("AB-2 •
    # Room 304"), and the default escaping turns that into •, so a substring
    # search over the escaped text silently matches nothing. This check would have
    # passed while the exact string it exists to catch sat in the payload.
    rendered = json.dumps(payload, ensure_ascii=False, default=str)
    found = [value for value in FORBIDDEN_VALUES if value in rendered]
    if found:
        for value in found:
            bad(f"invented value present: {value!r}")
        return [f"{len(found)} fabricated value(s)"]
    ok("no known placeholder or invented value in the payload")

    # A displayed percentage with no counts behind it would be the other tell.
    inconsistent = [
        row.get("courseCode")
        for row in payload.get("attendance") or []
        if row.get("percentage") is not None and not row.get("total")
    ]
    if inconsistent:
        bad(f"attendance percentage with no class count: {inconsistent}")
        return ["percentage without counts"]
    ok("every attendance percentage has real counts behind it")
    return []


def validate_schema(payload: Dict[str, Any]) -> List[str]:
    """Optional: check the payload against the documented response schema."""
    heading("7. Schema check")
    try:
        from app.vtop.models import SyncPayload
    except ImportError as exc:
        warn(f"skipped (pydantic unavailable: {exc})")
        return []
    try:
        SyncPayload(**payload)
    except Exception as exc:
        bad(f"payload does not match app/vtop/models.py: {exc}")
        note("the schema is documentation, so this is a docs bug unless a type is wrong")
        return ["schema mismatch"]
    ok("payload matches the documented schema")
    return []


def dump_pages(pages: Dict[str, str], directory: str) -> None:
    os.makedirs(directory, exist_ok=True)
    for path, body in pages.items():
        filename = path.replace("/", "_") + ".html"
        with open(os.path.join(directory, filename), "w", encoding="utf-8") as handle:
            handle.write(body)
    print(f"  wrote {len(pages)} raw response(s) to {directory}")


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(description="Live VTOP sync verification.")
    parser.add_argument("--semester", help="semesterSubId to sync (default: newest)")
    parser.add_argument(
        "--save", action="store_true", help="persist the result to data/store.json"
    )
    parser.add_argument("--dump", metavar="DIR", help="write raw HTML responses here")
    parser.add_argument("--json", metavar="FILE", help="write the payload here")
    parser.add_argument(
        "--no-open", action="store_true", help="don't open the captcha image"
    )
    args = parser.parse_args()

    print(f"{BOLD}CampusOS — live VTOP check{RESET}")
    print(f"  portal: {C.BASE_URL}  (campus: {C.CAMPUS})")
    print(f"  {DIM}Your password is used once and never stored.{RESET}")
    if not args.save:
        print(f"  {DIM}The local store will not be modified (pass --save to change that).{RESET}")

    session = VTOPSession()
    try:
        sign_in(session, open_captcha=not args.no_open)
    except KeyboardInterrupt:
        print("\n  Cancelled.")
        return 130

    recorder = RecordingSession(session)
    problems: List[str] = []

    heading("2. Scrape")
    print("  Fetching every module — this takes a few seconds…")
    try:
        payload = sync(recorder, semester_id=args.semester)
    except Exception as exc:
        bad(f"the scrape failed outright: {type(exc).__name__}: {exc}")
        if args.dump:
            dump_pages(recorder.pages, args.dump)
        session.logout()
        return 1

    semesters = payload.get("semesters") or []
    selected = payload.get("selectedSemester") or {}
    if semesters:
        ok(f"{len(semesters)} semester(s) in the dropdown")
        note(f"synced: {selected.get('name')} ({selected.get('id')})")
        note("other ids: " + ", ".join(s["id"] for s in semesters[1:6]))
    else:
        bad("no semester dropdown — nothing semester-scoped could be fetched")
        problems.append("no semesters")

    failed = report_modules(payload)
    problems.extend(f"{name} failed" for name in failed)
    report_data(payload)
    problems.extend(report_joins(payload))
    problems.extend(check_no_fabrication(payload))
    problems.extend(validate_schema(payload))

    if args.dump or failed:
        heading("Raw responses")
        directory = args.dump or os.path.join(tempfile.gettempdir(), "campusos_vtop_html")
        dump_pages(recorder.pages, directory)
        if failed and not args.dump:
            note("dumped because a module failed — these are what the parsers saw")

    if args.json:
        with open(args.json, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, default=str)
        print(f"\n  payload written to {args.json}")

    if args.save:
        from app.storage import save_store

        save_store(
            {
                **payload,
                "authenticated": True,
                "message": "Synced with VTOP (smoke_test.py).",
                "lastSynced": (payload.get("student") or {}).get("lastSynced"),
            }
        )
        print("  saved to data/store.json — the dashboard will now show this data")

    session.logout()

    heading("Verdict")
    if not problems:
        print(f"  {GREEN}Live sync works.{RESET} Every module returned data and every")
        print("  row bound to a registered course.")
        return 0

    print(f"  {YELLOW}Sync ran, with {len(problems)} thing(s) to look at:{RESET}")
    for problem in problems:
        print(f"    - {problem}")
    print(
        "\n  Modules that failed are reported as unavailable in the app rather than\n"
        "  filled in, so the dashboard stays truthful either way."
    )
    return 2


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nCancelled.")
        sys.exit(130)
