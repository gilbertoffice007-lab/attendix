from __future__ import annotations

from app.core.security import ACCESS_TOKEN_COOKIE, CSRF_COOKIE, CSRF_HEADER


def test_login_me_and_logout(client, base_data):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "faculty@test.edu", "password": "Password@123"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["role"] == "faculty"
    assert body["student"] is None
    assert ACCESS_TOKEN_COOKIE in response.cookies
    set_cookie = response.headers.get("set-cookie", "")
    assert "HttpOnly" in set_cookie
    assert response.headers["X-CSRF-Token"] == client.cookies[CSRF_COOKIE]

    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "faculty@test.edu"
    assert me.headers["X-CSRF-Token"] == client.cookies[CSRF_COOKIE]

    csrf = client.cookies[CSRF_COOKIE]
    client.headers[CSRF_HEADER] = csrf
    logout = client.post("/api/v1/auth/logout")
    assert logout.status_code == 200
    assert client.get("/api/v1/auth/me").status_code == 401


def test_first_admin_setup_runs_once(client):
    status = client.get("/api/v1/auth/setup-status")
    assert status.status_code == 200
    assert status.json()["setup_required"] is True

    created = client.post(
        "/api/v1/auth/setup",
        json={
            "full_name": "First Administrator",
            "email": "first.admin@test.edu",
            "password": "FirstAdmin1",
        },
    )
    assert created.status_code == 201
    assert created.json()["role"] == "admin"
    assert created.headers["X-CSRF-Token"] == client.cookies[CSRF_COOKIE]
    assert client.get("/api/v1/auth/me").status_code == 200
    assert client.get("/api/v1/auth/setup-status").json()["setup_required"] is False

    duplicate = client.post(
        "/api/v1/auth/setup",
        json={
            "full_name": "Another Administrator",
            "email": "second.admin@test.edu",
            "password": "SecondAdmin1",
        },
    )
    assert duplicate.status_code == 409


def test_student_self_registration_links_existing_roster(client, base_data):
    options = client.get("/api/v1/auth/student-registration")
    assert options.status_code == 200
    assert options.json()["enabled"] is True
    assert {item["id"] for item in options.json()["classes"]} == {
        base_data.class_one.id,
        base_data.class_two.id,
    }

    student = base_data.students[1]
    created = client.post(
        "/api/v1/auth/register/student",
        json={
            "full_name": student.full_name,
            "email": "self.registered@test.edu",
            "password": "Student123",
            "class_id": base_data.class_one.id,
            "roll_number": student.roll_number,
        },
    )
    assert created.status_code == 201, created.text
    assert created.json()["role"] == "student"
    assert created.json()["student"]["id"] == student.id
    assert created.headers["X-CSRF-Token"] == client.cookies[CSRF_COOKIE]

    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["student"]["roll_number"] == student.roll_number

    duplicate = client.post(
        "/api/v1/auth/register/student",
        json={
            "full_name": student.full_name,
            "email": "another.student@test.edu",
            "password": "Student123",
            "class_id": base_data.class_one.id,
            "roll_number": student.roll_number,
        },
    )
    assert duplicate.status_code == 409

    wrong_name = client.post(
        "/api/v1/auth/register/student",
        json={
            "full_name": "Wrong Name",
            "email": "wrong.name@test.edu",
            "password": "Student123",
            "class_id": base_data.class_one.id,
            "roll_number": base_data.students[2].roll_number,
        },
    )
    assert wrong_name.status_code == 400

    missing = client.post(
        "/api/v1/auth/register/student",
        json={
            "full_name": "Missing Student",
            "email": "missing.student@test.edu",
            "password": "Student123",
            "class_id": base_data.class_one.id,
            "roll_number": "UNKNOWN-99",
        },
    )
    assert missing.status_code == 404

    client.headers[CSRF_HEADER] = client.cookies[CSRF_COOKIE]
    client.post("/api/v1/auth/logout")
    client.headers.pop(CSRF_HEADER, None)

    student_portal = client.post(
        "/api/v1/auth/login",
        json={
            "email": "self.registered@test.edu",
            "password": "Student123",
            "portal": "student",
        },
    )
    assert student_portal.status_code == 200

    wrong_portal = client.post(
        "/api/v1/auth/login",
        json={
            "email": "self.registered@test.edu",
            "password": "Student123",
            "portal": "faculty",
        },
    )
    assert wrong_portal.status_code == 403


def test_login_rejects_bad_password_and_inactive_account(client, base_data, db):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "faculty@test.edu", "password": "WrongPassword1"},
    )
    assert response.status_code == 401

    base_data.faculty.is_active = False
    db.commit()
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "faculty@test.edu", "password": "Password@123"},
    )
    assert response.status_code == 403


def test_csrf_is_required_for_state_changing_requests(client, base_data):
    client.post(
        "/api/v1/auth/login",
        json={"email": "faculty@test.edu", "password": "Password@123"},
    )
    payload = {
        "roll_number": "CS99",
        "full_name": "CSRF Student",
        "class_id": base_data.class_one.id,
    }
    missing = client.post("/api/v1/students", json=payload)
    assert missing.status_code == 403
    assert "CSRF" in missing.json()["detail"]

    client.headers[CSRF_HEADER] = "wrong-token"
    wrong = client.post("/api/v1/students", json=payload)
    assert wrong.status_code == 403

    client.headers[CSRF_HEADER] = client.cookies[CSRF_COOKIE]
    allowed = client.post("/api/v1/students", json=payload)
    assert allowed.status_code == 201


def test_registration_creates_faculty_and_prevents_duplicate(client):
    response = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "New Faculty",
            "email": "new@test.edu",
            "password": "NewPassword1",
        },
    )
    assert response.status_code == 201
    assert response.json()["role"] == "faculty"
    assert client.get("/api/v1/auth/me").status_code == 200

    duplicate = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "New Faculty Again",
            "email": "NEW@test.edu",
            "password": "NewPassword1",
        },
    )
    assert duplicate.status_code == 409


def test_change_password_requires_current_password(client, base_data):
    client.post(
        "/api/v1/auth/login",
        json={"email": "faculty@test.edu", "password": "Password@123"},
    )
    client.headers[CSRF_HEADER] = client.cookies[CSRF_COOKIE]
    wrong = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "Nope12345", "new_password": "Changed12345"},
    )
    assert wrong.status_code == 400
    changed = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "Password@123", "new_password": "Changed12345"},
    )
    assert changed.status_code == 200
    client.post("/api/v1/auth/logout")
    logged_in = client.post(
        "/api/v1/auth/login",
        json={"email": "faculty@test.edu", "password": "Changed12345"},
    )
    assert logged_in.status_code == 200


def test_student_account_me_includes_linked_profile(client, base_data):
    client.post(
        "/api/v1/auth/login",
        json={"email": "student@test.edu", "password": "Password@123"},
    )
    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    profile = me.json()["student"]
    assert profile["roll_number"] == "CS01"
    assert profile["class_id"] == base_data.class_one.id
    assert me.json()["role"] == "student"
