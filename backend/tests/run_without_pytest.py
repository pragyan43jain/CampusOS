"""
Stdlib-only test runner.

`pytest` is the canonical way to run this suite (`python -m pytest tests/`), but
it is a third-party dependency and is not always installed — CI containers, a
fresh clone, or a locked-down machine may not have it. Since these parser tests
are the only thing standing between us and shipping fabricated academic data,
they need to be runnable with nothing but a Python interpreter.

This runner collects `Test*` classes and their `test_*` methods exactly the way
pytest would for plain assert-based tests, and installs a minimal `pytest` shim
so the suite's `import pytest` succeeds. It supports only the features this
suite uses — `pytest.raises`, `pytest.approx`, `pytest.mark.*`, `pytest.fail`,
`pytest.skip`, and function-scoped fixtures including `autouse`, `yield`
teardown, and the `tmp_path` and `monkeypatch` builtins — and deliberately fails
loudly on anything else rather than silently doing the wrong thing.

The fixture support is not a nicety. An earlier version accepted
`@pytest.fixture(autouse=True)` and then ignored the flag, so a fixture whose job
was to redirect `storage.DATA_FILE` away from real data never ran: the storage
tests wrote to the developer's own `backend/data/store.json` and destroyed it. A
shim that quietly does less than the decorator promises is worse than one that
refuses outright.

Usage, from the `backend/` directory:

    python3 tests/run_without_pytest.py
    python3 tests/run_without_pytest.py test_vtop_parser
"""

from __future__ import annotations

import importlib
import inspect
import os
import sys
import traceback
import types
from typing import List, Tuple

BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

DEFAULT_MODULES = [
    "test_vtop_parser",
    "test_vtop_registry",
    "test_vtop_scraper",
    "test_storage",
]


# ---------------------------------------------------------------------------
# minimal pytest shim
# ---------------------------------------------------------------------------


class _Skipped(Exception):
    """Raised by the shim's ``pytest.skip``."""


class _Failed(Exception):
    """Raised by the shim's ``pytest.fail``."""


class _Raises:
    """Context manager standing in for ``pytest.raises``."""

    def __init__(self, expected, match: str | None = None):
        self.expected = expected
        self.match = match
        self.value: BaseException | None = None

    def __enter__(self) -> "_Raises":
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        if exc_type is None:
            name = getattr(self.expected, "__name__", str(self.expected))
            raise AssertionError(f"DID NOT RAISE {name}")
        if not issubclass(exc_type, self.expected):
            return False  # propagate: wrong exception type is a real failure
        if self.match is not None:
            import re

            if re.search(self.match, str(exc)) is None:
                raise AssertionError(
                    f"exception message {str(exc)!r} does not match {self.match!r}"
                )
        self.value = exc
        return True


class _Approx:
    """Numeric near-equality, standing in for ``pytest.approx``."""

    def __init__(self, expected, rel: float = 1e-6, abs: float = 1e-12):
        self.expected = expected
        self.rel = rel
        self.abs = abs

    def __eq__(self, other) -> bool:
        try:
            return abs(other - self.expected) <= max(
                self.abs, self.rel * abs(self.expected)
            )
        except TypeError:
            return NotImplemented

    def __repr__(self) -> str:
        return f"approx({self.expected!r})"


class _MarkStub:
    """``pytest.mark.anything`` -> a decorator that changes nothing."""

    def __getattr__(self, _name):
        def decorate(*args, **kwargs):
            if len(args) == 1 and not kwargs and callable(args[0]):
                return args[0]  # bare @pytest.mark.foo
            return lambda func: func  # @pytest.mark.foo(...)

        return decorate


def _fixture(func=None, **kwargs):
    """
    Stand-in for ``@pytest.fixture``.

    Only function scope is supported: the runner calls the fixture fresh for each
    test, which is pytest's default and the only behaviour this suite relies on.

    ``autouse`` is honoured. It has to be: a fixture that isolates a test from
    real files is usually autouse *precisely because* no test method names it, so
    silently ignoring the flag turns an isolated test into one that writes to the
    developer's own data. That is not a harmless gap in a test runner — it is a
    test suite that damages the thing it is testing.
    """

    def mark(target):
        target.__is_fixture__ = True
        target.__is_autouse__ = bool(kwargs.get("autouse", False))
        return target

    if callable(func):
        return mark(func)
    return mark


class _MonkeyPatch:
    """
    The slice of pytest's ``monkeypatch`` this suite uses, with undo.

    Records the previous value of everything it changes and restores it in reverse
    order, so a patched module global cannot leak into the next test.
    """

    _MISSING = object()

    def __init__(self):
        self._undo = []

    def setattr(self, target, name, value):
        previous = getattr(target, name, self._MISSING)
        self._undo.append((target, name, previous))
        setattr(target, name, value)

    def delattr(self, target, name, raising=True):
        previous = getattr(target, name, self._MISSING)
        if previous is self._MISSING:
            if raising:
                raise AttributeError(name)
            return
        self._undo.append((target, name, previous))
        delattr(target, name)

    def setenv(self, name, value):
        self.setattr(os.environ, name, str(value))

    def undo(self):
        while self._undo:
            target, name, previous = self._undo.pop()
            if previous is self._MISSING:
                try:
                    delattr(target, name)
                except AttributeError:
                    pass
            else:
                setattr(target, name, previous)


def _builtin_fixtures():
    """
    ``tmp_path`` and ``monkeypatch``, created fresh per test.

    Provided by the runner rather than the test modules so the suite reads the
    same under pytest and here.
    """
    import pathlib
    import tempfile

    def tmp_path():
        return pathlib.Path(tempfile.mkdtemp(prefix="campusos-test-"))

    def monkeypatch():
        patcher = _MonkeyPatch()
        yield patcher
        patcher.undo()

    for func in (tmp_path, monkeypatch):
        func.__is_fixture__ = True
        func.__is_autouse__ = False
    return {"tmp_path": tmp_path, "monkeypatch": monkeypatch}


def _install_pytest_shim() -> None:
    """Register the shim under ``pytest`` unless the real thing is importable."""
    try:
        import pytest  # noqa: F401

        print("Using the real pytest module.\n")
        return
    except ImportError:
        pass

    shim = types.ModuleType("pytest")
    shim.raises = _Raises
    shim.approx = _Approx
    shim.mark = _MarkStub()
    shim.fixture = _fixture
    shim.skip = lambda reason="": (_ for _ in ()).throw(_Skipped(reason))
    shim.fail = lambda reason="": (_ for _ in ()).throw(_Failed(reason))
    shim.Skipped = _Skipped
    shim.__doc__ = "Minimal shim installed by tests/run_without_pytest.py"
    sys.modules["pytest"] = shim
    print("pytest not installed — using the built-in shim.\n")


def _collect_fixtures(module: types.ModuleType):
    """
    Module-level ``@pytest.fixture`` functions, plus the runner's builtins.

    Module fixtures win on name collision, matching pytest, where a locally
    defined ``tmp_path`` would shadow the builtin one.
    """
    fixtures = _builtin_fixtures()
    fixtures.update(
        {
            name: func
            for name, func in vars(module).items()
            if callable(func) and getattr(func, "__is_fixture__", False)
        }
    )
    return fixtures


def _autouse_names(fixtures):
    return [
        name for name, func in fixtures.items() if getattr(func, "__is_autouse__", False)
    ]


def _instantiate(name, fixtures, cache, finalizers):
    """
    Produce one fixture value, recursing into whatever it depends on.

    A generator fixture is advanced to its first ``yield`` and its resumption is
    queued as a finalizer. Previously the generator *object* was handed to the
    test as if it were the value, so a ``yield``-style fixture's setup never ran
    at all — the reason ``isolated_store`` failed to isolate anything.
    """
    if name in cache:
        return cache[name]
    if name not in fixtures:
        raise LookupError(
            f"no fixture named {name!r} "
            f"(available: {', '.join(sorted(fixtures)) or 'none'})"
        )

    factory = fixtures[name]
    produced = factory(**_resolve_args(factory, fixtures, cache, finalizers))

    if inspect.isgenerator(produced):
        generator = produced
        value = next(generator)  # run setup, stop at the yield

        def finalize(gen=generator, fixture_name=name):
            try:
                next(gen)
            except StopIteration:
                pass  # normal: the fixture body ended after its teardown
            else:
                raise AssertionError(
                    f"fixture {fixture_name!r} yielded more than once"
                )

        finalizers.append(finalize)
    else:
        value = produced

    cache[name] = value
    return value


def _resolve_args(func, fixtures, cache, finalizers):
    """
    Build keyword arguments for a test method or fixture from available fixtures.

    ``cache`` gives one instance per test, matching pytest's function scope.
    """
    kwargs = {}
    for name in inspect.signature(func).parameters:
        if name == "self":
            continue
        kwargs[name] = _instantiate(name, fixtures, cache, finalizers)
    return kwargs


def _run_test(cls, method_name, fixtures):
    """
    Run one test with its fixtures, then tear them down in reverse order.

    Autouse fixtures are instantiated first and unconditionally, whether or not
    the test names them. Teardown runs even if the test fails, so a patched
    global is always restored before the next test.
    """
    cache: dict = {}
    finalizers: list = []
    try:
        for name in _autouse_names(fixtures):
            _instantiate(name, fixtures, cache, finalizers)
        instance = cls()
        method = getattr(instance, method_name)
        method(**_resolve_args(method, fixtures, cache, finalizers))
    finally:
        errors = []
        for finalize in reversed(finalizers):
            try:
                finalize()
            except Exception as exc:  # keep unwinding; report at the end
                errors.append(exc)
        if errors:
            raise errors[0]


# ---------------------------------------------------------------------------
# collection and execution
# ---------------------------------------------------------------------------


def _collect(module: types.ModuleType) -> List[Tuple[str, object, str]]:
    """Return (class_name, class, method_name) for every test method."""
    found: List[Tuple[str, object, str]] = []
    for class_name, cls in vars(module).items():
        if not class_name.startswith("Test") or not inspect.isclass(cls):
            continue
        if cls.__module__ != module.__name__:
            continue  # imported, not defined here
        for method_name, _ in inspect.getmembers(cls, inspect.isfunction):
            if method_name.startswith("test_"):
                found.append((class_name, cls, method_name))
    # Report in source order rather than alphabetical, so output reads like the file.
    order = {name: i for i, name in enumerate(_source_order(module))}
    found.sort(key=lambda item: (order.get(item[0], 10**6), item[2]))
    return found


def _source_order(module: types.ModuleType) -> List[str]:
    classes = [
        (cls.__dict__.get("__firstlineno__", 0) or inspect.getsourcelines(cls)[1], name)
        for name, cls in vars(module).items()
        if name.startswith("Test")
        and inspect.isclass(cls)
        and cls.__module__ == module.__name__
    ]
    return [name for _, name in sorted(classes)]


def run(module_names: List[str]) -> int:
    _install_pytest_shim()

    passed = 0
    skipped: List[str] = []
    failures: List[Tuple[str, str]] = []

    for module_name in module_names:
        module = importlib.import_module(f"tests.{module_name}")
        tests = _collect(module)
        fixtures = _collect_fixtures(module)
        print(f"{module_name}: collected {len(tests)} tests")

        current_class = None
        for class_name, cls, method_name in tests:
            if class_name != current_class:
                print(f"\n  {class_name}")
                current_class = class_name

            label = f"{module_name}::{class_name}::{method_name}"
            try:
                _run_test(cls, method_name, fixtures)
            except _Skipped as exc:
                skipped.append(f"{label} ({exc})")
                print(f"    s  {method_name}")
            except AssertionError as exc:
                detail = str(exc) or "assertion failed"
                failures.append((label, _format_failure(detail)))
                print(f"    FAIL  {method_name}")
            except Exception:
                failures.append((label, traceback.format_exc()))
                print(f"    ERROR {method_name}")
            else:
                passed += 1
                print(f"    ok  {method_name}")

    print("\n" + "=" * 70)
    if failures:
        for label, detail in failures:
            print(f"\nFAILED {label}\n{detail}")
        print("=" * 70)

    summary = f"{passed} passed, {len(failures)} failed"
    if skipped:
        summary += f", {len(skipped)} skipped"
    print(summary)
    return 1 if failures else 0


def _format_failure(detail: str) -> str:
    """
    Plain asserts carry no value introspection without pytest's rewriting, so
    include the failing source line to make the message actionable.
    """
    tb = traceback.extract_tb(sys.exc_info()[2])
    if tb:
        frame = tb[-1]
        return f"  {frame.filename}:{frame.lineno}\n  {frame.line}\n  -> {detail}"
    return f"  -> {detail}"


if __name__ == "__main__":
    sys.exit(run(sys.argv[1:] or DEFAULT_MODULES))
