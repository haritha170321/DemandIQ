def test_register_and_login_flow(client):
    reg = client.post(
        "/api/auth/register",
        json={
            "email": "owner@demandiq.ai",
            "full_name": "Priya Sharma",
            "business_name": "Sharma Mart",
            "password": "SecurePassword99!",
            "currency": "INR",
        },
    )
    assert reg.status_code == 201
    data = reg.json()
    assert "access_token" in data
    assert data["user"]["email"] == "owner@demandiq.ai"

    # Duplicate email rejected
    dup = client.post(
        "/api/auth/register",
        json={
            "email": "owner@demandiq.ai",
            "full_name": "Priya Duplicate",
            "business_name": "Sharma Mart",
            "password": "SecurePassword99!",
        },
    )
    assert dup.status_code == 409

    # Login succeeds
    login = client.post(
        "/api/auth/login",
        json={"email": "owner@demandiq.ai", "password": "SecurePassword99!"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["business_name"] == "Sharma Mart"


def test_invalid_authentication(client):
    resp = client.get("/api/products")
    assert resp.status_code == 401

    bad_login = client.post(
        "/api/auth/login",
        json={"email": "missing@demandiq.ai", "password": "wrong"},
    )
    assert bad_login.status_code == 401
