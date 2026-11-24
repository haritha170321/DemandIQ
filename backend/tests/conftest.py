import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Configure isolated test environment before importing app
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_demandiq.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-demandiq-suite")

from app.database import Base, get_db
from app.main import app

TEST_DB_URL = "sqlite:///./test_demandiq.db"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(client):
    resp = client.post(
        "/api/auth/register",
        json={
            "email": "tester@demandiq.ai",
            "full_name": "Test Operator",
            "business_name": "Test Retail",
            "password": "StrongPassword123!",
            "currency": "INR",
        },
    )
    assert resp.status_code == 201
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
