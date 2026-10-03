"""Editable workbook exported solely from the saved quotation snapshot."""

from io import BytesIO
import base64
from datetime import date
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Border, Side, Alignment
from openpyxl.drawing.image import Image
from openpyxl.utils import get_column_letter
from openpyxl.workbook.properties import CalcProperties

MONEY = '"₹" #,##0.00'


def generate_excel(payload):
    w = Workbook()
    s = w.active
    s.title = "Quotation"
    w.calculation = CalcProperties(calcId=191029, fullCalcOnLoad=True)
    widths = [6, 24, 48, 10, 10, 12, 9, 14, 14, 14, 14, 14, 14, 14]
    for col, width in enumerate(widths, 1):
        s.column_dimensions[get_column_letter(col)].width = width
    s.sheet_view.showGridLines = False
    s.merge_cells("A1:L1")
    s["A1"] = payload["company_text"].splitlines()[0]
    s["A1"].font = Font(name="Calibri", size=14, bold=True)
    s.merge_cells("A2:L7")
    s["A2"] = "\n".join(payload["company_text"].splitlines()[1:])
    s["A2"].alignment = Alignment(wrap_text=True, vertical="top")
    if payload.get("logo_base64"):
        logo = Image(BytesIO(base64.b64decode(payload["logo_base64"])))
        logo.width = 120
        logo.height = 90
        s.add_image(logo, "M1")
    s.append([])
    for r, vals in [
        (9, ["CUSTOMER NAME", payload["customer_name"], "ADDRESS", payload["address"]]),
        (
            10,
            [
                "PROJECT REF",
                payload["project_reference"],
                "DATE",
                date.fromisoformat(payload["quote_date"]),
            ],
        ),
        (11, ["QUOTATION NO", payload["number"], "VERSION", payload["revision"]]),
        (12, ["PHONE", payload.get("phone", ""), "EMAIL", payload.get("email", "")]),
    ]:
        s.merge_cells(start_row=r, start_column=1, end_row=r, end_column=2)
        s.cell(r, 1, vals[0])
        s.merge_cells(start_row=r, start_column=3, end_row=r, end_column=6)
        s.cell(r, 3, vals[1])
        s.merge_cells(start_row=r, start_column=7, end_row=r, end_column=8)
        s.cell(r, 7, vals[2])
        s.merge_cells(start_row=r, start_column=9, end_row=r, end_column=14)
        s.cell(r, 9, vals[3])
        s.cell(r, 9).number_format = "dd-mm-yyyy" if r == 10 else "General"
        s.row_dimensions[r].height = 30
    headings = [
        "Sl No",
        "Item",
        "Description of Work",
        "Width",
        "Length",
        "Area / Rft",
        "Qty",
        "Master Rate",
        "Quotation Rate",
        "Other per unit",
        "One-time Other",
        "Final Rate",
        "Amount",
        "Calculation",
    ]
    r = 14
    for c, v in enumerate(headings, 1):
        s.cell(r, c, v)
    totals = []
    serial = 0
    formula_cells = set()
    for section in payload["sections"]:
        valid = [i for i in section["items"] if i.get("amount") is not None]
        if not valid:
            continue
        r += 1
        s.merge_cells(start_row=r, start_column=1, end_row=r, end_column=14)
        s.cell(r, 1, section["name"])
        sectionrow = r
        start = r + 1
        for i in valid:
            r += 1
            serial += 1
            num = lambda k: float(i[k]) if i.get(k) is not None else None
            desc = i["description"]
            if i.get("other_description"):
                desc += "\n" + i["other_description"]
            if i.get("rate_override"):
                desc += "\nRate override: " + i["override_reason"]
            values = [
                serial,
                i["item_label"] or i["product"]["item"],
                desc,
                num("width"),
                num("length"),
                None,
                num("quantity"),
                num("master_rate") if "master_rate" in i else num("rate"),
                num("quotation_rate") if "quotation_rate" in i else num("rate"),
                num("other_amount"),
                num("flat_charge"),
                None,
                None,
                i["measurement_mode"],
            ]
            for c, v in enumerate(values, 1):
                s.cell(r, c, v)
            s.cell(
                r,
                6,
                (
                    f"=D{r}*E{r}"
                    if i["measurement_mode"] == "area"
                    else (num("manual_area") if i["measurement_mode"] == "rft" else 1)
                ),
            )
            s.cell(r, 12, f"=I{r}+J{r}")
            s.cell(r, 13, f"=ROUND(F{r}*G{r}*L{r}+K{r},2)")
            formula_cells.update([f"F{r}", f"L{r}", f"M{r}"])
            s.row_dimensions[r].height = max(30, 15 * (1 + len(desc) // 70))
        r += 1
        s.merge_cells(start_row=r, start_column=1, end_row=r, end_column=12)
        s.cell(r, 1, "TOTAL")
        s.cell(r, 13, f"=SUM(M{start}:M{r-1})")
        totals.append(r)
        formula_cells.add(f"M{r}")
        for c in s[sectionrow]:
            c.fill = PatternFill("solid", fgColor="E9E791")
            c.font = Font(name="Calibri", size=10, bold=True)
        for c in s[r]:
            c.fill = PatternFill("solid", fgColor="D8E4BC")
    r += 2
    sub = r
    s.merge_cells(start_row=r, start_column=1, end_row=r, end_column=12)
    s.cell(r, 1, "SUB TOTAL")
    s.cell(r, 13, "=" + "+".join(f"M{x}" for x in totals))
    r += 1
    gstrow = r
    s.merge_cells(start_row=r, start_column=1, end_row=r, end_column=11)
    s.cell(r, 1, "GST")
    s.cell(r, 12, float(payload["gst_rate"]) / 100)
    s.cell(r, 12).number_format = "0%"
    s.cell(r, 13, f"=ROUND(M{sub}*L{r},2)")
    r += 1
    s.merge_cells(start_row=r, start_column=1, end_row=r, end_column=12)
    s.cell(r, 1, "TOTAL")
    s.cell(r, 13, f"=M{sub}+M{gstrow}")
    formula_cells.update([f"M{sub}", f"M{gstrow}", f"M{r}"])
    for rr in range(sub, r + 1):
        for c in s[rr]:
            c.fill = PatternFill("solid", fgColor="92D050" if rr == r else "E9E791")
    r += 2
    s.merge_cells(start_row=r, start_column=1, end_row=r, end_column=14)
    s.cell(r, 1, payload["amount_in_words"])
    s.row_dimensions[r].height = 30
    r += 2
    s.merge_cells(start_row=r, start_column=1, end_row=r, end_column=14)
    s.cell(r, 1, "Terms & Conditions")
    for n, term in enumerate(payload["terms"], 1):
        r += 1
        s.cell(r, 1, n)
        s.merge_cells(start_row=r, start_column=2, end_row=r, end_column=14)
        s.cell(r, 2, term)
        s.row_dimensions[r].height = 15 * (1 + len(term) // 145)
    r += 3
    s.merge_cells(start_row=r, start_column=2, end_row=r, end_column=5)
    s.cell(r, 2, "Customer's Signature")
    s.merge_cells(start_row=r, start_column=10, end_row=r, end_column=14)
    s.cell(r, 10, "Casamelia International")
    if payload.get("bank_details"):
        r += 3
        s.merge_cells(start_row=r, start_column=1, end_row=r, end_column=14)
        s.cell(r, 1, "Bank Details:")
        r += 1
        s.merge_cells(start_row=r, start_column=1, end_row=r, end_column=14)
        s.cell(r, 1, payload["bank_details"])
        s.row_dimensions[r].height = 15 * len(payload["bank_details"].splitlines())
    thin = Side(style="thin", color="555555")
    for row in s.iter_rows(min_row=9, max_row=r, max_col=14):
        for c in row:
            c.alignment = Alignment(
                vertical="top",
                wrap_text=True,
                horizontal="right" if 4 <= c.column <= 13 and c.row >= 15 else "left",
            )
            if c.font.name is None:
                c.font = Font(name="Calibri", size=10)
            if totals and 14 <= c.row <= totals[-1]:
                c.border = Border(left=thin, right=thin, top=thin, bottom=thin)
            if c.data_type == "f" and c.coordinate not in formula_cells:
                c.data_type = "s"
            if 8 <= c.column <= 13 and c.row >= 15:
                c.number_format = MONEY
    s.cell(gstrow, 12).number_format = "0%"
    for c in s[14]:
        c.fill = PatternFill("solid", fgColor="B8CCE4")
        c.font = Font(name="Calibri", size=10, bold=True)
    s.row_dimensions[14].height = 30
    s.freeze_panes = "D15"
    s.print_title_rows = "14:14"
    s.print_area = f"A1:N{r}"
    s.page_setup.orientation = "landscape"
    s.page_setup.paperSize = s.PAPERSIZE_A4
    s.page_setup.fitToWidth = 1
    s.page_setup.fitToHeight = 0
    s.sheet_properties.pageSetUpPr.fitToPage = True
    s.oddFooter.center.text = payload["number"] + " - Page &P of &N"
    # Immutable source values, including who approved overrides, are retained
    # beside the editable formula sheet for traceability.
    snap = w.create_sheet("Saved Snapshot")
    snap.append(["Quotation", "Version", "Generated At", "Generated By"])
    snap.append(
        [
            payload["number"],
            payload["revision"],
            payload.get("generated_at", ""),
            payload.get("generated_by", ""),
        ]
    )
    snap.append(
        [
            "Area",
            "Item",
            "Master Rate",
            "Quotation Rate",
            "Override",
            "Reason",
            "Changed By",
            "Changed At",
            "Saved Amount",
        ]
    )
    for sec in payload["sections"]:
        for i in sec["items"]:
            if i.get("amount") is not None:
                snap.append(
                    [
                        sec["name"],
                        i["item_label"],
                        i.get("master_rate"),
                        i.get("quotation_rate", i["rate"]),
                        i.get("rate_override", False),
                        i.get("override_reason", ""),
                        i.get("rate_changed_by"),
                        i.get("rate_changed_at"),
                        i["amount"],
                    ]
                )
    snap.append(["Subtotal", payload["subtotal"]])
    snap.append(["GST", payload["gst"]])
    snap.append(["Total", payload["total"]])
    for c in range(1, 10):
        snap.column_dimensions[get_column_letter(c)].width = 24
    for row in snap:
        for c in row:
            if c.data_type == "f":
                c.data_type = "s"
    out = BytesIO()
    w.save(out)
    return out.getvalue()
