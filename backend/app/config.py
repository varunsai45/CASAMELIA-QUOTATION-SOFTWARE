import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
DATABASE_URL = os.getenv(
    "DATABASE_URL", f'sqlite:///{(DATA / "casamelia.db").as_posix()}'
)
PRODUCTION = os.getenv("APP_ENV", "development") == "production"
COOKIE_SECURE = PRODUCTION or os.getenv("COOKIE_SECURE", "false") == "true"
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3100,http://127.0.0.1:3100,http://localhost:3101,http://127.0.0.1:3101",
).split(",")
SESSION_HOURS = int(os.getenv("SESSION_HOURS", "8"))
