from datetime import date
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel, Field, ConfigDict, field_validator


class Strict(BaseModel):
    model_config = ConfigDict(
        extra="forbid", str_strip_whitespace=True, validate_default=True
    )


class Login(Strict):
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=72)


class PasswordChange(Strict):
    current_password: str
    new_password: str = Field(min_length=8, max_length=72)


class UserCreate(Strict):
    username: str = Field(min_length=3, max_length=80, pattern=r"^[a-zA-Z0-9_.-]+$")
    password: str = Field(min_length=8, max_length=72)
    role: Literal["admin", "sales"]


class UserUpdate(Strict):
    active: bool | None = None
    password: str | None = Field(default=None, min_length=8, max_length=72)


class CustomerInput(Strict):
    name: str = Field(min_length=1, max_length=200)
    address: str = Field(default="", max_length=2000)
    phone: str = Field(default="", max_length=60)
    email: str = Field(default="", max_length=200)
    project_reference: str = Field(default="", max_length=200)
    notes: str = Field(default="", max_length=4000)


class ProductInput(Strict):
    item: str = Field(min_length=1, max_length=200)
    carcass: str = Field(min_length=1, max_length=200)
    shutter: str = Field(min_length=1, max_length=200)
    finish: str = Field(min_length=1, max_length=250)
    price: Decimal | None = Field(default=None, ge=0, le=100000000)
    other: Decimal = Field(default=0, ge=0, le=100000000)
    hardware: Decimal = Field(default=0, ge=0, le=100000000)
    pricing_area: Decimal = Field(default=0, ge=0, le=1000000)
    active: bool = True
    specification: str = Field(default="", max_length=3000)
    category: str = Field(default="", max_length=200)
    unit: str = Field(default="Sq Ft", max_length=40)
    measurement_mode: Literal["area", "rft", "unit", "fixed"] = "area"
    area_ids: list[int] = Field(default_factory=list, max_length=100)


class ItemInput(Strict):
    key: str = Field(min_length=1, max_length=80)
    product_id: int | None = None
    item_label: str = Field(default="", max_length=200)
    description: str = Field(default="", max_length=2000)
    measurement_mode: Literal["area", "rft", "unit", "fixed"] = "area"
    quotation_rate: Decimal | None = Field(default=None, ge=0, le=100000000)
    override_reason: str | None = Field(default=None, max_length=1000)
    custom: bool = False
    custom_material: str = Field(default="", max_length=200)
    custom_finish: str = Field(default="", max_length=250)
    unit: str = Field(default="", max_length=40)
    hardware_amount: Decimal | None = Field(default=None, ge=0, le=100000000)
    hardware_area: Decimal | None = Field(default=None, gt=0, le=1000000)
    carcass_rate: Decimal | None = Field(default=None, ge=0, le=100000000)
    width: Decimal | None = Field(default=None, ge=0, le=100000)
    length: Decimal | None = Field(default=None, ge=0, le=100000)
    manual_area: Decimal | None = Field(default=None, ge=0, le=1000000)
    quantity: Decimal | None = Field(default=None, ge=0, le=100000)
    other_description: str = Field(default="", max_length=500)
    other_amount: Decimal = Field(default=0, ge=0, le=100000000)
    flat_charge: Decimal = Field(default=0, ge=0, le=100000000)

    @field_validator(
        "width",
        "length",
        "manual_area",
        "quantity",
        "other_amount",
        "flat_charge",
        "quotation_rate",
        "hardware_amount",
        "hardware_area",
        "carcass_rate",
    )
    @classmethod
    def finite(cls, v):
        if v is not None and not v.is_finite():
            raise ValueError("Enter a finite number")
        return v


class SectionInput(Strict):
    name: str = Field(default="", max_length=200)
    area_id: int | None = None
    items: list[ItemInput] = Field(default_factory=list, max_length=250)


class QuotationInput(Strict):
    customer_id: int | None = None
    customer_name: str = Field(default="", max_length=200)
    address: str = Field(default="", max_length=2000)
    phone: str = Field(default="", max_length=60)
    email: str = Field(default="", max_length=200)
    project_reference: str = Field(default="", max_length=200)
    quote_date: date
    revision: int | None = None
    sections: list[SectionInput] = Field(default_factory=list, max_length=100)


class SettingsInput(Strict):
    gst_rate: Decimal = Field(ge=0, le=100)


class ResolvePrices(Strict):
    source: Literal["master_list", "masterflat"]


class TermsInput(Strict):
    terms: list[str] = Field(min_length=1, max_length=100)

    @field_validator("terms")
    @classmethod
    def validate_terms(cls, v):
        if any(not s.strip() or len(s) > 5000 for s in v):
            raise ValueError("Each term must contain 1 to 5000 characters.")
        return v


class AreaInput(Strict):
    name: str = Field(min_length=1, max_length=200)
    active: bool = True
    position: int = Field(default=0, ge=0, le=10000)


class AreaAssignment(Strict):
    product_ids: list[int] = Field(max_length=10000)


class CompanyInput(Strict):
    text: str = Field(min_length=1, max_length=4000)
    bank_details: str = Field(default="", max_length=2000)
    logo_base64: str = Field(default="", max_length=1500000)


class NumberingInput(Strict):
    prefix: str = Field(min_length=1, max_length=12, pattern=r"^[A-Z0-9]+$")


class ImportInput(Strict):
    filename: str = Field(min_length=1, max_length=200)
    content_base64: str = Field(min_length=1, max_length=7000000)
