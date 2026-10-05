from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta
from decimal import Decimal
import hashlib, logging
from fastapi import FastAPI, Depends, HTTPException, Request, Response, Query
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, func, or_, delete, update
from sqlalchemy.exc import IntegrityError
from .db import SessionLocal, get_db, engine
from .models import *
from .schemas import *
from .security import (
    current_user,
    admin,
    verify_password,
    hash_password,
    create_session,
    token_hash,
)
from .seed import seed
from .config import ALLOWED_ORIGINS, COOKIE_SECURE, PRODUCTION, DATA, SESSION_HOURS
from .calculations import calculate
from .quotation_service import access, prepare, persist
from .pdf import generate_pdf
from .excel import generate_excel


@asynccontextmanager
async def lifespan(app):
    if not PRODUCTION:
        Base.metadata.create_all(engine)
        with SessionLocal() as db:
            seed(db, users=True)
            from .current_import import import_current

            import_current(db)
    yield


app = FastAPI(title="CASAMELIA QUOTATION SOFTWARE", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["Content-Type", "X-Casa-Request"],
)


@app.middleware("http")
async def protection(request, call_next):
    if request.method in ["POST", "PUT", "DELETE", "PATCH"]:
        if request.headers.get("x-casa-request") != "1":
            return JSONResponse({"detail": "Missing request protection header."}, 403)
        origin = request.headers.get("origin")
        if origin and origin not in ALLOWED_ORIGINS:
            return JSONResponse({"detail": "Origin is not allowed."}, 403)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    return response


@app.exception_handler(IntegrityError)
async def conflict_error(request, exc):
    return JSONResponse(
        {"detail": "This record conflicts with existing data. Reload and try again."},
        409,
    )


@app.exception_handler(Exception)
async def unexpected_error(request, exc):
    logging.exception("Request failed: %s", request.url.path)
    return JSONResponse(
        {
            "detail": "The operation could not be completed. Please try again or contact Admin."
        },
        500,
    )


def public_user(u):
    return {"id": u.id, "username": u.username, "role": u.role, "active": u.active}


def customer_dict(c):
    return {
        k: getattr(c, k).isoformat() if k == "created_at" else getattr(c, k)
        for k in [
            "id",
            "name",
            "address",
            "phone",
            "email",
            "project_reference",
            "created_by",
            "notes",
            "created_at",
        ]
    }


def product_dict(p):
    return {
        k: (
            (str(getattr(p, k)) if getattr(p, k) is not None else None)
            if k in ["price", "other", "hardware", "pricing_area"]
            else getattr(p, k)
        )
        for k in [
            "id",
            "item",
            "carcass",
            "shutter",
            "finish",
            "price",
            "other",
            "hardware",
            "pricing_area",
            "active",
            "needs_review",
            "source_row",
            "specification",
            "category",
            "unit",
            "measurement_mode",
            "source_sheet",
            "catalogue",
        ]
    }


def audit(db, user, action, entity, before=None, after=None):
    db.add(
        AuditLog(
            actor_id=user.id, action=action, entity=entity, before=before, after=after
        )
    )


def summary(q, db):
    u = db.get(User, q.created_by)
    return {
        "id": q.id,
        "number": q.number,
        "customer_name": q.customer_name,
        "project_reference": q.project_reference,
        "quote_date": q.quote_date,
        "created_by": u.username,
        "status": q.status,
        "total": str(q.total),
        "revision": q.revision,
        "customer_id": q.customer_id,
        "updated_at": q.updated_at.isoformat(),
    }


def q_filter(user):
    return True if user.role == "admin" else Quotation.created_by == user.id


def validate_customer(db, data, user):
    if data.customer_id:
        c = db.get(Customer, data.customer_id)
        if not c or user.role != "admin" and c.created_by != user.id:
            raise HTTPException(404, "Customer not found.")


@app.get("/")
def service_info():
    """Liveness endpoint; /health separately verifies database connectivity."""
    return {
        "service": app.title,
        "status": "running",
        "health": "/health",
    }


@app.get("/health")
def health(db=Depends(get_db)):
    db.execute(select(1))
    return {"status": "ok"}


@app.get("/branding/logo")
def logo():
    import base64

    with SessionLocal() as db:
        s = db.get(Setting, "company")
        raw = s.value.get("logo_base64") if s else None
    if raw:
        data = base64.b64decode(raw)
        return Response(
            data,
            media_type="image/png" if data.startswith(b"\x89PNG") else "image/jpeg",
        )
    return FileResponse(DATA / "logo.png", media_type="image/jpeg")


@app.post("/auth/login")
def login(data: Login, request: Request, response: Response, db=Depends(get_db)):
    key = hashlib.sha256(
        (request.client.host + "|" + data.username.casefold()).encode()
    ).hexdigest()
    attempt = db.get(LoginAttempt, key)
    if attempt and attempt.window_started.replace(
        tzinfo=timezone.utc
    ) < now() - timedelta(minutes=15):
        attempt.failures = 0
        attempt.window_started = now()
    if attempt and attempt.failures >= 8:
        raise HTTPException(429, "Too many login attempts. Try again after 15 minutes.")
    u = db.scalar(select(User).where(User.username == data.username))
    if not u or not u.active or not verify_password(data.password, u.password_hash):
        if not attempt:
            attempt = LoginAttempt(key=key, failures=0)
            db.add(attempt)
        attempt.failures += 1
        db.commit()
        raise HTTPException(401, "Incorrect username or password.")
    if attempt:
        db.delete(attempt)
    token = create_session(db, u)
    db.commit()
    response.set_cookie(
        "casa_session",
        token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="strict",
        max_age=SESSION_HOURS * 3600,
        path="/",
    )
    return public_user(u)


@app.get("/auth/me")
def me(user=Depends(current_user)):
    return public_user(user)


@app.post("/auth/logout", status_code=204)
def logout(request: Request, response: Response, db=Depends(get_db)):
    db.execute(
        delete(LoginSession).where(
            LoginSession.token_hash
            == token_hash(request.cookies.get("casa_session", ""))
        )
    )
    db.commit()
    response.delete_cookie("casa_session", path="/")


@app.post("/auth/change-password", status_code=204)
def change_password(
    data: PasswordChange,
    response: Response,
    user=Depends(current_user),
    db=Depends(get_db),
):
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(400, "Current password is incorrect.")
    user.password_hash = hash_password(data.new_password)
    db.execute(delete(LoginSession).where(LoginSession.user_id == user.id))
    audit(db, user, "password_change", f"user:{user.id}")
    db.commit()
    response.delete_cookie("casa_session", path="/")


@app.get("/users")
def users(user=Depends(admin), db=Depends(get_db)):
    return [public_user(u) for u in db.scalars(select(User).order_by(User.id))]


@app.post("/users", status_code=201)
def create_user(data: UserCreate, user=Depends(admin), db=Depends(get_db)):
    u = User(
        username=data.username,
        role=data.role,
        password_hash=hash_password(data.password),
    )
    db.add(u)
    db.flush()
    audit(db, user, "user_create", f"user:{u.id}", after=public_user(u))
    db.commit()
    return public_user(u)


@app.put("/users/{uid}")
def update_user(uid: int, data: UserUpdate, user=Depends(admin), db=Depends(get_db)):
    u = db.get(User, uid)
    if not u:
        raise HTTPException(404, "User not found.")
    if u.id == user.id and data.active is False:
        raise HTTPException(400, "You cannot deactivate your own account.")
    before = public_user(u)
    if data.active is not None:
        u.active = data.active
    if data.password:
        u.password_hash = hash_password(data.password)
    db.execute(delete(LoginSession).where(LoginSession.user_id == u.id))
    audit(db, user, "user_update", f"user:{uid}", before, public_user(u))
    db.commit()
    return public_user(u)


@app.get("/dashboard")
def dashboard(user=Depends(current_user), db=Depends(get_db)):
    qs = list(
        db.scalars(
            select(Quotation)
            .where(q_filter(user))
            .order_by(Quotation.updated_at.desc())
        )
    )
    return {
        "total": len(qs),
        "drafts": sum(q.status == "draft" for q in qs),
        "generated": sum(q.status == "generated" for q in qs),
        "value": str(sum(Decimal(q.total) for q in qs)),
        "recent": [summary(q, db) for q in qs[:8]],
        "customers": db.scalar(
            select(func.count())
            .select_from(Customer)
            .where(True if user.role == "admin" else Customer.created_by == user.id)
        ),
        "master_products": db.scalar(
            select(func.count())
            .select_from(MasterProduct)
            .where(MasterProduct.active.is_(True))
        ),
        "price_conflicts": (
            db.scalar(
                select(func.count())
                .select_from(MasterProduct)
                .where(
                    MasterProduct.active.is_(True), MasterProduct.needs_review.is_(True)
                )
            )
            if user.role == "admin"
            else None
        ),
    }


@app.get("/master-list")
def master_list(
    q: str = "",
    item: str = "",
    carcass: str = "",
    shutter: str = "",
    finish: str = "",
    area_id: int | None = None,
    include_inactive: bool = False,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    user=Depends(current_user),
    db=Depends(get_db),
):
    stmt = select(MasterProduct)
    if area_id is not None:
        stmt = stmt.where(
            MasterProduct.id.in_(
                select(AreaProduct.product_id).where(AreaProduct.area_id == area_id)
            )
        )
    if user.role != "admin" or not include_inactive:
        stmt = stmt.where(MasterProduct.active.is_(True))
    if user.role != "admin":
        stmt = stmt.where(MasterProduct.needs_review.is_(False))
    if q:
        stmt = stmt.where(
            or_(
                *[
                    getattr(MasterProduct, k).ilike("%" + q + "%")
                    for k in [
                        "item",
                        "carcass",
                        "shutter",
                        "finish",
                        "specification",
                        "category",
                    ]
                ]
            )
        )
    for key, value in [
        ("item", item),
        ("carcass", carcass),
        ("shutter", shutter),
        ("finish", finish),
    ]:
        if value:
            stmt = stmt.where(getattr(MasterProduct, key) == value)
    count = db.scalar(select(func.count()).select_from(stmt.subquery()))
    return {
        "total": count,
        "items": [
            {
                **product_dict(p),
                "area_ids": list(
                    db.scalars(
                        select(AreaProduct.area_id).where(
                            AreaProduct.product_id == p.id
                        )
                    )
                ),
            }
            for p in db.scalars(
                stmt.order_by(
                    MasterProduct.item, MasterProduct.source_row, MasterProduct.id
                )
                .offset(offset)
                .limit(limit)
            )
        ],
    }


@app.get("/master-list/filters")
def filters(area_id: int | None = None, user=Depends(current_user), db=Depends(get_db)):
    stmt = select(MasterProduct).where(MasterProduct.active.is_(True))
    if area_id is not None:
        stmt = stmt.where(
            MasterProduct.id.in_(
                select(AreaProduct.product_id).where(AreaProduct.area_id == area_id)
            )
        )
    if user.role != "admin":
        stmt = stmt.where(MasterProduct.needs_review.is_(False))
    ps = list(db.scalars(stmt))
    return {
        k: sorted(set(getattr(p, k) for p in ps))
        for k in ["item", "carcass", "shutter", "finish"]
    }


@app.post("/master-list", status_code=201)
def add_product(data: ProductInput, user=Depends(admin), db=Depends(get_db)):
    fields = data.model_dump()
    area_ids = fields.pop("area_ids")
    fields["combination_key"] = (
        "|".join(fields[k] for k in ["item", "carcass", "shutter", "finish"]).casefold()
        + "|"
        + fields["specification"].casefold()
    )
    p = MasterProduct(**fields, source_data={}, catalogue="manual")
    db.add(p)
    db.flush()
    set_product_areas(db, p, area_ids)
    price_history(db, p, None, p.price, user, "Product created")
    audit(db, user, "product_create", f"product:{p.id}", after=product_dict(p))
    db.commit()
    return product_dict(p)


@app.put("/master-list/{pid}")
def edit_product(pid: int, data: ProductInput, user=Depends(admin), db=Depends(get_db)):
    p = db.get(MasterProduct, pid)
    if not p:
        raise HTTPException(404, "Product not found.")
    if p.needs_review:
        raise HTTPException(409, "Resolve the original price conflict first.")
    before = product_dict(p)
    fields = data.model_dump()
    area_ids = fields.pop("area_ids")
    if p.price != data.price:
        price_history(db, p, p.price, data.price, user, "Admin master rate change")
    for k, v in fields.items():
        setattr(p, k, v)
    set_product_areas(db, p, area_ids)
    audit(db, user, "product_update", f"product:{pid}", before, product_dict(p))
    db.commit()
    return product_dict(p)


@app.get("/price-conflicts")
def price_conflicts(
    include_legacy: bool = False, user=Depends(admin), db=Depends(get_db)
):
    records = []
    stmt = select(PriceConflict).join(
        MasterProduct, MasterProduct.id == PriceConflict.product_id
    )
    if not include_legacy:
        stmt = stmt.where(MasterProduct.active.is_(True))
    for c in db.scalars(stmt.order_by(PriceConflict.id)):
        d = {
            k: getattr(c, k)
            for k in [
                "id",
                "product_id",
                "item",
                "carcass",
                "shutter",
                "finish",
                "status",
                "admin_resolution",
            ]
        }
        d.update(
            specification=db.get(MasterProduct, c.product_id).specification,
            visible_price=str(c.visible_price),
            lookup_price=str(c.lookup_price),
            resolved_price=(
                str(c.resolved_price) if c.resolved_price is not None else None
            ),
            resolved_by=db.get(User, c.resolved_by).username if c.resolved_by else None,
            resolved_date=c.resolved_at.isoformat() if c.resolved_at else None,
        )
        records.append(d)
    return records


@app.post("/price-conflicts/{cid}/resolve")
def resolve_conflict(
    cid: int, data: ResolvePrices, user=Depends(admin), db=Depends(get_db)
):
    c = db.scalar(
        select(PriceConflict).where(PriceConflict.id == cid).with_for_update()
    )
    if not c:
        raise HTTPException(404, "Price conflict not found.")
    price = c.visible_price if data.source == "master_list" else c.lookup_price
    claimed = db.execute(
        update(PriceConflict)
        .where(PriceConflict.id == cid, PriceConflict.status == "unresolved")
        .values(
            status="resolved",
            admin_resolution=data.source,
            resolved_price=price,
            resolved_by=user.id,
            resolved_at=now(),
        )
    )
    if claimed.rowcount != 1:
        raise HTTPException(409, "This conflict has already been resolved.")
    p = db.get(MasterProduct, c.product_id)
    before = product_dict(p)
    price_history(db, p, p.price, price, user, "Price conflict resolved")
    p.price = price
    p.needs_review = False
    audit(
        db,
        user,
        "price_conflict_resolved",
        f"product:{p.id}",
        before,
        {"official_price": str(price), "conflict_id": cid, "source": data.source},
    )
    db.commit()
    return {"status": "resolved", "price": str(price)}


@app.get("/customers")
def customers(
    q: str = "",
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    user=Depends(current_user),
    db=Depends(get_db),
):
    stmt = select(Customer)
    if user.role != "admin":
        stmt = stmt.where(Customer.created_by == user.id)
    if q:
        stmt = stmt.where(
            or_(
                Customer.name.ilike("%" + q + "%"),
                Customer.project_reference.ilike("%" + q + "%"),
                Customer.phone.ilike("%" + q + "%"),
            )
        )
    counts = {
        cid: (count, projects)
        for cid, count, projects in db.execute(
            select(
                Quotation.customer_id,
                func.count(),
                func.count(func.distinct(func.nullif(Quotation.project_reference, ""))),
            )
            .where(q_filter(user))
            .group_by(Quotation.customer_id)
        )
    }
    ranked = (
        select(
            Quotation.customer_id,
            Quotation.number,
            Quotation.total,
            func.row_number()
            .over(
                partition_by=Quotation.customer_id, order_by=Quotation.updated_at.desc()
            )
            .label("rank"),
        )
        .where(q_filter(user))
        .subquery()
    )
    latest = {
        r.customer_id: r for r in db.execute(select(ranked).where(ranked.c.rank == 1))
    }
    return [
        dict(
            customer_dict(c),
            quotation_count=counts.get(c.id, (0, 0))[0],
            project_count=counts.get(c.id, (0, 0))[1],
            latest_quotation=latest[c.id].number if c.id in latest else None,
            latest_amount=str(latest[c.id].total) if c.id in latest else None,
        )
        for c in db.scalars(stmt.order_by(Customer.name).offset(offset).limit(limit))
    ]


@app.get("/customers/{cid}")
def customer_details(cid: int, user=Depends(current_user), db=Depends(get_db)):
    c = db.get(Customer, cid)
    if not c or user.role != "admin" and c.created_by != user.id:
        raise HTTPException(404, "Customer not found.")
    qs = list(
        db.scalars(
            select(Quotation)
            .where(q_filter(user), Quotation.customer_id == cid)
            .order_by(Quotation.updated_at.desc())
        )
    )
    return {
        "customer": customer_dict(c),
        "projects": sorted({q.project_reference for q in qs if q.project_reference}),
        "quotations": [summary(q, db) for q in qs],
    }


@app.post("/customers", status_code=201)
def create_customer(
    data: CustomerInput, user=Depends(current_user), db=Depends(get_db)
):
    c = Customer(**data.model_dump(), created_by=user.id)
    db.add(c)
    db.commit()
    return customer_dict(c)


@app.put("/customers/{cid}")
def edit_customer(
    cid: int, data: CustomerInput, user=Depends(current_user), db=Depends(get_db)
):
    c = db.get(Customer, cid)
    if not c or user.role != "admin" and c.created_by != user.id:
        raise HTTPException(404, "Customer not found.")
    before = customer_dict(c)
    for k, v in data.model_dump().items():
        setattr(c, k, v)
    audit(db, user, "customer_update", f"customer:{cid}", before, customer_dict(c))
    db.commit()
    return customer_dict(c)


@app.get("/settings")
def settings(user=Depends(current_user), db=Depends(get_db)):
    return {
        s.key: s.value
        for s in db.scalars(select(Setting))
        if s.key != "source_import" or user.role == "admin"
    }


@app.put("/settings/gst")
def gst(data: SettingsInput, user=Depends(admin), db=Depends(get_db)):
    s = db.get(Setting, "gst_rate")
    before = s.value
    s.value = {"rate": str(data.gst_rate)}
    audit(db, user, "gst_update", "settings", before, s.value)
    db.commit()
    return s.value


@app.put("/settings/terms")
def terms(data: TermsInput, user=Depends(admin), db=Depends(get_db)):
    s = db.get(Setting, "terms")
    before = s.value
    s.value = {"terms": data.terms}
    db.add(SettingVersion(key="terms", value=s.value, actor_id=user.id))
    audit(db, user, "terms_update", "settings", before, s.value)
    db.commit()
    return s.value


@app.get("/audit-log")
def audit_log(user=Depends(admin), db=Depends(get_db)):
    return [
        {
            "id": a.id,
            "actor": db.get(User, a.actor_id).username if a.actor_id else "system",
            "action": a.action,
            "entity": a.entity,
            "before": a.before,
            "after": a.after,
            "date": a.created_at.isoformat(),
        }
        for a in db.scalars(select(AuditLog).order_by(AuditLog.id.desc()).limit(500))
    ]


@app.post("/quotations/preview")
def preview(
    data: QuotationInput,
    quotation_id: int | None = None,
    user=Depends(current_user),
    db=Depends(get_db),
):
    previous = access(db, quotation_id, user).payload if quotation_id else None
    return calculate(db, data, previous=previous, actor=user)


@app.get("/quotations")
def quotations(
    q: str = "",
    date_from: str = "",
    date_to: str = "",
    status: str = "",
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    user=Depends(current_user),
    db=Depends(get_db),
):
    stmt = select(Quotation).where(q_filter(user))
    if q:
        stmt = stmt.where(
            or_(
                Quotation.number.ilike("%" + q + "%"),
                Quotation.customer_name.ilike("%" + q + "%"),
                Quotation.project_reference.ilike("%" + q + "%"),
                Quotation.quote_date.ilike("%" + q + "%"),
            )
        )
    if date_from:
        stmt = stmt.where(Quotation.quote_date >= date_from)
    if date_to:
        stmt = stmt.where(Quotation.quote_date <= date_to)
    if status:
        stmt = stmt.where(Quotation.status == status)
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    return {
        "total": total,
        "value": str(
            db.scalar(
                select(func.coalesce(func.sum(Quotation.total), 0)).where(
                    Quotation.id.in_(select(stmt.subquery().c.id))
                )
            )
        ),
        "items": [
            summary(q, db)
            for q in db.scalars(
                stmt.order_by(Quotation.updated_at.desc()).offset(offset).limit(limit)
            )
        ],
    }


@app.post("/quotations", status_code=201)
def create_quotation(
    data: QuotationInput, user=Depends(current_user), db=Depends(get_db)
):
    validate_customer(db, data, user)
    payload = prepare(db, data, user)
    q = persist(db, data, user, payload)
    audit(db, user, "draft_create", q.number)
    db.commit()
    return {**summary(q, db), "payload": q.payload}


@app.get("/quotations/{qid}")
def detail(qid: int, user=Depends(current_user), db=Depends(get_db)):
    q = access(db, qid, user)
    return {**summary(q, db), "payload": q.payload}


@app.put("/quotations/{qid}")
def update_quotation(
    qid: int, data: QuotationInput, user=Depends(current_user), db=Depends(get_db)
):
    q = access(db, qid, user)
    validate_customer(db, data, user)
    payload = prepare(db, data, user, q)
    q = persist(db, data, user, payload, q)
    audit(db, user, "draft_update", q.number)
    db.commit()
    return {**summary(q, db), "payload": q.payload}


@app.post("/quotations/{qid}/new-version", status_code=201)
def new_version(qid: int, user=Depends(current_user), db=Depends(get_db)):
    old = access(db, qid, user)
    data = input_from_payload(old.payload)
    for section in data.sections:
        for item in section.items:
            if not item.custom:
                item.quotation_rate = None
                item.override_reason = ""
                item.hardware_amount = item.hardware_area = item.carcass_rate = None
    # Explicit action: create a new quotation with current prices and terms.
    payload = prepare(db, data, user)
    payload["based_on"] = old.number
    q = persist(db, data, user, payload)
    audit(
        db, user, "new_quotation_from_version", q.number, after={"based_on": old.number}
    )
    db.commit()
    return {**summary(q, db), "payload": q.payload}


def input_from_payload(payload):
    fields = {
        k: payload[k]
        for k in QuotationInput.model_fields
        if k in payload and k != "sections"
    }
    fields["sections"] = [
        {
            "name": s["name"],
            "area_id": s.get("area_id"),
            "items": [
                {k: i[k] for k in ItemInput.model_fields if k in i} for i in s["items"]
            ],
        }
        for s in payload["sections"]
    ]
    return QuotationInput(**fields)


def pdf_response(pdf, q, revision, inline=False):
    filename = f"Casamelia_Quotation_{q.number}.pdf"
    return Response(
        pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'{"inline" if inline else "attachment"}; filename="{filename}"',
            "X-Quotation-Id": str(q.id),
            "X-Quotation-Revision": str(revision),
        },
    )


@app.post("/quotations/{qid}/generate-pdf")
def generate(
    qid: int,
    data: QuotationInput | None = None,
    user=Depends(current_user),
    db=Depends(get_db),
):
    q = access(db, qid, user)
    if data is None and q.status in ["generated", "finalized"]:
        v = db.scalar(
            select(QuotationVersion).where(
                QuotationVersion.quotation_id == qid,
                QuotationVersion.revision == q.revision,
            )
        )
        return pdf_response(v.pdf, q, v.revision)
    if data is not None and data.revision is None:
        raise HTTPException(
            409, "Reload this quotation before generating; its revision is required."
        )
    data = data or input_from_payload(q.payload)
    data.revision = q.revision if data.revision is None else data.revision
    validate_customer(db, data, user)
    payload = prepare(db, data, user, q, strict=True)
    # Capture current terms at first generation. Editing existing versions retains their terms.
    if not db.scalar(
        select(QuotationVersion.id).where(QuotationVersion.quotation_id == qid).limit(1)
    ):
        payload["terms"] = db.get(Setting, "terms").value["terms"]
        company = db.get(Setting, "company").value
        payload["company_text"] = company["text"]
        payload["bank_details"] = company.get("bank_details", "")
        payload["logo_base64"] = company.get("logo_base64", "")
    payload["generated_at"] = now().isoformat()
    payload["generated_by"] = user.username
    pdf = generate_pdf(
        payload
    )  # Failure leaves transaction rolled back, including status.
    excel = generate_excel(payload)
    q = persist(db, data, user, payload, q, status="generated")
    db.add(
        QuotationVersion(
            quotation_id=q.id,
            revision=q.revision,
            payload=payload,
            pdf=pdf,
            excel=excel,
            generated_by=user.id,
        )
    )
    audit(
        db,
        user,
        "quotation_generated",
        q.number,
        after={"revision": q.revision, "total": payload["total"]},
    )
    db.commit()
    return pdf_response(pdf, q, q.revision)


@app.get("/quotations/{qid}/versions")
def versions(qid: int, user=Depends(current_user), db=Depends(get_db)):
    access(db, qid, user)
    return [
        {
            "revision": v.revision,
            "has_excel": v.excel is not None,
            "total": v.payload["total"],
            "created_at": v.created_at.isoformat(),
            "generated_by": (
                db.get(User, v.generated_by).username
                if v.generated_by
                else "Legacy version"
            ),
            "customer_name": v.payload["customer_name"],
            "project_reference": v.payload["project_reference"],
        }
        for v in db.scalars(
            select(QuotationVersion)
            .where(QuotationVersion.quotation_id == qid)
            .order_by(QuotationVersion.revision.desc())
        )
    ]


@app.get("/quotations/{qid}/pdf")
def download(
    qid: int,
    revision: int | None = None,
    inline: bool = False,
    user=Depends(current_user),
    db=Depends(get_db),
):
    q = access(db, qid, user)
    stmt = select(QuotationVersion).where(QuotationVersion.quotation_id == qid)
    if revision is not None:
        stmt = stmt.where(QuotationVersion.revision == revision)
    v = db.scalar(stmt.order_by(QuotationVersion.revision.desc()).limit(1))
    if not v:
        raise HTTPException(404, "Generate this quotation before downloading a PDF.")
    return pdf_response(v.pdf, q, v.revision, inline)


def price_history(db, p, old, new, user, reason):
    db.add(
        MasterPriceHistory(
            product_id=p.id,
            old_price=old,
            new_price=new,
            actor_id=user.id,
            reason=reason,
        )
    )


def set_product_areas(db, p, ids):
    if any(not db.get(Area, i) for i in ids):
        raise HTTPException(422, "Select valid areas.")
    db.execute(delete(AreaProduct).where(AreaProduct.product_id == p.id))
    for i in set(ids):
        db.add(AreaProduct(area_id=i, product_id=p.id))


@app.get("/quotations/{qid}/excel")
def download_excel(
    qid: int,
    revision: int | None = None,
    user=Depends(current_user),
    db=Depends(get_db),
):
    q = access(db, qid, user)
    stmt = select(QuotationVersion).where(QuotationVersion.quotation_id == qid)
    if revision is not None:
        stmt = stmt.where(QuotationVersion.revision == revision)
    v = db.scalar(stmt.order_by(QuotationVersion.revision.desc()).limit(1))
    if not v or not v.excel:
        raise HTTPException(
            404,
            "This version has no saved Excel document. Generate a new version to create both files.",
        )
    return Response(
        v.excel,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="Casamelia_Quotation_{q.number}.xlsx"',
            "X-Quotation-Revision": str(v.revision),
        },
    )


@app.post("/quotations/{qid}/generate")
def generate_documents(
    qid: int,
    data: QuotationInput | None = None,
    user=Depends(current_user),
    db=Depends(get_db),
):
    generate(qid, data, user, db)
    q = access(db, qid, user)
    return {
        "id": q.id,
        "number": q.number,
        "revision": q.revision,
        "pdf_url": f"/quotations/{q.id}/pdf?revision={q.revision}",
        "excel_url": f"/quotations/{q.id}/excel?revision={q.revision}",
    }


@app.post("/quotations/{qid}/finalize")
def finalize(qid: int, user=Depends(admin), db=Depends(get_db)):
    q = access(db, qid, user)
    if q.status != "generated":
        raise HTTPException(409, "Generate the quotation before finalizing.")
    q.status = "finalized"
    audit(db, user, "quotation_finalized", q.number)
    db.commit()
    return summary(q, db)


from .business_routes import router as business_router

app.include_router(business_router)
