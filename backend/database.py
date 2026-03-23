"""
SQLite database setup with SQLAlchemy.
Models: User, AnalysisHistory
"""

from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

DATABASE_URL = "sqlite:///./degradix.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# --------------------------------------------------
# MODELS
# --------------------------------------------------
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    analyses = relationship("AnalysisHistory", back_populates="user")


class AnalysisHistory(Base):
    __tablename__ = "analysis_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    summary = Column(Text, nullable=True)  # JSON string

    user = relationship("User", back_populates="analyses")


# --------------------------------------------------
# DB DEPENDENCY
# --------------------------------------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables."""
    Base.metadata.create_all(bind=engine)
