"""ORM mapping for the existing dbo.Users table."""

from datetime import datetime

from sqlalchemy import DateTime, Identity, Integer, Unicode, text
from sqlalchemy.dialects.mssql import DATETIME2
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class User(Base):
    __tablename__ = "Users"
    __table_args__ = {"schema": "dbo"}

    user_id: Mapped[int] = mapped_column(
        "UserID", Integer, Identity(start=1, increment=1), primary_key=True
    )
    name: Mapped[str] = mapped_column("Name", Unicode(100), nullable=False)
    email: Mapped[str] = mapped_column(
        "Email", Unicode(150), nullable=False, unique=True
    )
    password_hash: Mapped[str] = mapped_column(
        "PasswordHash", Unicode(255), nullable=False
    )
    role: Mapped[str] = mapped_column(
        "Role",
        Unicode(30),
        nullable=False,
        server_default=text("('store_manager')"),
    )
    created_at: Mapped[datetime | None] = mapped_column(
        "CreatedAt",
        DATETIME2().with_variant(DateTime(), "sqlite"),
        nullable=True,
        server_default=text("(sysdatetime())"),
    )