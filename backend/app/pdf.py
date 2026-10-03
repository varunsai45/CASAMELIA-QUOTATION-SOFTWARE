"""Selectable text PDF built from the immutable structured quotation snapshot."""

from io import BytesIO
import base64
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Table,
    TableStyle,
    Spacer,
    Image,
    KeepTogether,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from .config import DATA
from .calculations import indian, dec


def fonts():
    for normal, bold in [
        ("C:/Windows/Fonts/calibri.ttf", "C:/Windows/Fonts/calibrib.ttf"),
        (
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        ),
    ]:
        if Path(normal).exists():
            pdfmetrics.registerFont(TTFont("Casa", normal))
            pdfmetrics.registerFont(TTFont("CasaBold", bold))
            pdfmetrics.registerFontFamily(
                "Casa",
                normal="Casa",
                bold="CasaBold",
                italic="Casa",
                boldItalic="CasaBold",
            )
            return "Casa", "CasaBold"
    raise RuntimeError(
        "Install Calibri (Windows) or fonts-dejavu-core (Linux) for PDF generation."
    )


def generate_pdf(payload):
    font, bold = fonts()
    buf = BytesIO()
    width = A4[0] - 56
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=28,
        rightMargin=28,
        topMargin=28,
        bottomMargin=34,
        title=payload["number"] + " - CASAMELIA INTERNATIONAL",
        author="CASAMELIA INTERNATIONAL",
    )
    normal = ParagraphStyle("CasaNormal", fontName=font, fontSize=6.3, leading=8)
    strong = ParagraphStyle("CasaStrong", parent=normal, fontName=bold)
    termstyle = ParagraphStyle("CasaTerms", parent=normal, fontSize=6.3, leading=8)
    right = ParagraphStyle("CasaRight", parent=normal, alignment=2)

    def p(t, style=normal):
        return Paragraph(escape(str(t or "")).replace("\n", "<br/>"), style)

    def value(v):
        return indian(v, 2) if v is not None else ""

    company = payload["company_text"].splitlines()
    header_text = [
        p(company[0], ParagraphStyle("Brand", parent=strong, fontSize=8.5, leading=10))
    ] + [p(x) for x in company[1:]]
    logo_source = (
        BytesIO(base64.b64decode(payload["logo_base64"]))
        if payload.get("logo_base64")
        else str(DATA / "logo.png")
    )
    logo = Image(logo_source, width=90, height=55)
    header = Table([[header_text, logo]], colWidths=[width - 90, 90])
    header.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    header.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.4, colors.black)]))
    story = [header, Spacer(1, 1)]
    details = Table(
        [
            [
                p("CUSTOMER NAME", strong),
                p("ADDRESS", strong),
                p("Project Ref", strong),
                p("DATE", strong),
            ],
            [
                p(payload["customer_name"]),
                p(payload["address"]),
                p(payload["project_reference"]),
                p("-".join(reversed(payload["quote_date"].split("-")))),
            ],
        ],
        colWidths=[width * 0.29, width * 0.31, width * 0.23, width * 0.17],
    )
    details.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.4, colors.black),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story += [
        details,
        Spacer(1, 6),
        p(
            f'Quotation No. {payload["number"]}    Version {payload["revision"]}',
            strong,
        ),
        Spacer(1, 8),
    ]
    # Preserve H:P proportions, ensuring currency columns remain legible on A4.
    widths = [18, 90, width - 330, 28, 28, 32, 20, 49, 65]
    headerrow = [
        p(t, strong)
        for t in [
            "Sl no",
            "Items",
            "Description of Work",
            "Measurement in Ft",
            "",
            "Area in Sft",
            "Qty",
            "Rate in Rs.",
            "Amount in Rs.",
        ]
    ]
    serial = 0
    for section in payload["sections"]:
        rows = []
        for i in section["items"]:
            if i.get("amount") is None:
                continue
            serial += 1
            description = i["description"] or " + ".join(
                str(i["product"].get(k) or "")
                for k in ["carcass", "shutter", "finish"]
                if i["product"].get(k) not in [None, "-"]
            )
            if dec(i["other_amount"]) or dec(i["flat_charge"]):
                description += "\n" + i["other_description"]
                if dec(i["other_amount"]):
                    description += f' (rate addition: Rs. {value(i["other_amount"])})'
                if dec(i["flat_charge"]):
                    description += f' (one-time: Rs. {value(i["flat_charge"])})'
            mode = i["measurement_mode"]
            rows.append(
                [
                    p(serial),
                    p(i["item_label"] or i["product"]["item"]),
                    p(description),
                    p(
                        i["width"]
                        if mode == "area"
                        else ("Rft" if mode == "rft" else "Unit")
                    ),
                    p(i["length"] if mode == "area" else ""),
                    p(i["area"]),
                    p(i["quantity"]),
                    p(value(i["final_rate"]), right),
                    p(value(i["amount"]), right),
                ]
            )
        if not rows:
            continue
        sectionrow = [p(section["name"], strong)] + [""] * 8
        data = (
            [
                headerrow,
                ["", "", "", p("Width", strong), p("Length", strong), "", "", "", ""],
                sectionrow,
            ]
            + rows
            + [[p("TOTAL", strong)] + [""] * 7 + [p(value(section["total"]), right)]]
        )
        table = Table(
            data,
            colWidths=widths,
            repeatRows=3,
            hAlign="CENTER",
            splitInRow=0,
            rowSplitRange=(4, len(data) - 1),
        )
        table.setStyle(
            TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.black),
                    ("BACKGROUND", (0, 0), (-1, 1), colors.HexColor("#B8CCE4")),
                    ("BACKGROUND", (0, 2), (-1, 2), colors.HexColor("#E9E791")),
                    ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#D8E4BC")),
                    ("SPAN", (0, 2), (-1, 2)),
                    ("SPAN", (3, 0), (4, 0)),
                    *[("SPAN", (c, 0), (c, 1)) for c in [0, 1, 2, 5, 6, 7, 8]],
                    ("NOSPLIT", (0, 0), (-1, 2)),
                    ("SPAN", (0, -1), (-2, -1)),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("TOPPADDING", (0, 0), (-1, -1), 2),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                    ("LEFTPADDING", (0, 0), (-1, -1), 3),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ]
            )
        )
        # Keep short sections intact; large sections must begin in the remaining
        # space and continue with repeated headers instead of wasting a page.
        _, table_height = table.wrap(width, A4[1])
        story += [KeepTogether([table]) if table_height <= 300 else table, Spacer(1, 7)]
    totals = Table(
        [
            [p(label, strong), p("₹" + value(v), right)]
            for label, v in [
                ("SUB TOTAL", payload["subtotal"]),
                (f'GST {payload["gst_rate"]}%', payload["gst"]),
                ("TOTAL", payload["total"]),
            ]
        ],
        colWidths=[width - 100, 100],
    )
    totals.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.4, colors.black),
                ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#E9E791")),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#92D050")),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story += [
        KeepTogether([totals, Spacer(1, 8), p(payload["amount_in_words"], strong)]),
        Spacer(1, 14),
    ]
    # Each term may flow across a page, preserving exact source wording.
    terms_block = [p("No.    Terms & Conditions", strong), Spacer(1, 6)]
    for n, t in enumerate(payload["terms"], 1):
        terms_block += [p(f"{n}. " + t, termstyle), Spacer(1, 5)]
    story += [KeepTogether(terms_block)]
    signatures = Table(
        [[p("Customer's Signature", strong), p("Casamelia International", strong)]],
        colWidths=[width / 2, width / 2],
    )
    closing = [Spacer(1, 20), signatures]
    if payload.get("bank_details"):
        closing += [
            Spacer(1, 16),
            p("Bank Details:", strong),
            p(payload["bank_details"]),
        ]
    story += [KeepTogether(closing)]

    def footer(canvas, document):
        canvas.saveState()
        canvas.setFont(font, 7)
        canvas.setFillColor(colors.HexColor("#555555"))
        canvas.drawString(28, 18, payload["number"] + " · CASAMELIA INTERNATIONAL")
        canvas.drawRightString(A4[0] - 28, 18, "Page " + str(document.page))
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return buf.getvalue()
