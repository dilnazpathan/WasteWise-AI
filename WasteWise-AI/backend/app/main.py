"""WasteWise FastAPI application."""

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError

from app.api.v1.auth import router as auth_router
from app.core.config import settings
from app.db.session import SessionLocal
from app.models.user import User


logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    yield


app = FastAPI(title="WasteWise API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(auth_router, prefix="/api/v1")


@app.get("/healthz", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/v1/health/db", tags=["health"])
def test_database_connection() -> dict[str, str]:
    try:
        with SessionLocal() as session:
            session.execute(select(User.user_id).limit(0))
            session.execute(text("SELECT 1"))
    except SQLAlchemyError as error:
        logger.exception("SQL Server connection check failed")
        raise HTTPException(
            status_code=503,
            detail=(
                "Could not connect to SQL Server. Check backend/.env, the SQL Server "
                "service, ODBC Driver, and Windows account permissions."
            ),
        ) from error

    return {
        "status": "connected",
        "database": settings.db_name,
        "authentication": settings.db_authentication,
        "driver": settings.db_driver,
        "users_table": "dbo.Users",
    }