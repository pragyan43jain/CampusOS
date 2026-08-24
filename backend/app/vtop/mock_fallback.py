"""
REMOVED: the mock/demo data generator.

This module used to synthesise a complete student payload — name, CGPA,
attendance percentages, room numbers, exam dates — and ``client.py`` fell back to
it whenever a VTOP scrape came back thin, as well as whenever the password was
``demo123`` or ``test1234``. The result was a dashboard that looked authoritative
and was fiction, with nothing on screen to distinguish the two.

That fallback is gone. Missing data is now reported as missing: ``None`` in the
payload, an explicit status in ``syncReport``, and an "unavailable" state in the
UI. See ``app/vtop/scraper.py``.

The file is kept as a tombstone rather than silently emptied so that any
lingering import fails loudly instead of resolving to something plausible. It can
be deleted outright (``git rm app/vtop/mock_fallback.py``) once no branch
references it.
"""

raise ImportError(
    "app.vtop.mock_fallback was removed: CampusOS no longer generates stand-in "
    "academic data. Use app.vtop.scraper.sync(), which reports missing modules "
    "instead of inventing them."
)
