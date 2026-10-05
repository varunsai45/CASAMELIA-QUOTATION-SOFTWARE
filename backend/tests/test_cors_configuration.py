"""Exercise the actual environment-driven CORS middleware and cookie login."""

import os
import subprocess
import sys


def test_exact_frontend_origin_preflight_and_sessions(tmp_path):
    script = """
from fastapi.testclient import TestClient
from backend.app.main import app
origin = 'https://casamelia-quotation-web.vercel.app'
headers = {'Origin': origin, 'X-Casa-Request': '1'}
with TestClient(app, base_url=origin) as client:
    preflight = client.options('/auth/login', headers={
        'Origin': origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,x-casa-request',
    })
    assert preflight.status_code == 200, preflight.text
    assert preflight.headers['access-control-allow-origin'] == origin
    assert preflight.headers['access-control-allow-credentials'] == 'true'
    assert 'POST' in preflight.headers['access-control-allow-methods']
    assert 'x-casa-request' in preflight.headers['access-control-allow-headers'].lower()
    for local_origin in ['http://localhost:3100', 'http://localhost:3000']:
        local = client.options('/auth/login', headers={'Origin':local_origin, 'Access-Control-Request-Method':'POST'})
        assert local.status_code == 200
        assert local.headers['access-control-allow-origin'] == local_origin
    for bad_origin in ['https://evil.example', 'https://unapproved-preview.vercel.app']:
        denied = client.options('/auth/login', headers={
            'Origin':bad_origin, 'Access-Control-Request-Method':'POST',
        })
        assert denied.status_code == 400
        assert 'access-control-allow-origin' not in denied.headers
        denied_login = client.post('/auth/login', headers={'Origin':bad_origin, 'X-Casa-Request':'1'}, json={'username':'admin','password':'admin123'})
        assert denied_login.status_code == 403
    for user in ['admin', 'sales']:
        response = client.post('/auth/login', json={'username': user, 'password': user+'123'}, headers=headers)
        assert response.status_code == 200, response.text
        assert response.headers['access-control-allow-origin'] == origin
        assert 'httponly' in response.headers['set-cookie'].lower()
        assert 'secure' in response.headers['set-cookie'].lower()
        assert client.get('/auth/me').json()['role'] == user
        assert client.get('/dashboard').status_code == 200
        assert client.get('/quotations').status_code == 200
        if user == 'sales':
            assert client.get('/users').status_code == 403
        assert client.post('/auth/logout', headers=headers).status_code == 204
        assert client.get('/auth/me').status_code == 401
"""
    environment = {
        **os.environ,
        "APP_ENV": "development",
        "DATABASE_URL": f"sqlite:///{(tmp_path / 'cors.db').as_posix()}",
        "ALLOWED_ORIGINS": "https://casamelia-quotation-web.vercel.app,http://localhost:3100,http://localhost:3000",
        "ADMIN_PASSWORD": "admin123",
        "SALES_PASSWORD": "sales123",
        "COOKIE_SECURE": "true",
    }
    environment.pop("VERCEL", None)
    result = subprocess.run(
        [sys.executable, "-c", script],
        env=environment,
        capture_output=True,
        text=True,
        timeout=40,
    )
    assert result.returncode == 0, result.stderr
