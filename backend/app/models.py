from datetime import datetime, timezone
from sqlalchemy import (
    String,
    Integer,
    Numeric,
    Boolean,
    DateTime,
    ForeignKey,
    JSON,
    LargeBinary,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def now():
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(80), unique=True)
    password_hash: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(10))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class LoginSession(Base):
    __tablename__ = "login_sessions"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class LoginAttempt(Base):
    __tablename__ = "login_attempts"
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    failures: Mapped[int] = mapped_column(default=0)
    window_started: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now
    )


class Customer(Base):
    __tablename__ = "customers"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    address: Mapped[str] = mapped_column(Text, default="")
    phone: Mapped[str] = mapped_column(String(60), default="")
    email: Mapped[str] = mapped_column(String(200), default="")
    project_reference: Mapped[str] = mapped_column(String(200), default="")
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class MasterProduct(Base):
    __tablename__ = "master_products"
    id: Mapped[int] = mapped_column(primary_key=True)
    item: Mapped[str] = mapped_column(String(200), index=True)
    carcass: Mapped[str] = mapped_column(String(200))
    shutter: Mapped[str] = mapped_column(String(200))
    finish: Mapped[str] = mapped_column(String(250))
    combination_key: Mapped[str] = mapped_column(String(900), unique=True)
    price: Mapped[float | None] = mapped_column(Numeric(16, 4), nullable=True)
    other: Mapped[float] = mapped_column(Numeric(16, 4), default=0)
    hardware: Mapped[float] = mapped_column(Numeric(16, 4), default=0)
    pricing_area: Mapped[float] = mapped_column(Numeric(16, 4), default=0)
    active: Mapped[bool] = mapped_column(default=True)
    needs_review: Mapped[bool] = mapped_column(default=False)
    source_row: Mapped[int | None] = mapped_column(nullable=True)
    source_data: Mapped[dict] = mapped_column(JSON, default=dict)
    specification: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(200), default="")
    unit: Mapped[str] = mapped_column(String(40), default="Sq Ft")
    measurement_mode: Mapped[str] = mapped_column(String(20), default="area")
    source_sheet: Mapped[str] = mapped_column(String(200), default="")
    catalogue: Mapped[str] = mapped_column(String(40), default="legacy", index=True)


class Setting(Base):
    __tablename__ = "settings"
    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON)


class PriceConflict(Base):
    __tablename__ = "price_conflicts"
    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("master_products.id"), index=True
    )
    item: Mapped[str] = mapped_column(String(200))
    carcass: Mapped[str] = mapped_column(String(200))
    shutter: Mapped[str] = mapped_column(String(200))
    finish: Mapped[str] = mapped_column(String(250))
    visible_price: Mapped[float] = mapped_column(Numeric(16, 4))
    lookup_price: Mapped[float] = mapped_column(Numeric(16, 4))
    status: Mapped[str] = mapped_column(String(20), default="unresolved")
    admin_resolution: Mapped[str | None] = mapped_column(String(20), nullable=True)
    resolved_price: Mapped[float | None] = mapped_column(Numeric(16, 4), nullable=True)
    resolved_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class Counter(Base):
    __tablename__ = "quotation_counters"
    year: Mapped[int] = mapped_column(primary_key=True)
    value: Mapped[int] = mapped_column(default=0)


class Quotation(Base):
    __tablename__ = "quotations"
    id: Mapped[int] = mapped_column(primary_key=True)
    number: Mapped[str] = mapped_column(String(40), unique=True, index=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    customer_id: Mapped[int | None] = mapped_column(
        ForeignKey("customers.id"), nullable=True
    )
    customer_name: Mapped[str] = mapped_column(String(200), default="", index=True)
    project_reference: Mapped[str] = mapped_column(String(200), default="", index=True)
    quote_date: Mapped[str] = mapped_column(String(10))
    status: Mapped[str] = mapped_column(String(20), default="draft")
    revision: Mapped[int] = mapped_column(default=1)
    total: Mapped[float] = mapped_column(Numeric(18, 2), default=0)
    payload: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class QuotationSection(Base):
    __tablename__ = "quotation_sections"
    id: Mapped[int] = mapped_column(primary_key=True)
    quotation_id: Mapped[int] = mapped_column(
        ForeignKey("quotations.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int] = mapped_column()
    name: Mapped[str] = mapped_column(String(200))
    total: Mapped[float] = mapped_column(Numeric(18, 2), default=0)


class QuotationItem(Base):
    __tablename__ = "quotation_items"
    id: Mapped[int] = mapped_column(primary_key=True)
    section_id: Mapped[int] = mapped_column(
        ForeignKey("quotation_sections.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int] = mapped_column()
    line_key: Mapped[str] = mapped_column(String(80))
    snapshot: Mapped[dict] = mapped_column(JSON)


class QuotationTerm(Base):
    __tablename__ = "quotation_terms"
    id: Mapped[int] = mapped_column(primary_key=True)
    quotation_id: Mapped[int] = mapped_column(
        ForeignKey("quotations.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int] = mapped_column()
    wording: Mapped[str] = mapped_column(Text)


class QuotationVersion(Base):
    __tablename__ = "quotation_versions"
    __table_args__ = (UniqueConstraint("quotation_id", "revision"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    quotation_id: Mapped[int] = mapped_column(ForeignKey("quotations.id"), index=True)
    revision: Mapped[int] = mapped_column()
    payload: Mapped[dict] = mapped_column(JSON)
    pdf: Mapped[bytes] = mapped_column(LargeBinary)
    excel: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    generated_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class AuditLog(Base):
    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(100))
    entity: Mapped[str] = mapped_column(String(100))
    before: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    after: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class Area(Base):
    __tablename__ = "areas"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True)
    active: Mapped[bool] = mapped_column(default=True)
    position: Mapped[int] = mapped_column(default=0)
    source_sheet: Mapped[str] = mapped_column(String(200), default="")


class AreaProduct(Base):
    __tablename__ = "area_products"
    area_id: Mapped[int] = mapped_column(ForeignKey("areas.id"), primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("master_products.id"), primary_key=True
    )


class MasterPriceHistory(Base):
    __tablename__ = "master_price_history"
    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("master_products.id"), index=True
    )
    old_price: Mapped[float | None] = mapped_column(Numeric(16, 4), nullable=True)
    new_price: Mapped[float | None] = mapped_column(Numeric(16, 4), nullable=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    reason: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class SourcePrice(Base):
    __tablename__ = "source_prices"
    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int | None] = mapped_column(
        ForeignKey("master_products.id"), nullable=True, index=True
    )
    source_file: Mapped[str] = mapped_column(String(200))
    source_sheet: Mapped[str] = mapped_column(String(200))
    source_row: Mapped[int] = mapped_column()
    price: Mapped[float | None] = mapped_column(Numeric(16, 8), nullable=True)
    raw: Mapped[dict] = mapped_column(JSON)


class SettingVersion(Base):
    __tablename__ = "setting_versions"
    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(80), index=True)
    value: Mapped[dict] = mapped_column(JSON)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ImportBatch(Base):
    __tablename__ = "import_batches"
    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str] = mapped_column(String(200))
    sha256: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(20), default="preview")
    report: Mapped[dict] = mapped_column(JSON)
    data: Mapped[dict] = mapped_column(JSON)
    source_file: Mapped[bytes] = mapped_column(LargeBinary)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
