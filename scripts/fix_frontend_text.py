from pathlib import Path

root = Path(__file__).resolve().parents[1] / "frontend"
for file in root.rglob("*.tsx"):
    if "node_modules" in file.parts or ".next" in file.parts:
        continue
    text = file.read_text(encoding="utf8")
    if "Â" in text or "â€" in text:
        try:
            text = text.encode("cp1252").decode("utf8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            pass
    text = text.replace(" required autoFocus", " required")
    text = text.replace("/${id}/pdf`}", "/${id}/pdf?inline=true`}")
    file.write_text(text, encoding="utf8")
