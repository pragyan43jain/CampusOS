"""
REMOVED: the payload validator/normaliser.

This module sat between the scrapers and the store, "repairing" incomplete
payloads. In practice repairing meant substituting: a blank venue became
``"AB-2 • Room 304"``, a missing exam date became a date a few weeks out, an
absent course title became ``"Course CSE1002"``. Any parser bug was therefore
invisible — the validator papered over it with something that rendered fine.

Normalisation now happens where the data is read, in ``app/vtop/parser.py``, and
its only permitted outputs are the parsed value or ``None``. Aggregate maths lives
in ``app/vtop/math_engine.py``, which returns ``hasValidData: False`` rather than a
computed-from-nothing figure.

Kept as a tombstone so a stale import fails loudly. Safe to
``git rm app/vtop/validator.py`` once no branch references it.
"""

raise ImportError(
    "app.vtop.validator was removed: payloads are no longer back-filled with "
    "substitute values. Parsers emit None for missing fields and "
    "app.vtop.scraper records why in syncReport."
)
