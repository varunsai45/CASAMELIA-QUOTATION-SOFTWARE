"""Regression coverage for constraint names assigned by different databases."""

import importlib
import os
from pathlib import Path
import subprocess
import sys

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations

revision = importlib.import_module(
    "backend.migrations.versions.e20e112c2343_area_catalogue_project_rates_and_excel_"
)


@pytest.mark.parametrize(
    "name", [None, "price_conflicts_product_id_key", "custom_product_unique"]
)
def test_upgrade_preserves_conflicts_and_removes_actual_unique_constraint(
    name, monkeypatch
):
    engine = sa.create_engine("sqlite://")
    with engine.begin() as connection:
        metadata = sa.MetaData()
        table = sa.Table(
            "price_conflicts",
            metadata,
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("product_id", sa.Integer, nullable=False),
            sa.Column("visible_price", sa.Integer),
            sa.Column("hidden_price", sa.Integer),
            sa.UniqueConstraint("product_id", name=name),
        )
        # Minimal pre-existing tables affected by the rest of this revision.
        for table_name in [
            "users",
            "customers",
            "master_products",
            "quotation_versions",
        ]:
            sa.Table(
                table_name, metadata, sa.Column("id", sa.Integer, primary_key=True)
            )
        metadata.create_all(connection)
        row = dict(id=1, product_id=7, visible_price=1990, hidden_price=2100)
        connection.execute(table.insert(), row)
        monkeypatch.setattr(
            revision, "op", Operations(MigrationContext.configure(connection))
        )
        revision.upgrade()
        assert dict(connection.execute(sa.select(table)).mappings().one()) == row
        connection.execute(table.insert(), {**row, "id": 2})
        assert not sa.inspect(connection).get_unique_constraints("price_conflicts")
        assert any(
            index["column_names"] == ["product_id"] and not index["unique"]
            for index in sa.inspect(connection).get_indexes("price_conflicts")
        )
    engine.dispose()


def test_postgres_ddl_uses_reflected_constraint_name(monkeypatch):
    statements = []
    connection = sa.create_mock_engine(
        "postgresql+psycopg://",
        lambda sql, *args, **kwargs: statements.append(
            str(sql.compile(dialect=connection.dialect))
        ),
    )

    class Inspector:
        def get_unique_constraints(self, table):
            assert table == "price_conflicts"
            return [
                {
                    "name": "price_conflicts_product_id_key",
                    "column_names": ["product_id"],
                }
            ]

    monkeypatch.setattr(revision.sa, "inspect", lambda bind: Inspector())
    monkeypatch.setattr(
        revision, "op", Operations(MigrationContext.configure(connection))
    )
    revision.upgrade()
    assert (
        "ALTER TABLE price_conflicts DROP CONSTRAINT price_conflicts_product_id_key"
        in statements
    )
    assert not any(
        "DROP CONSTRAINT uq_price_conflicts_product_id" in sql for sql in statements
    )


def test_fresh_database_full_initialization_and_repeat(tmp_path):
    root = Path(__file__).resolve().parents[2]
    database = tmp_path / "initialized.db"
    environment = {
        **os.environ,
        "APP_ENV": "development",
        "DATABASE_URL": f"sqlite:///{database.as_posix()}",
        "ADMIN_PASSWORD": "admin123",
        "SALES_PASSWORD": "sales123",
    }
    environment.pop("VERCEL", None)
    for _ in range(2):
        result = subprocess.run(
            [sys.executable, "-m", "backend.app.cli", "init"],
            cwd=root,
            env=environment,
            capture_output=True,
            text=True,
            timeout=60,
        )
        assert result.returncode == 0, result.stderr
    engine = sa.create_engine(environment["DATABASE_URL"])
    with engine.connect() as connection:
        assert {
            "settings",
            "login_attempts",
            "quotation_versions",
            "price_conflicts",
        } <= set(sa.inspect(connection).get_table_names())
        assert connection.scalar(sa.text("SELECT count(*) FROM users")) == 2
        assert connection.scalar(sa.text("SELECT count(*) FROM master_products")) > 0
    engine.dispose()
