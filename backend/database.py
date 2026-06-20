import datetime
from pathlib import Path
from sqlalchemy import create_engine, Column, Integer, Float, String, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Resolve db path relative to backend folder
BASE_DIR = Path(__file__).resolve().parent
DATABASE_URL = f"sqlite:///{BASE_DIR}/degradix.db"

engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class AnalysisHistory(Base):
    """
    Table to store the log of analysis runs.
    """
    __tablename__ = "analysis_history"

    id = Column(Integer, primary_key=True, index=True)
    health_score = Column(Float, nullable=False)
    predicted_rul = Column(Integer, nullable=False)
    reliability = Column(Float, nullable=False)
    risk_level = Column(String(20), nullable=False)
    filename = Column(String(255), nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

def get_db():
    """
    Dependency helper to acquire a DB session.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
