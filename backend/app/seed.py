import json, os, uuid
from datetime import date
from decimal import Decimal
from sqlalchemy import select
from .config import DATA, PRODUCTION
from .models import User, MasterProduct, PriceConflict, Setting, Customer, Quotation
from .security import hash_password
from .schemas import QuotationInput
from .calculations import calculate


def seed(db, users=False, source=True):
    if users and not db.scalar(select(User).limit(1)):
        if PRODUCTION and (
            not os.getenv("ADMIN_PASSWORD") or not os.getenv("SALES_PASSWORD")
        ):
            raise RuntimeError(
                "Set ADMIN_PASSWORD and SALES_PASSWORD to initialize production users."
            )
        for username, role, password in [
            ("admin", "admin", os.getenv("ADMIN_PASSWORD", "admin123")),
            ("sales", "sales", os.getenv("SALES_PASSWORD", "sales123")),
        ]:
            if PRODUCTION and (
                password in ["admin123", "sales123"] or len(password) < 12
            ):
                raise RuntimeError(
                    "Production seed passwords must be unique and at least 12 characters."
                )
            db.add(
                User(
                    username=username, role=role, password_hash=hash_password(password)
                )
            )
        db.flush()
    if not source or db.get(Setting, "source_import"):
        return
    data = json.loads((DATA / "source.json").read_text(encoding="utf8"))
    if data["report"]["duplicates"]:
        raise RuntimeError("Duplicate combinations require review before import.")
    conflict_rows = {
        x["row"]: x
        for x in data["report"]["issues"]
        if x.get("reason") == "Master List / MasterFlat price conflict"
    }
    by_row = {}
    for p in data["products"]:
        fields = {
            k: p[k]
            for k in [
                "item",
                "carcass",
                "shutter",
                "finish",
                "price",
                "other",
                "hardware",
                "pricing_area",
                "source_row",
            ]
        }
        conflict = conflict_rows.get(p["source_row"])
        if conflict:
            fields["price"] = None
        obj = MasterProduct(
            **fields,
            combination_key="|".join(
                p[k] for k in ["item", "carcass", "shutter", "finish"]
            ).casefold(),
            needs_review=bool(conflict),
            source_data=p
        )
        db.add(obj)
        db.flush()
        by_row[p["source_row"]] = obj.id
        if conflict:
            db.add(
                PriceConflict(
                    product_id=obj.id,
                    **{k: p[k] for k in ["item", "carcass", "shutter", "finish"]},
                    visible_price=Decimal(conflict["master"]),
                    lookup_price=Decimal(str(conflict["flat"]))
                )
            )
    for k, v in [
        ("gst_rate", {"rate": "18"}),
        ("terms", {"terms": data["terms"]}),
        ("company", {"text": data["company_text"]}),
        ("source_import", data["report"]),
        (
            "section_names",
            {
                "names": list(
                    dict.fromkeys(
                        data["section_names"] + data["additional_section_names"]
                    )
                )
            },
        ),
    ]:
        db.add(Setting(key=k, value=v))
    db.flush()
    admin = db.scalar(select(User).where(User.role == "admin"))
    if admin:
        raw = data["quotation"]
        customer = Customer(
            name=raw["customer_name"],
            address=raw["address"],
            project_reference=raw["project_reference"],
            created_by=admin.id,
        )
        db.add(customer)
        db.flush()
        sections = []
        for s in raw["sections"]:
            items = []
            for row in s["items"]:
                d = {
                    k: row[k]
                    for k in [
                        "item_label",
                        "description",
                        "width",
                        "length",
                        "quantity",
                        "measurement_mode",
                        "manual_area",
                        "other_description",
                        "other_amount",
                        "flat_charge",
                    ]
                }
                if d["flat_charge"] != "0" and not d["other_description"]:
                    d["other_description"] = (
                        "Additional charge from original workbook P56"
                    )
                d.update(
                    key=str(uuid.uuid4()),
                    product_id=by_row.get(row["product_source_row"]),
                )
                items.append(d)
            sections.append({"name": s["name"], "items": items})
        payload = calculate(
            db,
            QuotationInput(
                customer_id=customer.id,
                customer_name=customer.name,
                address=customer.address,
                project_reference=customer.project_reference,
                quote_date=date.today(),
                sections=sections,
            ),
        )
        payload.update(
            terms=data["terms"],
            company_text=data["company_text"],
            source_import=True,
            number="IMPORT-EXCEL-001",
            revision=1,
        )
        q = Quotation(
            number="IMPORT-EXCEL-001",
            created_by=admin.id,
            customer_id=customer.id,
            customer_name=customer.name,
            project_reference=customer.project_reference,
            quote_date=date.today().isoformat(),
            total=Decimal(payload["total"]),
            payload=payload,
        )
        db.add(q)
        db.flush()
        from .quotation_service import save_structure

        save_structure(db, q, payload)
    db.commit()
