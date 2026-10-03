"""Idempotent October catalogue upgrade; no quotations or source prices deleted."""

import base64, json
from decimal import Decimal
from sqlalchemy import select
from .models import (
    MasterProduct,
    Area,
    AreaProduct,
    SourcePrice,
    PriceConflict,
    Setting,
    SettingVersion,
    MasterPriceHistory,
    ImportBatch,
    AuditLog,
)
from .config import DATA


def import_current(db):
    if db.get(Setting, "october_import"):
        return
    data = json.loads((DATA / "current-source.json").read_text(encoding="utf8"))
    # Keep old product IDs and documents intact for prior quotation snapshots.
    for p in db.scalars(
        select(MasterProduct).where(MasterProduct.catalogue == "legacy")
    ):
        p.active = False
    areas = {}
    for pos, name in enumerate(data["areas"]):
        name = name.strip()
        a = db.scalar(select(Area).where(Area.name == name)) or Area(
            name=name, position=pos, source_sheet=name
        )
        db.add(a)
        db.flush()
        areas[name] = a
    for raw in data["products"]:
        first = next(r for r in raw["sources"] if r["source_sheet"] != "MasterFlat")
        p = MasterProduct(
            item=raw["item"],
            carcass=raw["carcass"],
            shutter=raw["shutter"],
            finish=raw["finish"],
            specification=raw["specification"],
            category=raw["item"],
            unit=raw["unit"],
            measurement_mode=raw["measurement_mode"],
            combination_key="october|" + raw["key"],
            price=raw["price"],
            needs_review=bool(raw["conflict"]),
            source_row=first["source_row"],
            source_sheet=first["source_sheet"],
            source_data=raw,
            catalogue="october",
            hardware=first.get("hardware") or 0,
            pricing_area=first.get("pricing_area") or 0,
        )
        db.add(p)
        db.flush()
        for name in raw["areas"]:
            db.add(AreaProduct(area_id=areas[name].id, product_id=p.id))
        for r in raw["sources"]:
            db.add(
                SourcePrice(
                    product_id=p.id,
                    source_file=data["source_file"],
                    source_sheet=r["source_sheet"],
                    source_row=r["source_row"],
                    price=r.get("price"),
                    raw=r,
                )
            )
        if raw["conflict"]:
            visible = next(
                r["price"] for r in raw["sources"] if r["source_sheet"] == "Master List"
            )
            hidden = next(
                r["price"] for r in raw["sources"] if r["source_sheet"] == "MasterFlat"
            )
            db.add(
                PriceConflict(
                    product_id=p.id,
                    item=p.item,
                    carcass=p.carcass,
                    shutter=p.shutter,
                    finish=p.finish,
                    visible_price=visible,
                    lookup_price=hidden,
                )
            )
        db.add(
            MasterPriceHistory(
                product_id=p.id,
                old_price=None,
                new_price=p.price,
                reason="October source import",
            )
        )
    for name in [
        "Main Doors",
        "Bed Room Doors",
        "Toilet Doors",
        "Balcony/Sliding Doors",
    ]:
        p = MasterProduct(
            item=name,
            carcass="-",
            shutter="-",
            finish="-",
            specification=name,
            category="Doors",
            unit="Nos",
            measurement_mode="unit",
            combination_key="october|doors|" + name.casefold(),
            price=None,
            source_sheet="Doors",
            catalogue="october",
            source_data={
                "instruction": "keep it empty as of now with the given line items"
            },
        )
        db.add(p)
        db.flush()
        db.add(AreaProduct(area_id=areas["Doors"].id, product_id=p.id))
    # Retain any hidden lookup record not matched to a visible specification.
    linked = {(r.source_sheet, r.source_row) for r in db.scalars(select(SourcePrice))}
    for r in data["hidden_lookup"]:
        if ("MasterFlat", r["source_row"]) not in linked:
            db.add(
                SourcePrice(
                    source_file=data["source_file"],
                    source_sheet="MasterFlat",
                    source_row=r["source_row"],
                    price=r["price"],
                    raw=r,
                )
            )
    company = db.get(Setting, "company")
    company.value = {
        **company.value,
        "bank_details": company.value.get("bank_details", ""),
        "logo_base64": company.value.get(
            "logo_base64", base64.b64encode((DATA / "logo.png").read_bytes()).decode()
        ),
    }
    db.add(SettingVersion(key="company", value=company.value))
    terms = db.get(Setting, "terms")
    complete = list(terms.value["terms"])
    # User explicitly approved the earlier complete text and this PDF term.
    complete[7] = (
        "All modular components manufactured at the factory carry a lifetime warranty, and non-modular components carry a 10-year warranty, subject to site wear and tear conditions."
    )
    terms.value = {"terms": complete}
    db.add(SettingVersion(key="terms", value=terms.value))
    db.add(Setting(key="numbering", value={"prefix": "CASA"}))
    db.add(Setting(key="october_import", value=data["report"]))
    db.add(Setting(key="source_instructions", value={"text": data["instructions"]}))
    section_names = db.get(Setting, "section_names")
    section_names.value = {
        "names": list(
            dict.fromkeys(
                [a.name for a in areas.values()] + section_names.value["names"]
            )
        )
    }
    db.add(
        ImportBatch(
            filename=data["source_file"],
            sha256=data["sha256"],
            status="applied",
            report=data["report"],
            data=data,
            source_file=(DATA / data["source_file"]).read_bytes(),
        )
    )
    db.add(
        AuditLog(
            action="october_catalogue_import",
            entity="master-list",
            after=data["report"],
        )
    )
    db.add(
        AuditLog(
            action="approved_terms_update",
            entity="terms",
            after={
                "terms": complete,
                "authorization": "User approved complete earlier wording with lifetime warranty term",
            },
        )
    )
    db.commit()
