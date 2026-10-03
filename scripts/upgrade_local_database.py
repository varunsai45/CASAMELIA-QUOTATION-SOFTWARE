"""Back up the local SQLite database and verify document hashes after migration."""

from datetime import datetime
from pathlib import Path
import hashlib
import sqlite3
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
database = root / "backend/data/casamelia.db"
backup_dir = root / "tmp/database-backups"
backup_dir.mkdir(parents=True, exist_ok=True)


def documents(connection):
    return [
        (row[0], hashlib.sha256(row[1]).hexdigest())
        for row in connection.execute("SELECT id, pdf FROM quotation_versions")
    ]


with sqlite3.connect(database) as source:
    before = documents(source)
    target = backup_dir / f"casamelia-before-october-{datetime.now():%Y%m%d-%H%M%S}.db"
    with sqlite3.connect(target) as destination:
        source.backup(destination)
print("Backup:", target)
subprocess.run([sys.executable, "-m", "backend.app.cli", "init"], cwd=root, check=True)
with sqlite3.connect(database) as upgraded:
    assert documents(upgraded) == before, "Saved documents changed during migration"
    print("Preserved saved document hashes:", len(before))
    print(
        "Active products:",
        upgraded.execute(
            "SELECT COUNT(*) FROM master_products WHERE active=1"
        ).fetchone()[0],
    )
    print(
        "Current unresolved conflicts:",
        upgraded.execute(
            "SELECT COUNT(*) FROM price_conflicts c JOIN master_products p ON p.id=c.product_id WHERE p.active=1 AND c.status='unresolved'"
        ).fetchone()[0],
    )
