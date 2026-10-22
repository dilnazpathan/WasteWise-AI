"""SQLAlchemy engine and request-scoped session dependency."""

from collections.abc import Generator

from sqlalchemy import URL, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings


def _odbc_value(value: str) -> str:
    return "{" + value.replace("}", "}}") + "}"


def _connection_url() -> URL:
    parts = [
        f"DRIVER={_odbc_value(settings.db_driver)}",
        f"SERVER={_odbc_value(settings.db_server)}",
        f"DATABASE={_odbc_value(settings.db_name)}",
        f"Encrypt={'yes' if settings.db_encrypt else 'no'}",
        "TrustServerCertificate="
        + ("yes" if settings.db_trust_server_certificate else "no"),
    ]
    if settings.db_authentication == "windows":
        parts.append("Trusted_Connection=yes")
    else:
        parts.extend(
            [
                f"UID={_odbc_value(settings.db_username)}",
                f"PWD={_odbc_value(settings.db_password)}",
            ]
        )
    return URL.create("mssql+pyodbc", query={"odbc_connect": ";".join(parts)})


engine = create_engine(
    _connection_url(),
    pool_pre_ping=True,
    pool_recycle=1800,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()