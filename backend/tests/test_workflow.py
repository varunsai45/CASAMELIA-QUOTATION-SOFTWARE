import os, json, uuid
from pathlib import Path
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from backend.app.main import app, input_from_payload
from backend.app.db import get_db
from backend.app.models import (
    Base,
    MasterProduct,
    PriceConflict,
    QuotationVersion,
    Quotation,
    AuditLog,
)
from backend.app.seed import seed
from backend.app.calculations import amount_words, indian

H = {"X-Casa-Request": "1"}


@pytest.fixture
def env(tmp_path):
    engine = create_engine(
        f'sqlite:///{tmp_path / "test.db"}', connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)
    with factory() as db:
        seed(db, users=True)

    def dependency():
        with factory() as db:
            try:
                yield db
            except Exception:
                db.rollback()
                raise

    app.dependency_overrides[get_db] = dependency
    # Don't invoke dev lifespan: tests operate only on the isolated fixture DB.
    client = TestClient(app, raise_server_exceptions=False)
    yield client, factory
    app.dependency_overrides.clear()
    client.close()
    engine.dispose()


def login(c, user="admin"):
    r = c.post(
        "/auth/login", json={"username": user, "password": user + "123"}, headers=H
    )
    assert r.status_code == 200, r.text


def product(c, item="Base Unit"):
    return next(
        p
        for p in c.get("/master-list", params={"item": item, "limit": 500}).json()[
            "items"
        ]
        if p["carcass"] == "BWP Ply" and p["finish"] == "Laminate"
    )


def data(pid):
    return {
        "customer_id": None,
        "customer_name": "QA Customer",
        "address": "Kanakapura",
        "phone": "",
        "email": "",
        "project_reference": "QA-2026",
        "quote_date": "2026-09-30",
        "sections": [
            {
                "name": "FOYER AREA",
                "items": [
                    {
                        "key": str(uuid.uuid4()),
                        "product_id": pid,
                        "item_label": "Base Unit",
                        "description": "BWP Ply + HDHMR + Laminate",
                        "measurement_mode": "area",
                        "width": "5.5",
                        "length": "4",
                        "manual_area": None,
                        "quantity": "1",
                        "other_description": "",
                        "other_amount": "0",
                        "flat_charge": "0",
                    }
                ],
            }
        ],
    }


def test_import_counts_conflicts_and_source_preservation(env):
    c, f = env
    login(c)
    assert c.get("/master-list", params={"limit": 500}).json()["total"] == 238
    conflicts = c.get("/price-conflicts").json()
    assert len(conflicts) == 32
    assert all(v["status"] == "unresolved" for v in conflicts)
    with f() as db:
        products = list(db.scalars(select(MasterProduct)))
        assert len(products) == 238
        assert sum(p.needs_review for p in products) == 32
        assert sum(p.price is None and not p.needs_review for p in products) == 8
        original = next(p for p in products if p.source_row == 75)
        assert original.price is None
        assert original.source_data["price"] == "82280"
        assert db.scalar(
            select(PriceConflict).where(PriceConflict.product_id == original.id)
        ).lookup_price == Decimal("83550")
        seed(db, users=True)
        assert len(list(db.scalars(select(MasterProduct)))) == 238


def test_authentication_and_roles(env):
    c, f = env
    assert c.get("/quotations").status_code == 401
    assert (
        c.post(
            "/auth/login", json={"username": "admin", "password": "bad"}, headers=H
        ).status_code
        == 401
    )
    login(c, "sales")
    p = product(c)
    assert c.get("/price-conflicts").status_code == 403
    assert c.get("/users").status_code == 403
    assert c.get("/audit-log").status_code == 403
    assert c.put("/settings/gst", json={"gst_rate": 20}, headers=H).status_code == 403
    assert (
        c.post(
            "/master-list",
            json={
                "item": "Not allowed",
                "carcass": "-",
                "shutter": "-",
                "finish": "-",
                "price": 1,
            },
            headers=H,
        ).status_code
        == 403
    )
    assert c.get("/master-list", params={"limit": 500}).json()["total"] == 206
    customer = c.post(
        "/customers", json={"name": "Sales customer", "address": "Bengaluru"}, headers=H
    )
    assert customer.status_code == 201
    assert (
        c.put(
            "/customers/" + str(customer.json()["id"]),
            json={"name": "Changed"},
            headers=H,
        ).status_code
        == 200
    )
    q = c.post("/quotations", json=data(p["id"]), headers=H).json()
    assert q["created_by"] == "sales"
    login(c)
    allq = c.get("/quotations").json()
    assert allq["total"] == 2
    adminquote = c.post("/quotations", json=data(p["id"]), headers=H).json()
    login(c, "sales")
    assert c.get(f'/quotations/{adminquote["id"]}').status_code == 404
    assert c.get(f'/quotations/{adminquote["id"]}/versions').status_code == 404
    assert c.get("/quotations").json()["total"] == 1
    assert c.post("/auth/logout", headers=H).status_code == 204
    assert c.get("/auth/me").status_code == 401


def test_calculations_and_empty_rows(env):
    c, f = env
    login(c)
    d = data(product(c)["id"])
    preview = c.post("/quotations/preview", json=d, headers=H).json()
    assert preview["sections"][0]["items"][0]["area"] == "22.0"
    assert Decimal(preview["subtotal"]) == Decimal("43780")
    assert Decimal(preview["gst"]) == Decimal("7880.4")
    assert Decimal(preview["total"]) == Decimal("51660.4")
    assert (
        preview["amount_in_words"]
        == "Fifty One Thousand Six Hundred Sixty Rupees and Forty Paise Only"
    )
    i = d["sections"][0]["items"][0]
    i["other_amount"] = "1210"
    i["flat_charge"] = "4000"
    i["other_description"] = "Cushion"
    preview = c.post("/quotations/preview", json=d, headers=H).json()
    assert Decimal(preview["subtotal"]) == Decimal("74400")  # 22*(1990+1210)+4000
    i["measurement_mode"] = "rft"
    i["manual_area"] = "86.2"
    i["other_amount"] = "0"
    i["flat_charge"] = "0"
    preview = c.post("/quotations/preview", json=d, headers=H).json()
    assert Decimal(preview["subtotal"]) == Decimal("171538")
    i["measurement_mode"] = "unit"
    i["quantity"] = "2"
    preview = c.post("/quotations/preview", json=d, headers=H).json()
    assert Decimal(preview["subtotal"]) == Decimal("3980")
    d["sections"].append({"name": "Empty area", "items": [{"key": str(uuid.uuid4())}]})
    preview = c.post("/quotations/preview", json=d, headers=H).json()
    assert preview["sections"][1]["items"][0]["amount"] is None
    assert preview["sections"][1]["total"] == "0.00"


def test_invalid_inputs_conflicts_on_request(env):
    c, f = env
    login(c)
    d = data(product(c)["id"])
    d["sections"][0]["items"][0]["width"] = "-1"
    assert c.post("/quotations/preview", json=d, headers=H).status_code == 422
    d["sections"][0]["items"][0]["width"] = "NaN"
    assert c.post("/quotations", json=d, headers=H).status_code == 422
    d = data(product(c)["id"])
    d["sections"][0]["items"][0]["rate"] = "1"
    assert c.post("/quotations", json=d, headers=H).status_code == 422
    d = data(product(c)["id"])
    d["sections"][0]["items"][0]["product_id"] = c.get("/price-conflicts").json()[0][
        "product_id"
    ]
    q = c.post("/quotations", json=d, headers=H).json()
    assert c.post(f'/quotations/{q["id"]}/generate-pdf', headers=H).status_code == 422
    assert c.get(f'/quotations/{q["id"]}/pdf').status_code == 404
    with f() as db:
        assert len(list(db.scalars(select(QuotationVersion)))) == 0
    login(c, "sales")
    assert (
        c.get("/master-list", params={"q": "Bedside Table"}).json()["items"][0]["price"]
        is None
    )


def test_conflict_resolution_is_admin_only_and_audited(env):
    c, f = env
    login(c)
    conflict = c.get("/price-conflicts").json()[0]
    login(c, "sales")
    assert (
        c.post(
            f'/price-conflicts/{conflict["id"]}/resolve',
            json={"source": "masterflat"},
            headers=H,
        ).status_code
        == 403
    )
    login(c)
    r = c.post(
        f'/price-conflicts/{conflict["id"]}/resolve',
        json={"source": "masterflat"},
        headers=H,
    )
    assert r.status_code == 200
    resolved = c.get("/price-conflicts").json()[0]
    assert resolved["visible_price"] == conflict["visible_price"]
    assert resolved["lookup_price"] == conflict["lookup_price"]
    assert resolved["resolved_by"] == "admin"
    assert resolved["resolved_date"]
    assert resolved["resolved_price"] == conflict["lookup_price"]
    assert (
        c.post(
            f'/price-conflicts/{conflict["id"]}/resolve',
            json={"source": "master_list"},
            headers=H,
        ).status_code
        == 409
    )
    login(c, "sales")
    assert c.get("/master-list", params={"limit": 500}).json()["total"] == 207
    with f() as db:
        assert db.scalar(
            select(AuditLog).where(AuditLog.action == "price_conflict_resolved")
        )


def test_pdf_snapshots_versions_and_stale_edits(env, tmp_path):
    c, f = env
    login(c)
    p = product(c)
    d = data(p["id"])
    q = c.post("/quotations", json=d, headers=H).json()
    qid = q["id"]
    r = c.post(f"/quotations/{qid}/generate-pdf", headers=H)
    assert r.status_code == 200, r.text
    assert r.content.startswith(b"%PDF")
    original = r.content
    q = c.get(f"/quotations/{qid}").json()
    old_revision = q["revision"]
    old_total = q["total"]
    old_terms = q["payload"]["terms"]
    updated = {
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
            "active",
        ]
    }
    updated["price"] = "2100"
    assert c.put(f'/master-list/{p["id"]}', json=updated, headers=H).status_code == 200
    assert (
        c.put(
            "/settings/terms",
            json={"terms": ["Changed terms for new quotations."]},
            headers=H,
        ).status_code
        == 200
    )
    assert c.put("/settings/gst", json={"gst_rate": "20"}, headers=H).status_code == 200
    assert c.get(f"/quotations/{qid}").json()["total"] == old_total
    assert c.get(f"/quotations/{qid}/pdf").content == original
    assert c.post(f"/quotations/{qid}/generate-pdf", headers=H).content == original
    edit = input_from_payload(q["payload"]).model_dump(mode="json")
    edit["sections"][0]["items"][0]["quantity"] = "2"
    saved = c.put(f"/quotations/{qid}", json=edit, headers=H)
    assert saved.status_code == 200, saved.text
    assert c.put(f"/quotations/{qid}", json=edit, headers=H).status_code == 409
    r = c.post(f"/quotations/{qid}/generate-pdf", headers=H)
    assert r.status_code == 200, r.text
    q2 = c.get(f"/quotations/{qid}").json()
    assert (
        q2["payload"]["sections"][0]["items"][0]["rate"]
        == q["payload"]["sections"][0]["items"][0]["rate"]
    )
    assert q2["payload"]["terms"] == old_terms
    assert len(c.get(f"/quotations/{qid}/versions").json()) == 2
    assert (
        c.get(f"/quotations/{qid}/pdf", params={"revision": old_revision}).content
        == original
    )
    fresh = c.post(f"/quotations/{qid}/new-version", headers=H).json()
    assert fresh["number"] != q["number"]
    assert Decimal(fresh["payload"]["sections"][0]["items"][0]["rate"]) == Decimal(
        "2100"
    )
    assert fresh["payload"]["terms"] == ["Changed terms for new quotations."]
    assert fresh["payload"]["gst_rate"] == "20"
    import pymupdf

    pdf = pymupdf.open(stream=original, filetype="pdf")
    text = "".join(page.get_text() for page in pdf)
    assert "CASAMELIA INTERNATIONAL" in text and "43,780.00" in text
    assert len(pdf) >= 1
    for page in pdf:
        assert abs(page.rect.width - 595.28) < 1 and abs(page.rect.height - 841.89) < 1
        assert not any(
            e in page.get_text()
            for e in ["#VALUE!", "#REF!", "#DIV/0!", "#N/A", "#NAME?"]
        )
        for word in page.get_text("words"):
            assert (
                word[0] >= 20
                and word[2] <= pdf[0].rect.width - 20
                and word[1] >= 10
                and word[3] <= pdf[0].rect.height - 10
            )
    out = Path(__file__).resolve().parents[2] / "output" / "qa"
    out.mkdir(parents=True, exist_ok=True)
    (out / "verified-quotation.pdf").write_bytes(original)
    for n, page in enumerate(pdf):
        page.get_pixmap(matrix=pymupdf.Matrix(1.4, 1.4)).save(out / f"page-{n+1}.png")


def test_unique_numbers_and_search(env):
    c, f = env
    login(c)
    d = data(product(c)["id"])
    numbers = [
        c.post("/quotations", json=d, headers=H).json()["number"] for _ in range(8)
    ]
    assert len(numbers) == len(set(numbers))
    assert c.get("/quotations", params={"q": "QA-2026"}).json()["total"] == 8
    assert (
        c.get(
            "/quotations", params={"date_from": "2026-09-30", "date_to": "2026-09-30"}
        ).json()["total"]
        >= 8
    )
    assert (
        c.get("/quotations", params={"q": "'; DROP TABLE users; --"}).json()["total"]
        == 0
    )


def test_request_protection_password_revocation(env):
    c, f = env
    assert (
        c.post(
            "/auth/login", json={"username": "admin", "password": "admin123"}
        ).status_code
        == 403
    )
    assert (
        c.post(
            "/auth/login",
            json={"username": "admin", "password": "admin123"},
            headers={**H, "Origin": "https://evil.example"},
        ).status_code
        == 403
    )
    login(c)
    assert (
        c.post(
            "/auth/change-password",
            json={"current_password": "admin123", "new_password": "changed123"},
            headers=H,
        ).status_code
        == 204
    )
    assert c.get("/auth/me").status_code == 401
    assert (
        c.post(
            "/auth/login",
            json={"username": "admin", "password": "changed123"},
            headers=H,
        ).status_code
        == 200
    )


def test_currency_words():
    assert indian("135177", 0) == "1,35,177"
    assert (
        amount_words("2256080")
        == "Twenty Two Lakh Fifty Six Thousand Eighty Rupees Only"
    )
    assert amount_words("0") == "Zero Rupees Only"


def test_multi_page_quotation_and_long_description(env):
    c, factory = env
    login(c)
    p = product(c)
    source = json.loads(
        (Path(__file__).resolve().parents[1] / "data" / "source.json").read_text(
            encoding="utf8"
        )
    )
    d = data(p["id"])
    d["sections"] = []
    expected_labels = []
    for number, name in enumerate(source["section_names"], 1):
        items = []
        for j in range(4):
            i = data(p["id"])["sections"][0]["items"][0]
            label = f"QA-LINE-{number:02d}-{j:02d}"
            i["item_label"] = label
            i["description"] = "Original imported material combination. " * (
                48 if number == 1 and j == 0 else 3
            )
            expected_labels.append(label)
            items.append(i)
        d["sections"].append({"name": name, "items": items})
    d["sections"].append({"name": "", "items": [{"key": str(uuid.uuid4())}]})
    q = c.post("/quotations", json=d, headers=H).json()
    r = c.post(f'/quotations/{q["id"]}/generate-pdf', headers=H)
    assert r.status_code == 200, r.text
    import pymupdf

    pdf = pymupdf.open(stream=r.content, filetype="pdf")
    text = "\n".join(page.get_text() for page in pdf)
    assert len(pdf) >= 2
    for label in expected_labels:
        assert label in text
    for term in source["terms"]:
        assert " ".join(term.split()) in " ".join(text.split())
    for page in pdf:
        for w in page.get_text("words"):
            assert (
                20 <= w[0] < w[2] <= page.rect.width - 20
                and 10 <= w[1] < w[3] <= page.rect.height - 10
            )
    out = Path(__file__).resolve().parents[2] / "output" / "qa"
    (out / "multi-section-quotation.pdf").write_bytes(r.content)
    for n, page in enumerate(pdf):
        page.get_pixmap(matrix=pymupdf.Matrix(1.2, 1.2)).save(
            out / f"multi-page-{n+1}.png"
        )


def test_generation_rolls_back_on_pdf_failure(env, monkeypatch):
    c, f = env
    login(c)
    q = c.post("/quotations", json=data(product(c)["id"]), headers=H).json()

    def fail(_):
        raise RuntimeError("Simulated PDF failure")

    monkeypatch.setattr("backend.app.main.generate_pdf", fail)
    response = c.post(f'/quotations/{q["id"]}/generate-pdf', headers=H)
    assert response.status_code == 500
    assert c.get(f'/quotations/{q["id"]}').json()["status"] == "draft"
    assert c.get(f'/quotations/{q["id"]}/versions').json() == []
