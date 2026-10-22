from __future__ import annotations

from tests.conftest import authed_client


def test_faculty_cannot_access_unassigned_class(client, base_data):
    authed_client(client, "faculty@test.edu")
    assert client.get(f"/api/v1/classes/{base_data.class_two.id}").status_code == 403
    assert (
        client.get(
            f"/api/v1/attendance/reports/summary?class_id={base_data.class_two.id}"
        ).status_code
        == 403
    )
    assert (
        client.get(f"/api/v1/classes/{base_data.class_two.id}/students").status_code
        == 403
    )
    assert (
        client.get(
            f"/api/v1/students?class_id={base_data.class_two.id}"
        ).status_code
        == 403
    )
    session = client.post(
        "/api/v1/attendance/sessions",
        json={
            "class_id": base_data.class_two.id,
            "subject_id": base_data.subject_two.id,
            "session_date": "2026-10-01",
            "session_number": 1,
        },
    )
    assert session.status_code == 403


def test_faculty_only_lists_assigned_classes_and_students(client, base_data):
    authed_client(client, "faculty@test.edu")
    classes = client.get("/api/v1/classes").json()
    assert [cls["id"] for cls in classes] == [base_data.class_one.id]
    students = client.get("/api/v1/students").json()
    rolls = {student["roll_number"] for student in students["items"]}
    assert rolls == {"CS01", "CS02", "CS03"}


def test_student_is_denied_staff_endpoints(client, base_data):
    authed_client(client, "student@test.edu")
    assert client.get("/api/v1/dashboard").status_code == 403
    assert client.get("/api/v1/students").status_code == 403
    assert client.get("/api/v1/attendance/sessions").status_code == 403
    assert (
        client.get(
            f"/api/v1/attendance/reports/summary?class_id={base_data.class_one.id}"
        ).status_code
        == 403
    )
    assert client.get("/api/v1/custom-lists").status_code == 403
    assert client.get("/api/v1/settings").status_code == 403
    assert client.get("/api/v1/audit-logs").status_code == 403
    assert client.get("/api/v1/users").status_code == 403
    create = client.post(
        "/api/v1/students",
        json={
            "roll_number": "HACK",
            "full_name": "Hacker",
            "class_id": base_data.class_one.id,
        },
    )
    assert create.status_code == 403


def test_student_can_only_read_own_records(client, base_data):
    authed_client(client, "student@test.edu")
    own = client.get("/api/v1/students/me")
    assert own.status_code == 200
    assert own.json()["roll_number"] == "CS01"
    own_report = client.get("/api/v1/attendance/reports/student/me")
    assert own_report.status_code == 200
    assert own_report.json()["student_id"] == base_data.students[0].id
    other_id = base_data.students[1].id
    assert client.get(f"/api/v1/attendance/reports/student/{other_id}").status_code == 403


def test_admin_manages_users_classes_and_assignments(client, base_data, db):
    authed_client(client, "admin@test.edu")
    created = client.post(
        "/api/v1/users",
        json={
            "full_name": "New Faculty",
            "email": "newfaculty@test.edu",
            "password": "Password@123",
            "role": "faculty",
        },
    )
    assert created.status_code == 201
    new_id = created.json()["id"]

    assignment = client.put(
        f"/api/v1/admin/faculty/{new_id}/classes",
        json={"class_ids": [base_data.class_one.id, base_data.class_two.id]},
    )
    assert assignment.status_code == 200
    assert set(assignment.json()["class_ids"]) == {
        base_data.class_one.id,
        base_data.class_two.id,
    }

    faculty_list = client.get("/api/v1/admin/faculty").json()
    target = next(item for item in faculty_list if item["id"] == new_id)
    assert target["class_labels"]

    duplicate_email = client.post(
        "/api/v1/users",
        json={
            "full_name": "Duplicate",
            "email": "newfaculty@test.edu",
            "password": "Password@123",
            "role": "faculty",
        },
    )
    assert duplicate_email.status_code == 409

    student_without_link = client.post(
        "/api/v1/users",
        json={
            "full_name": "Student Login",
            "email": "student2@test.edu",
            "password": "Password@123",
            "role": "student",
        },
    )
    assert student_without_link.status_code == 400


def test_admin_can_create_student_login_and_student_reads_own_data(client, base_data):
    authed_client(client, "admin@test.edu")
    student = base_data.students[1]
    response = client.post(
        f"/api/v1/students/{student.id}/account",
        json={"email": "ananya@test.edu", "password": "Password@123"},
    )
    assert response.status_code == 201
    assert response.json()["role"] == "student"

    client.post("/api/v1/auth/logout")
    authed_client(client, "ananya@test.edu")
    me = client.get("/api/v1/auth/me").json()
    assert me["student"]["roll_number"] == "CS02"
    assert client.get("/api/v1/students/me").json()["roll_number"] == "CS02"


def test_admin_only_endpoints_and_audit_logs(client, base_data):
    authed_client(client, "admin@test.edu")
    assert client.get("/api/v1/audit-logs").status_code == 200
    assert client.get("/api/v1/admin/faculty").status_code == 200

    client.post("/api/v1/auth/logout")
    authed_client(client, "faculty@test.edu")
    assert client.get("/api/v1/audit-logs").status_code == 403
    assert client.get("/api/v1/admin/faculty").status_code == 403


def test_admin_cannot_deactivate_last_admin(client, base_data):
    authed_client(client, "admin@test.edu")
    response = client.patch(
        f"/api/v1/users/{base_data.admin.id}",
        json={"is_active": False},
    )
    assert response.status_code == 400
