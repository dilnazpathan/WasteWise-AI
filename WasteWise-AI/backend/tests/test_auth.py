"""Authentication API tests using an isolated in-memory SQLite database."""

from __future__ import annotations

import os
import sqlite3
from collections.abc import Generator
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

os.environ.setdefault(
    "JWT_SECRET_KEY", "test-only-secret-that-is-not-used-outside-this-process"
)

from app.db.base import Base  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.user import User  # noqa: E402


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Generator[TestClient, None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def attach_dbo(connection: sqlite3.Connection, _: object) -> None:
        connection.execute("ATTACH DATABASE ':memory:' AS dbo")
        connection.create_function(
            "sysdatetime", 0, lambda: datetime.now().isoformat(sep=" ")
        )

    Base.metadata.create_all(engine)
    test_session = sessionmaker(bind=engine, expire_on_commit=False)

    def override_get_db() -> Generator[Session, None, None]:
        with test_session() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    monkeypatch.setattr(
        "app.main.SessionLocal",
        lambda: test_session(),
    )
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    engine.dispose()


def test_register_login_and_access_current_user(client: TestClient) -> None:
    credentials = {
        "name": "  Alex Morgan  ",
        "email": "ALEX@example.com",
        "password": "fresh-produce-password",
    }
    registered = client.post("/api/v1/auth/register", json=credentials)
    assert registered.status_code == 201
    response = registered.json()
    assert response["user"]["name"] == "Alex Morgan"
    assert response["user"]["email"] == "alex@example.com"
    assert response["user"]["role"] == "store_manager"
    assert response["user"]["created_at"] is not None
    assert "password" not in response
    assert "password_hash" not in response["user"]
    assert response["access_token"]

    profile = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {response['access_token']}"},
    )
    assert profile.status_code == 200
    assert profile.json()["email"] == "alex@example.com"

    login = client.post(
        "/api/v1/auth/login",
        json={"email": "alex@example.com", "password": credentials["password"]},
    )
    assert login.status_code == 200
    assert login.json()["user"]["id"] == response["user"]["id"]


def test_reject_duplicate_registration_and_incorrect_password(
    client: TestClient,
) -> None:
    credentials = {
        "name": "Taylor",
        "email": "taylor@example.com",
        "password": "another-fresh-password",
    }
    assert client.post("/api/v1/auth/register", json=credentials).status_code == 201
    duplicate = client.post("/api/v1/auth/register", json=credentials)
    assert duplicate.status_code == 409

    login = client.post(
        "/api/v1/auth/login",
        json={"email": credentials["email"], "password": "incorrect-password"},
    )
    assert login.status_code == 401
    assert login.json()["detail"] == "Invalid email or password"


def test_require_valid_bearer_token(client: TestClient) -> None:
    assert client.get("/api/v1/auth/me").status_code == 401
    assert client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer invalid-token"},
    ).status_code == 401


def test_enforce_registration_password_length(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "name": "Jordan",
            "email": "jordan@example.com",
            "password": "short",
        },
    )
    assert response.status_code == 422


def test_database_connection_endpoint(client: TestClient) -> None:
    response = client.get("/api/v1/health/db")
    assert response.status_code == 200
    assert response.json()["status"] == "connected"
    assert response.json()["users_table"] == "dbo.Users"
