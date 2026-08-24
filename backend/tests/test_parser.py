"""
Superseded. Left empty on purpose.

These tests targeted the first-generation parser API —
``normalize_venue_and_room``, ``parse_student_profile``, ``parse_attendance_table``
and friends — none of which exist any more. They also encoded the behaviour that
was the actual bug: ``normalize_venue_and_room("")`` returning a filled-in block
name, and profile parsing that guessed at column positions.

Replacement: ``tests/test_vtop_parser.py``, which pins the current API against
HTML fixtures built from the reference implementation's markup.

Safe to ``git rm tests/test_parser.py``.
"""
