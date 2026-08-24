"""
Superseded. Left empty on purpose.

These tests exercised ``app.vtop.validator``, which back-filled missing fields
with substitute values — one case asserted that a blank venue normalised to
``"Academic Block 2"``. Both the module and that behaviour are gone, so the tests
went with them.

Replacements: ``tests/test_vtop_parser.py`` (parsing, including the missing-value
cases these covered) and ``tests/test_vtop_scraper.py`` (whose
``TestNoFabricatedValues`` asserts the substituted strings never appear).

Safe to ``git rm tests/test_validator.py``.
"""
