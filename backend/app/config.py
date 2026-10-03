import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
DATABASE_URL = os.getenv(
    "DATABASE_URL", f'sqlite:///{(DATA / "casamelia.db").as_posix()}'
)


def normalize_database_url(value):
    if value.startswith("postgres://"):
        return "postgresql+psycopg://" + value[len("postgres://") :]
    if value.startswith("postgresql://"):
        return "postgresql+psycopg://" + value[len("postgresql://") :]
    return value


PRODUCTION = os.getenv("APP_ENV", "development") == "production"
if os.getenv("VERCEL") and not PRODUCTION:
    raise RuntimeError("Set APP_ENV=production for the Vercel API project.")
DATABASE_URL = normalize_database_url(DATABASE_URL)
if PRODUCTION and not DATABASE_URL.startswith("postgresql+psycopg://"):
    raise RuntimeError("Production requires DATABASE_URL for managed PostgreSQL.")
COOKIE_SECURE = PRODUCTION or os.getenv("COOKIE_SECURE", "false") == "true"
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3100,http://127.0.0.1:3100,http://localhost:3101,http://127.0.0.1:3101",
)
ALLOWED_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in ALLOWED_ORIGINS.split(",")
    if origin.strip()
]
SESSION_HOURS = int(os.getenv("SESSION_HOURS", "8"))
if PRODUCTION and not os.getenv("ALLOWED_ORIGINS"):
    raise RuntimeError("Set ALLOWED_ORIGINS to the HTTPS frontend URL in production.")
if PRODUCTION and any(not origin.startswith("https://") for origin in ALLOWED_ORIGINS):
    raise RuntimeError("Production ALLOWED_ORIGINS must contain HTTPS frontend URLs.")
