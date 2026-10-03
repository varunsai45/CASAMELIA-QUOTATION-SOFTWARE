import argparse
from .db import engine, SessionLocal
from .models import Base
from sqlalchemy import inspect
from alembic import command
from alembic.config import Config
from pathlib import Path
from .seed import seed

parser = argparse.ArgumentParser(
    description="Initialize Casamelia database and import original workbook data."
)
parser.add_argument("command", choices=["init", "import"])
args = parser.parse_args()
config = Config(str(Path(__file__).resolve().parents[2] / "alembic.ini"))
tables = inspect(engine).get_table_names()
if "users" in tables and "alembic_version" not in tables:
    command.stamp(config, "29c9874f4150")
command.upgrade(config, "head")
with SessionLocal() as db:
    seed(db, users=args.command == "init", source=True)
    from .current_import import import_current

    import_current(db)
print(
    "Database initialized. October source imported; original records and quotations are preserved."
)
