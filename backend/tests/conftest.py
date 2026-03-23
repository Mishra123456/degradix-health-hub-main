"""
Shared test fixtures for backend tests.
"""

import sys
import os
import pytest
from pathlib import Path

# Add backend dir to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, get_db
from app import app

# --------------------------------------------------
# TEST DATABASE (in-memory SQLite)
# --------------------------------------------------
TEST_DATABASE_URL = "sqlite:///./test_degradix.db"

test_engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session", autouse=True)
def setup_db():
    """Create tables before tests, drop after."""
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)
    # Clean up test db file
    db_path = Path("./test_degradix.db")
    if db_path.exists():
        db_path.unlink()


@pytest.fixture
def client():
    """FastAPI test client."""
    return TestClient(app)


@pytest.fixture
def sample_csv_path():
    """Path to a test CSV file."""
    return str(Path(__file__).resolve().parent.parent.parent / "test.csv")


@pytest.fixture
def sample_csv_file(sample_csv_path):
    """Open test CSV as file tuple for upload."""
    with open(sample_csv_path, "rb") as f:
        content = f.read()
    return ("file", ("test.csv", content, "text/csv"))


@pytest.fixture
def auth_token(client):
    """Register a test user and return auth token."""
    resp = client.post("/auth/register", json={
        "username": "testuser",
        "email": "test@example.com",
        "password": "testpass123",
    })
    if resp.status_code == 400:
        # User already exists, login instead
        resp = client.post("/auth/login", data={
            "username": "testuser",
            "password": "testpass123",
        })
    return resp.json()["access_token"]
