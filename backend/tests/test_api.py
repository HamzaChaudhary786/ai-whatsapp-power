import pytest
from fastapi.testclient import TestClient
from main import app
from utils.security import create_access_token, get_password_hash, verify_password

client = TestClient(app)


def test_health_check():
    """Verify health endpoint returns status healthy and MongoDB info."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "MongoDB"


def test_root_endpoint():
    """Verify root endpoint returns greeting."""
    response = client.get("/")
    assert response.status_code == 200
    assert "WhatsApp" in response.json()["message"]


def test_whatsapp_webhook_verification_success():
    """Verify valid Meta webhook handshake responds with echoed challenge."""
    challenge = "test_challenge_abc_123"
    response = client.get(
        f"/api/v1/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=my_secure_webhook_token&hub.challenge={challenge}"
    )
    assert response.status_code == 200
    assert response.text == challenge


def test_whatsapp_webhook_verification_failure():
    """Verify invalid token is rejected with 403 Forbidden."""
    response = client.get(
        "/api/v1/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=invalid_token_test&hub.challenge=123"
    )
    assert response.status_code == 403


def test_password_hashing():
    """Verify password hashing and verification."""
    password = "SuperSecurePassword123!"
    hashed = get_password_hash(password)
    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("WrongPassword", hashed) is False


def test_jwt_token_generation():
    """Verify JWT access token generation."""
    token = create_access_token({"sub": "user_id_123", "email": "test@example.com"})
    assert isinstance(token, str)
    assert len(token) > 20
