"""Cloud-side database setup. Team members never run installation commands."""

import os
import subprocess
import sys


def main():
    if os.getenv("CASA_INITIALIZE_DATABASE") != "true":
        print("Database initialization disabled. Existing database will be used.")
        return
    if os.getenv("VERCEL_ENV") != "production":
        raise RuntimeError(
            "Database initialization is allowed only in production builds."
        )
    if os.getenv("APP_ENV") != "production":
        raise RuntimeError("APP_ENV must be production for cloud initialization.")

    from sqlalchemy import create_engine, text
    from sqlalchemy.pool import NullPool
    from .config import normalize_database_url

    direct_url = normalize_database_url(os.getenv("DIRECT_DATABASE_URL", ""))
    if not direct_url.startswith("postgresql+psycopg://"):
        raise RuntimeError(
            "Set DIRECT_DATABASE_URL to the unpooled PostgreSQL URL for migrations."
        )
    # Session advisory locks and migrations need a direct connection; transaction
    # poolers used for runtime requests do not guarantee session lock ownership.
    engine = create_engine(direct_url, poolclass=NullPool)
    # Serialize migrations/imports if two deployment builds overlap. The child
    # uses its own connections; this session holds the lock until it completes.
    with engine.connect() as connection:
        connection.execute(text("SELECT pg_advisory_lock(730031026)"))
        try:
            subprocess.run(
                [sys.executable, "-m", "backend.app.cli", "init"],
                check=True,
                env={**os.environ, "DATABASE_URL": direct_url},
            )
        finally:
            connection.execute(text("SELECT pg_advisory_unlock(730031026)"))
    print("Database migrations and preserved source imports completed.")


if __name__ == "__main__":
    main()
