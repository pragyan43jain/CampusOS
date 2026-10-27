"""Regression checks for identity isolation and honest portal data."""
import hashlib
import hmac
import base64
import json
import time
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app import auth_crypto, storage
from app.main import app
from app.routers import teams, lms
from app.routers.auth import resolve_student_reg
from app.vtop.calendar import get_fallback_calendar


@pytest.fixture
def production_store(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, 'DATA_DIR', str(tmp_path))
    monkeypatch.setattr(storage, 'DATA_FILE', str(tmp_path / 'store.json'))
    monkeypatch.setattr(storage, '_MEM_CACHE', {})
    monkeypatch.setattr(auth_crypto, '_CACHED_SECRET', 'regression-test-secret')


def test_same_suffix_is_not_same_student(production_store):
    store = storage.empty_store()
    store['student']['regNo'] = '24BLC1100'
    storage.save_store(store, '24BLC1100')
    assert storage.load_store('25BLC1100')['student']['regNo'] is None
    token = auth_crypto.generate_signed_session_token('24BLC1100')
    with pytest.raises(HTTPException) as exc:
        resolve_student_reg(authorization=token, reg_no='25BLC1100')
    assert exc.value.status_code == 403


def test_bundled_student_is_not_a_live_store(production_store):
    assert storage.load_store('24BLC1100')['student']['regNo'] is None


def test_display_name_cannot_link_accounts(production_store):
    store = storage.empty_store()
    store['student'].update(regNo='24BLC1100', name='Example Student', email='real@vitstudent.ac.in')
    storage.save_store(store, '24BLC1100')
    assert storage.find_reg_by_email('example.student@vitstudent.ac.in') is None
    assert storage.find_reg_by_email('real@vitstudent.ac.in') == '24BLC1100'
    assert storage.find_reg_by_email('24BLC1100@attacker.example') is None


@pytest.mark.parametrize('records', [
    {'value': [{'id': 'other', 'recipient': {'userId': 'other'}, 'status': 'submitted'}]},
    {'id': 'other', 'recipient': {'userId': 'other'}, 'status': 'submitted'},
    {'value': [{'id': 'unknown', 'status': 'submitted'}, {'id': 'other', 'status': 'working'}]},
])
def test_teams_never_uses_another_students_submission(records):
    session = MagicMock()
    session.get.return_value.status_code = 200
    session.get.return_value.json.return_value = records
    record, failed = teams.fetch_student_teams_submission('c', 'a', {}, 'me', max_retries=0, session=session)
    assert record is None
    assert failed is True


def test_mfa_is_not_successful_authentication():
    response = MagicMock(status_code=400)
    response.json.return_value = {'error_codes': [50076]}
    with patch.object(teams.requests, 'post', return_value=response):
        with pytest.raises(HTTPException) as exc:
            teams.authenticate_microsoft_online('student@vitstudent.ac.in', 'password')
    assert exc.value.status_code == 401


def test_unsigned_registration_does_not_select_teams_store(production_store):
    with patch.object(teams, 'verify_microsoft_realm', return_value={}), \
         patch.object(teams, 'authenticate_microsoft_online', return_value={'token': {'access_token': 'token'}}) as login, \
         patch.object(teams, 'fetch_microsoft_teams_coursework', return_value=({}, [], [], [])):
        response = TestClient(app).post('/api/teams/login', json={
            'email': 'someone@vitstudent.ac.in', 'password': ' password ', 'regNo': '24BLC1100',
        })
    assert response.status_code == 200
    assert response.json()['regNo'].startswith('TEAMS_')
    login.assert_called_once_with('someone@vitstudent.ac.in', ' password ')


def test_lms_cookie_login_rejects_login_page():
    session = MagicMock()
    session.get.return_value.status_code = 200
    session.get.return_value.text = '<form><input name="password"></form>'
    with patch.object(lms, 'get_lms_session', return_value=session):
        with pytest.raises(HTTPException) as exc:
            lms.authenticate_lms_session(None, None, 'expired-cookie')
    assert exc.value.status_code == 401


def test_calendar_fallback_does_not_invent_events():
    calendar = get_fallback_calendar('CH20262701')
    assert calendar['source'] == 'unavailable'
    assert calendar['calendars']
    assert all(not day['events'] for month in calendar['calendars'] for day in month['days'])


def test_serverless_requires_private_secret(monkeypatch):
    monkeypatch.setattr(auth_crypto, '_CACHED_SECRET', None)
    for key in ('CAMPUSOS_SESSION_SECRET', 'CAMPUSOS_ADMIN_KEY', 'SECRET_KEY'):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv('VERCEL', '1')
    with pytest.raises(RuntimeError, match='CAMPUSOS_SESSION_SECRET'):
        auth_crypto.get_auth_secret()


@pytest.mark.parametrize('expiration', [None, 'tomorrow', True, float('inf'), 0])
def test_token_requires_finite_future_expiry(expiration, production_store):
    payload = base64.urlsafe_b64encode(json.dumps({'reg': '24BLC1100', 'exp': expiration}).encode()).decode().rstrip('=')
    signature = hmac.new(auth_crypto.get_auth_secret().encode(), payload.encode(), hashlib.sha256).hexdigest()
    assert auth_crypto.verify_session_token(f'cos_{payload}.{signature}') is None


def test_linking_integration_preserves_vtop_session_state(production_store):
    token = auth_crypto.generate_signed_session_token('24BLC1100', extra={'state': {'is_authenticated': True}})
    assert auth_crypto.integration_session_token('24BLC1100', f'Bearer {token}', None) == token
    assert auth_crypto.integration_session_token('25BLC1100', token, None) != token


def test_cached_teams_sync_keeps_original_timestamp(production_store):
    store = storage.empty_store()
    store['student']['regNo'] = '24BLC1100'
    store['teamsConnected'] = True
    store['teamsAccount'] = {'email': 'student@vitstudent.ac.in', 'lastSynced': '2026-01-01T00:00:00Z'}
    store['assignments'] = [{'id': 'teams-1', 'source': 'Teams', 'title': 'Verified assignment'}]
    storage.save_store(store, '24BLC1100')
    token = auth_crypto.generate_signed_session_token('24BLC1100')
    with patch.object(teams, 'fetch_microsoft_teams_coursework', return_value=({}, [], [], [])):
        response = TestClient(app).post('/api/teams/sync', headers={'Authorization': f'Bearer {token}'})
    assert response.status_code == 200
    assert response.json()['status'] == 'STALE'
    assert response.json()['lastSynced'] == '2026-01-01T00:00:00Z'
    assert storage.load_store('24BLC1100')['teamsAccount']['lastSyncAttempt']
