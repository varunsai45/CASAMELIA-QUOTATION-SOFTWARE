from datetime import date
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import select, delete, update
from .models import (
    Counter,
    Quotation,
    QuotationSection,
    QuotationItem,
    QuotationTerm,
    Setting,
    now,
    AuditLog,
)
from .calculations import calculate


def next_number(db):
    year = date.today().year
    if db.bind.dialect.name == "postgresql":
        from sqlalchemy.dialects.postgresql import insert
    else:
        from sqlalchemy.dialects.sqlite import insert
    stmt = (
        insert(Counter)
        .values(year=year, value=1)
        .on_conflict_do_update(
            index_elements=["year"], set_={"value": Counter.value + 1}
        )
        .returning(Counter.value)
    )
    n = db.execute(stmt).scalar_one()
    setting = db.get(Setting, "numbering")
    prefix = setting.value["prefix"] if setting else "CASA"
    return f"{prefix}-{year}-{n:04d}"


def access(db, qid, user):
    q = db.get(Quotation, qid)
    if not q or user.role != "admin" and q.created_by != user.id:
        raise HTTPException(404, "Quotation not found.")
    return q


def save_structure(db, q, payload):
    section_ids = select(QuotationSection.id).where(
        QuotationSection.quotation_id == q.id
    )
    db.execute(delete(QuotationItem).where(QuotationItem.section_id.in_(section_ids)))
    db.execute(delete(QuotationSection).where(QuotationSection.quotation_id == q.id))
    db.execute(delete(QuotationTerm).where(QuotationTerm.quotation_id == q.id))
    for n, s in enumerate(payload["sections"]):
        section = QuotationSection(
            quotation_id=q.id, position=n, name=s["name"], total=Decimal(s["total"])
        )
        db.add(section)
        db.flush()
        for pos, i in enumerate(s["items"]):
            db.add(
                QuotationItem(
                    section_id=section.id, position=pos, line_key=i["key"], snapshot=i
                )
            )
    for n, t in enumerate(payload["terms"]):
        db.add(QuotationTerm(quotation_id=q.id, position=n, wording=t))


def prepare(db, data, user, existing=None, strict=False):
    previous = existing.payload if existing else None
    payload = calculate(db, data, strict=strict, previous=previous, actor=user)
    payload["terms"] = (previous or {}).get(
        "terms", db.get(Setting, "terms").value["terms"]
    )
    payload["company_text"] = (previous or {}).get(
        "company_text", db.get(Setting, "company").value["text"]
    )
    company = db.get(Setting, "company").value
    for key in ["bank_details", "logo_base64"]:
        payload[key] = (previous or {}).get(key, company.get(key, ""))
    if existing:
        if data.revision != existing.revision:
            raise HTTPException(
                409, "This quotation changed in another session. Reload before saving."
            )
        revision = existing.revision + 1
        number = existing.number
    else:
        revision = 1
        number = next_number(db)
    payload.update(number=number, revision=revision)
    return payload


def persist(db, data, user, payload, existing=None, status="draft"):
    prior_items = {
        i["key"]: i
        for s in (existing.payload if existing else {}).get("sections", [])
        for i in s["items"]
    }
    for section in payload["sections"]:
        for i in section["items"]:
            prior = prior_items.get(i["key"], {})
            if (i.get("rate_override") or prior.get("rate_override")) and (
                i.get("quotation_rate") != prior.get("quotation_rate")
                or i.get("override_reason") != prior.get("override_reason")
            ):
                db.add(
                    AuditLog(
                        actor_id=user.id,
                        action="quotation_rate_override",
                        entity=payload["number"] + ":" + i["key"],
                        before={
                            "master_rate": prior.get("master_rate"),
                            "quotation_rate": prior.get("quotation_rate"),
                        },
                        after={
                            k: i.get(k)
                            for k in [
                                "master_rate",
                                "quotation_rate",
                                "override_reason",
                                "rate_changed_by",
                                "rate_changed_at",
                            ]
                        },
                    )
                )
    fields = dict(
        customer_id=data.customer_id,
        customer_name=data.customer_name,
        project_reference=data.project_reference,
        quote_date=data.quote_date.isoformat(),
        status=status,
        revision=payload["revision"],
        total=Decimal(payload["total"]),
        payload=payload,
        updated_at=now(),
    )
    if existing:
        changed = db.execute(
            update(Quotation)
            .where(Quotation.id == existing.id, Quotation.revision == data.revision)
            .values(**fields)
        )
        if changed.rowcount != 1:
            raise HTTPException(
                409, "This quotation changed in another session. Reload before saving."
            )
        db.refresh(existing)
        q = existing
    else:
        q = Quotation(number=payload["number"], created_by=user.id, **fields)
        db.add(q)
        db.flush()
    save_structure(db, q, payload)
    return q
