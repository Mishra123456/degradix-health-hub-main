"""
Tests for authentication endpoints.
"""


def test_register(client):
    """Test user registration."""
    resp = client.post("/auth/register", json={
        "username": "newuser",
        "email": "new@example.com",
        "password": "password123",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["username"] == "newuser"
    assert data["user"]["email"] == "new@example.com"


def test_register_duplicate_username(client):
    """Test that duplicate username fails."""
    # First registration
    client.post("/auth/register", json={
        "username": "dupuser",
        "email": "dup1@example.com",
        "password": "password123",
    })
    # Duplicate
    resp = client.post("/auth/register", json={
        "username": "dupuser",
        "email": "dup2@example.com",
        "password": "password123",
    })
    assert resp.status_code == 200
    assert "Username already taken" in resp.json()["error"]


def test_register_duplicate_email(client):
    """Test that duplicate email fails."""
    client.post("/auth/register", json={
        "username": "emailuser1",
        "email": "same@example.com",
        "password": "password123",
    })
    resp = client.post("/auth/register", json={
        "username": "emailuser2",
        "email": "same@example.com",
        "password": "password123",
    })
    assert resp.status_code == 200
    assert "Email already registered" in resp.json()["error"]


def test_login(client):
    """Test login with correct credentials."""
    # Register first
    client.post("/auth/register", json={
        "username": "loginuser",
        "email": "login@example.com",
        "password": "mypassword",
    })
    # Login
    resp = client.post("/auth/login", data={
        "username": "loginuser",
        "password": "mypassword",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["user"]["username"] == "loginuser"


def test_login_wrong_password(client):
    """Test login with wrong password."""
    client.post("/auth/register", json={
        "username": "wrongpwuser",
        "email": "wrongpw@example.com",
        "password": "correct",
    })
    resp = client.post("/auth/login", data={
        "username": "wrongpwuser",
        "password": "incorrect",
    })
    assert resp.status_code == 200
    assert "Incorrect username or password" in resp.json()["error"]


def test_me_authenticated(client, auth_token):
    """Test /auth/me with valid token."""
    resp = client.get("/auth/me", headers={
        "Authorization": f"Bearer {auth_token}"
    })
    assert resp.status_code == 200
    assert "username" in resp.json()


def test_me_unauthenticated(client):
    """Test /auth/me without token."""
    resp = client.get("/auth/me")
    assert resp.status_code == 200
    assert "Unauthorized" in resp.json()["error"]
