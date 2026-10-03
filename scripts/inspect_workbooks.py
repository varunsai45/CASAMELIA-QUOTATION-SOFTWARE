import json, zipfile, hashlib, sys
from pathlib import Path
from collections import Counter
import openpyxl

ROOT = Path(__file__).resolve().parents[1]
out = ROOT / "docs" / "workbook-audit"
out.mkdir(parents=True, exist_ok=True)
for filename in (sys.argv[1:] or ["Auto Qoutation File.xlsx", "Casemelia_Auto_Quotation_Automated.xlsx"]):
    path = Path.home() / "Downloads" / filename
    wb = openpyxl.load_workbook(path, data_only=False)
    cached = openpyxl.load_workbook(path, data_only=True)
    result = {
        "file": filename,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "defined_names": str(wb.defined_names),
        "sheets": [],
    }
    for ws in wb:
        cells = []
        for row in ws:
            for c in row:
                if c.value is not None:
                    cells.append(
                        {
                            "cell": c.coordinate,
                            "value": str(c.value) if c.data_type == "f" else c.value,
                            "cached": cached[ws.title][c.coordinate].value,
                            "type": c.data_type,
                            "style": c.style_id,
                            "format": c.number_format,
                        }
                    )
        result["sheets"].append(
            {
                "name": ws.title,
                "state": ws.sheet_state,
                "dimensions": ws.calculate_dimension(),
                "print_area": str(ws.print_area),
                "print_titles": [ws.print_title_rows, ws.print_title_cols],
                "page_setup": str(ws.page_setup),
                "margins": str(ws.page_margins),
                "header_footer": str(ws.HeaderFooter),
                "row_breaks": str(ws.row_breaks),
                "col_breaks": str(ws.col_breaks),
                "merges": [str(m) for m in ws.merged_cells],
                "columns": {k: dict(v) for k, v in ws.column_dimensions.items()},
                "rows": {k: dict(v) for k, v in ws.row_dimensions.items()},
                "validations": [str(d) for d in ws.data_validations.dataValidation],
                "images": [
                    {
                        "width": i.width,
                        "height": i.height,
                        "anchor": {
                            "type": type(i.anchor).__name__,
                            "from": (
                                vars(i.anchor._from)
                                if hasattr(i.anchor, "_from")
                                else None
                            ),
                            "to": (
                                vars(i.anchor.to) if hasattr(i.anchor, "to") else None
                            ),
                        },
                    }
                    for i in ws._images
                ],
                "cells": cells,
            }
        )
        lines = ["%s: %s" % (x["cell"], x["value"]) for x in cells]
        (out / (path.stem + "--" + ws.title + ".txt")).write_text(
            "\n".join(lines), encoding="utf-8"
        )
        print(
            filename,
            ws.title,
            ws.sheet_state,
            ws.calculate_dimension(),
            "formulas",
            sum(c["type"] == "f" for c in cells),
            "images",
            len(ws._images),
        )
    result["styles"] = [
        {
            "id": idx,
            "font": str(wb._fonts[s.fontId]),
            "fill": str(wb._fills[s.fillId]),
            "border": str(wb._borders[s.borderId]),
            "alignment": str(wb._alignments[s.alignmentId]),
        }
        for idx, s in enumerate(wb._cell_styles)
    ]
    (out / (path.stem + ".json")).write_text(
        json.dumps(result, indent=2, default=str, ensure_ascii=False), encoding="utf-8"
    )
    with zipfile.ZipFile(path) as z:
        for name in z.namelist():
            if name.startswith("xl/media/"):
                dest = out / path.stem / Path(name).name
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_bytes(z.read(name))
