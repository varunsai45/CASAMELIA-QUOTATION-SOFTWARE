"""Package source and workbook data without local databases or dependencies."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
target = root / "CASAMELIA-QUOTATION-SOFTWARE.zip"
excluded = {".venv", "node_modules", ".next", "__pycache__", ".pytest_cache", ".git", "tmp", "output", "test-results", "playwright-report"}
with ZipFile(target, "w", ZIP_DEFLATED) as archive:
    for path in root.rglob("*"):
        relative = path.relative_to(root)
        if not path.is_file() or any(part in excluded for part in relative.parts):
            continue
        if path == target or path.name == ".env" or path.suffix in {".pyc", ".tsbuildinfo"} or ".db" in path.name:
            continue
        archive.write(path, Path("casamelia-quotation") / relative)
print(f"Created {target} ({target.stat().st_size:,} bytes)")
