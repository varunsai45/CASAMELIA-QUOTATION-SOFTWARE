from decimal import Decimal, ROUND_HALF_UP
from fastapi import HTTPException
from .models import MasterProduct, Setting, Area, AreaProduct


def dec(v):
    return Decimal(str(v or 0))


def money(v):
    return dec(v).quantize(Decimal(".01"), rounding=ROUND_HALF_UP)


def indian(v, places=2):
    s = f"{dec(v):.{places}f}"
    whole, _, fraction = s.partition(".")
    tail = whole[-3:]
    head = whole[:-3]
    groups = []
    while head:
        groups.insert(0, head[-2:])
        head = head[:-2]
    return ",".join(groups + [tail]) + ("." + fraction if places else "")


def words(n):
    n = int(n)
    ones = [
        "Zero",
        "One",
        "Two",
        "Three",
        "Four",
        "Five",
        "Six",
        "Seven",
        "Eight",
        "Nine",
        "Ten",
        "Eleven",
        "Twelve",
        "Thirteen",
        "Fourteen",
        "Fifteen",
        "Sixteen",
        "Seventeen",
        "Eighteen",
        "Nineteen",
    ]
    tens = [
        "",
        "",
        "Twenty",
        "Thirty",
        "Forty",
        "Fifty",
        "Sixty",
        "Seventy",
        "Eighty",
        "Ninety",
    ]
    if n < 20:
        return ones[n]
    if n < 100:
        return tens[n // 10] + (" " + ones[n % 10] if n % 10 else "")
    for size, label in [
        (10000000, "Crore"),
        (100000, "Lakh"),
        (1000, "Thousand"),
        (100, "Hundred"),
    ]:
        if n >= size:
            return (
                words(n // size)
                + " "
                + label
                + (" " + words(n % size) if n % size else "")
            )


def amount_words(value):
    value = money(value)
    rupees = int(value)
    paise = int((value - rupees) * 100)
    return (
        words(rupees)
        + " Rupees"
        + (" and " + words(paise) + " Paise" if paise else "")
        + " Only"
    )


def calculate(db, input_data, strict=False, previous=None, actor=None):
    data = input_data.model_dump(mode="json")
    old = {
        i["key"]: i for s in (previous or {}).get("sections", []) for i in s["items"]
    }
    keys = [i["key"] for s in data["sections"] for i in s["items"]]
    if len(keys) != len(set(keys)):
        raise HTTPException(422, "Each line must have a unique identifier.")
    gst = dec(
        (previous or {}).get("gst_rate", db.get(Setting, "gst_rate").value["rate"])
    )
    issues = []
    subtotal = Decimal(0)
    valid = 0
    for si, s in enumerate(data["sections"]):
        section_total = Decimal(0)
        area_record = db.get(Area, s.get("area_id")) if s.get("area_id") else None
        if s.get("area_id") and (not area_record or not area_record.active):
            issues.append(f"Section {si+1}: select an active area.")
        if (
            strict
            and any(
                i["product_id"] or i["item_label"] or i["description"]
                for i in s["items"]
            )
            and not s["name"]
        ):
            issues.append(f"Section {si+1}: enter an area name.")
        for ii, i in enumerate(s["items"]):
            i["rate"] = None
            i["amount"] = None
            i["area"] = None
            i["product"] = None
            i["issue"] = None
            if (
                not i["product_id"]
                and not i["description"]
                and not i["item_label"]
                and all(
                    i[k] is None for k in ["width", "length", "quantity", "manual_area"]
                )
                and not dec(i["other_amount"])
                and not dec(i["flat_charge"])
            ):
                i["empty"] = True
                continue
            p = db.get(MasterProduct, i["product_id"]) if i["product_id"] else None
            prior = old.get(i["key"])
            snapshot = (
                prior
                and prior.get("product_id") == i["product_id"]
                and prior.get("rate") is not None
                and prior.get("product")
            )
            if snapshot:
                i["product"] = prior["product"]
                i["rate"] = prior["rate"]
                i["master_rate"] = prior.get("master_rate", prior["rate"])
            elif p:
                i["product"] = {
                    k: getattr(p, k)
                    for k in [
                        "item",
                        "carcass",
                        "shutter",
                        "finish",
                        "specification",
                        "unit",
                        "source_sheet",
                        "source_row",
                    ]
                }
                if not p.active:
                    i["issue"] = (
                        "This combination is inactive. Select an active product."
                    )
                elif p.needs_review:
                    i["issue"] = "This price conflict must be resolved by Admin."
                elif p.price is None and i["quotation_rate"] is None:
                    i["issue"] = (
                        "On Request: enter a quotation-specific rate and reason."
                    )
                else:
                    i["rate"] = str(p.price) if p.price is not None else None
                i["master_rate"] = str(p.price) if p.price is not None else None
                if area_record and not db.get(AreaProduct, (area_record.id, p.id)):
                    i["issue"] = "This product is not assigned to the selected area."
            elif i["custom"]:
                i["master_rate"] = None
                i["product"] = {
                    "item": i["item_label"],
                    "carcass": i["custom_material"] or "-",
                    "shutter": "-",
                    "finish": i["custom_finish"] or "-",
                    "specification": i["description"],
                    "unit": i["unit"],
                }
                if (
                    not i["item_label"]
                    or not i["description"]
                    or i["quotation_rate"] is None
                ):
                    i["issue"] = (
                        "Custom item requires a name, specification and quotation rate."
                    )
            else:
                i["issue"] = "Please select a valid product combination."
            master = i.get("master_rate", i.get("rate"))
            project = i["quotation_rate"] if i["quotation_rate"] is not None else master
            hardware_values = [
                i["hardware_amount"],
                i["hardware_area"],
                i["carcass_rate"],
            ]
            if any(x is not None for x in hardware_values):
                if not all(x is not None for x in hardware_values):
                    i["issue"] = (
                        "Enter hardware amount, square feet divisor and carcass rate together."
                    )
                else:
                    project = str(
                        dec(i["carcass_rate"])
                        + dec(i["hardware_amount"]) / dec(i["hardware_area"])
                    )
            i["quotation_rate"] = str(project) if project is not None else None
            i["rate_override"] = project is not None and (
                master is None or dec(project) != dec(master)
            )
            i["override_reason"] = (i["override_reason"] or "").strip() or None
            if not i["rate_override"]:
                i["override_reason"] = None
            if i["rate_override"] and not i["override_reason"]:
                i["issue"] = "Enter a reason for the quotation rate override."
            if project is None:
                i["issue"] = i["issue"] or "Enter a valid quotation rate."
            changed = (
                not prior
                or prior.get("quotation_rate", prior.get("rate")) != i["quotation_rate"]
                or prior.get("override_reason", "") != i["override_reason"]
            )
            i["rate_changed_by"] = (
                actor.id
                if actor and changed and i["rate_override"]
                else (prior or {}).get("rate_changed_by")
            )
            from .models import now

            i["rate_changed_at"] = (
                now().isoformat()
                if actor and changed and i["rate_override"]
                else (prior or {}).get("rate_changed_at")
            )
            if not i["rate_override"]:
                i["rate_changed_by"] = None
                i["rate_changed_at"] = None
            i["rate"] = str(project) if project is not None else None
            if i["measurement_mode"] == "area":
                if i["width"] is not None and i["length"] is not None:
                    i["area"] = str(dec(i["width"]) * dec(i["length"]))
            elif i["measurement_mode"] == "rft":
                i["area"] = i["manual_area"]
            else:
                i["area"] = "1"
            if i["area"] is None or dec(i["area"]) <= 0:
                i["issue"] = i["issue"] or "Enter positive measurements."
            if i["measurement_mode"] == "fixed":
                i["quantity"] = "1"
            if i["quantity"] is None or dec(i["quantity"]) <= 0:
                i["issue"] = i["issue"] or "Enter a positive quantity."
            if (dec(i["other_amount"]) or dec(i["flat_charge"])) and not i[
                "other_description"
            ]:
                i["issue"] = i["issue"] or "Describe the additional charge."
            if i["issue"]:
                issues.append(
                    f'{s["name"] or "Section "+str(si+1)}, line {ii+1}: {i["issue"]}'
                )
                continue
            i["final_rate"] = str(dec(i["rate"]) + dec(i["other_amount"]))
            # Original workbook: P = M*N*O; O31 = E31+G31; P56 adds 4000 once.
            i["amount"] = str(
                money(
                    dec(i["area"]) * dec(i["quantity"]) * dec(i["final_rate"])
                    + dec(i["flat_charge"])
                )
            )
            section_total += dec(i["amount"])
            valid += 1
        s["total"] = str(money(section_total))
        subtotal += section_total
    if strict:
        for k, label in [
            ("customer_name", "customer name"),
            ("address", "address"),
            ("project_reference", "project reference"),
        ]:
            if not data[k]:
                issues.append("Enter " + label + ".")
        if not valid:
            issues.append("Add at least one complete quotation line.")
        if issues:
            raise HTTPException(
                422,
                {
                    "message": "Complete the quotation before generating.",
                    "issues": issues,
                },
            )
    tax = money(subtotal * gst / 100)
    total = money(subtotal + tax)
    if total > Decimal("999999999999.99"):
        raise HTTPException(422, "Quotation total exceeds the supported limit.")
    data.update(
        subtotal=str(money(subtotal)),
        gst_rate=str(gst),
        gst=str(tax),
        total=str(total),
        amount_in_words=amount_words(total),
        issues=issues,
    )
    return data
