"""Deployment safeguards and real PDF generation without installed system fonts."""

import os
import subprocess
import sys
from pathlib import Path

import pymupdf
import pytest
from reportlab.pdfbase import pdfmetrics

from backend.app import cloud_build
from .test_workflow import env, login, product, data, H


def vercel_import_environment():
    # A deliberately unreachable test database: import/startup and the root
    # route must not connect to it or create tables during a serverless cold start.
    return {
        **os.environ,
        "VERCEL": "1",
        "VERCEL_ENV": "production",
        "APP_ENV": "production",
        "DATABASE_URL": "postgresql://user:unused@127.0.0.1:1/casa?connect_timeout=1",
        "ALLOWED_ORIGINS": "https://web.example.com",
        "SESSION_HOURS": "8",
        "CASA_INITIALIZE_DATABASE": "false",
    }


@pytest.mark.parametrize("missing", ["APP_ENV", "DATABASE_URL", "ALLOWED_ORIGINS"])
def test_cloud_build_detects_missing_startup_variables_without_initialization(missing):
    settings = vercel_import_environment()
    settings.pop(missing)
    result = subprocess.run(
        [sys.executable, "-m", "backend.app.cloud_build"],
        env=settings,
        capture_output=True,
        text=True,
        timeout=20,
    )
    assert result.returncode != 0
    assert missing in result.stderr
    assert "RuntimeError" in result.stderr
    assert "Database initialization disabled" not in result.stdout


def test_real_vercel_entrypoint_starts_and_serves_root():
    settings = vercel_import_environment()
    build = subprocess.run(
        [sys.executable, "-m", "backend.app.cloud_build"],
        env=settings,
        capture_output=True,
        text=True,
        timeout=20,
    )
    assert build.returncode == 0, build.stderr
    assert "backend imports validated" in build.stdout
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            """
from app import app
from backend.app.main import app as backend_app
from fastapi.testclient import TestClient
assert app is backend_app
with TestClient(app) as client:
    response = client.get('/')
    assert response.status_code == 200, response.text
    assert response.json()['service'] == 'CASAMELIA QUOTATION SOFTWARE'
    assert response.json()['health'] == '/health'
    for path in ['/auth/me', '/quotations', '/areas']:
        assert client.get(path).status_code == 401, path
print('Real FastAPI lifecycle, root HTTP 200 and protected routes verified.')
""",
        ],
        env=settings,
        capture_output=True,
        text=True,
        timeout=20,
    )
    assert result.returncode == 0, result.stderr


@pytest.mark.parametrize(
    "scheme", ["postgres://", "postgresql://", "postgresql+psycopg://"]
)
def test_managed_postgres_url_and_https_config(scheme):
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "from backend.app.config import DATABASE_URL, ALLOWED_ORIGINS; assert DATABASE_URL.startswith('postgresql+psycopg://'); assert ALLOWED_ORIGINS == ['https://web.example.com']",
        ],
        env={
            **os.environ,
            "APP_ENV": "production",
            "DATABASE_URL": scheme + "user:unused@db.example.com/casa?sslmode=require",
            "ALLOWED_ORIGINS": " https://web.example.com/ ",
        },
        capture_output=True,
    )
    assert result.returncode == 0, result.stderr.decode()


@pytest.mark.parametrize(
    "database,origin,message",
    [
        (
            "sqlite:///unused.db",
            "https://web.example.com",
            "Production requires DATABASE_URL",
        ),
        ("postgresql://user:unused@db.example.com/casa", "", "Set ALLOWED_ORIGINS"),
        (
            "postgresql://user:unused@db.example.com/casa",
            "http://web.example.com",
            "must contain HTTPS",
        ),
    ],
)
def test_hosting_rejects_unsafe_configuration(database, origin, message):
    result = subprocess.run(
        [sys.executable, "-c", "import backend.app.config"],
        env={
            **os.environ,
            "APP_ENV": "production",
            "DATABASE_URL": database,
            "ALLOWED_ORIGINS": origin,
        },
        capture_output=True,
    )
    assert result.returncode != 0
    assert message in result.stderr.decode()


def test_preview_cannot_initialize_database(monkeypatch):
    monkeypatch.setenv("CASA_INITIALIZE_DATABASE", "true")
    monkeypatch.setenv("VERCEL_ENV", "preview")
    with pytest.raises(RuntimeError, match="only in production builds"):
        cloud_build.main()


@pytest.mark.parametrize("child_fails", [False, True])
def test_cloud_init_serialized_and_uses_direct_connection(monkeypatch, child_fails):
    monkeypatch.setenv("CASA_INITIALIZE_DATABASE", "true")
    monkeypatch.setenv("VERCEL_ENV", "production")
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv(
        "DIRECT_DATABASE_URL",
        "postgresql://user:unused@direct.example.com/casa?sslmode=require",
    )
    events = []

    class Connection:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

        def execute(self, statement):
            events.append(str(statement))

    class Engine:
        def connect(self):
            return Connection()

    def create_engine(url, **kwargs):
        assert url.startswith("postgresql+psycopg://")
        assert "direct.example.com" in url
        return Engine()

    def run(command, **kwargs):
        events.append("init")
        assert command[-3:] == ["-m", "backend.app.cli", "init"]
        assert "direct.example.com" in kwargs["env"]["DATABASE_URL"]
        assert kwargs["check"] is True
        if child_fails:
            raise subprocess.CalledProcessError(1, command)

    monkeypatch.setattr("sqlalchemy.create_engine", create_engine)
    monkeypatch.setattr(cloud_build.subprocess, "run", run)
    if child_fails:
        with pytest.raises(subprocess.CalledProcessError):
            cloud_build.main()
    else:
        cloud_build.main()
    assert events == [
        "SELECT pg_advisory_lock(730031026)",
        "init",
        "SELECT pg_advisory_unlock(730031026)",
    ]


def test_pdf_works_with_only_bundled_fonts(env, monkeypatch, tmp_path):
    exists = Path.exists

    def cloud_exists(path):
        name = str(path).replace("\\", "/")
        if name.startswith(("C:/Windows/Fonts/", "/usr/share/fonts/")):
            return False
        return exists(path)

    monkeypatch.setattr(Path, "exists", cloud_exists)
    client, _ = env
    login(client)
    selected = product(client)
    quotation = client.post("/quotations", json=data(selected["id"]), headers=H).json()
    response = client.post(f'/quotations/{quotation["id"]}/generate', headers=H)
    assert response.status_code == 200, response.text
    response = client.get(f'/quotations/{quotation["id"]}/pdf')
    assert response.status_code == 200
    assert response.content.startswith(b"%PDF")
    face = pdfmetrics.getFont("Casa").face
    assert "DejaVu" in str(face.name)
    assert ord("₹") in face.charToGlyph
    with pymupdf.open(stream=response.content, filetype="pdf") as pdf:
        text = "\n".join(page.get_text() for page in pdf)
        assert "QA Customer" in text
        assert "Length" in text
        assert abs(pdf[0].rect.width - 595.28) < 1
        assert abs(pdf[0].rect.height - 841.89) < 1
    (tmp_path / "cloud-font-quotation.pdf").write_bytes(response.content)
