from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from .config import DATABASE_URL

engine = create_engine(
    DATABASE_URL,
    connect_args=(
        {"check_same_thread": False, "timeout": 30}
        if DATABASE_URL.startswith("sqlite")
        else {}
    ),
    pool_pre_ping=True,
)
if DATABASE_URL.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def pragmas(conn, _):
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("PRAGMA journal_mode=WAL")


SessionLocal = sessionmaker(engine, expire_on_commit=False)


def get_db():
    with SessionLocal() as db:
        try:
            yield db
        except Exception:
            db.rollback()
            raise
