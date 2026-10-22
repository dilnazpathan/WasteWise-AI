"""Environment-backed backend configuration."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BACKEND_DIR / ".env")


def _get_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    normalized = value.strip().lower()
    if normalized in {"true", "1", "yes", "on"}:
        return True
    if normalized in {"false", "0", "no", "off"}:
        return False
    raise ValueError(f"{name} must be a boolean value")


def _get_origins() -> tuple[str, ...]:
    value = os.getenv(
        "BACKEND_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    )
    origins = tuple(origin.strip().rstrip("/") for origin in value.split(",") if origin.strip())
    if not origins or "*" in origins:
        raise ValueError("BACKEND_CORS_ORIGINS must contain explicit browser origins")
    return origins


@dataclass(frozen=True)
class Settings:
    db_server: str
    db_name: str
    db_driver: str
    db_authentication: str
    db_username: str
    db_password: str
    db_encrypt: bool
    db_trust_server_certificate: bool
    jwt_secret_key: str
    jwt_algorithm: str
    jwt_access_token_minutes: int
    cors_origins: tuple[str, ...]

    @classmethod
    def from_environment(cls) -> Settings:
        secret = os.getenv("JWT_SECRET_KEY", "").strip()
        if len(secret.encode("utf-8")) < 32 or secret.startswith("replace-with-"):
            raise ValueError(
                "Set JWT_SECRET_KEY in backend/.env to a random value of at least 32 bytes."
            )

        authentication = os.getenv("DB_AUTHENTICATION", "").strip().lower()
        if authentication not in {"windows", "sql"}:
            raise ValueError(
                "Set DB_AUTHENTICATION explicitly to 'windows' or 'sql' in backend/.env."
            )

        username = os.getenv("DB_USERNAME", "")
        password = os.getenv("DB_PASSWORD", "")
        if authentication == "sql" and (not username or not password):
            raise ValueError(
                "DB_USERNAME and DB_PASSWORD are required when DB_AUTHENTICATION=sql"
            )

        algorithm = os.getenv("JWT_ALGORITHM", "HS256").strip()
        if algorithm != "HS256":
            raise ValueError("JWT_ALGORITHM must be HS256")

        try:
            token_minutes = int(os.getenv("JWT_ACCESS_TOKEN_MINUTES", "30"))
        except ValueError as error:
            raise ValueError("JWT_ACCESS_TOKEN_MINUTES must be a positive integer") from error
        if token_minutes <= 0:
            raise ValueError("JWT_ACCESS_TOKEN_MINUTES must be a positive integer")

        return cls(
            db_server=os.getenv("DB_SERVER", "localhost").strip(),
            db_name=os.getenv("DB_NAME", "WasteWiseDB").strip(),
            db_driver=os.getenv("DB_DRIVER", "ODBC Driver 18 for SQL Server").strip(),
            db_authentication=authentication,
            db_username=username,
            db_password=password,
            db_encrypt=_get_bool("DB_ENCRYPT", True),
            db_trust_server_certificate=_get_bool(
                "DB_TRUST_SERVER_CERTIFICATE", True
            ),
            jwt_secret_key=secret,
            jwt_algorithm=algorithm,
            jwt_access_token_minutes=token_minutes,
            cors_origins=_get_origins(),
        )


settings = Settings.from_environment()