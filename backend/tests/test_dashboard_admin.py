from __future__ import annotations

from app.db.session import SessionLocal
from tests.conftest import authed_client


def _one_finalized_session(client, base_data, statuses=("present", "absent", "present")):
    response = client.post(
        "/api/v1/attendance/sessions",
        json={
            "class_id": base_data.class_one.id,
            "subject_id": base_data.subject_one.id,
            "session_date": "2026-10-07",
            "session_number": 1,
        },
    )
    session = response.json()
    records = [
        {"student_id": student.id, "status": status}
        for student, status in zip(base_data.students[:3], statuses)
    ]
    client.put(
        f"/api/v1/attendance/sessions/{session['id']}/records",
        json={"records": records},
    )
    client.patch(
        f"/api/v1/attendance/sessions/{session['id']}/finalize",
        json={"is_finalized": True},
    )
    return session


def test_faculty_dashboard_uses_real_records(client, base_data):
    authed_client(client, "faculty@test.edu")
    _one_finalized_session(client, base_data, ("present", "absent", "present"))
    response = client.get("/api/v1/dashboard")
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "faculty"
    assert data["total_students"] == 3
    assert data["total_classes"] == 1
    assert data["session_count"] == 1
    assert data["finalized_session_count"] == 1
    assert data["threshold"] == 75
    assert data["average_percentage"] == 66.67
    assert data["low_attendance_count"] == 1
    assert data["low_attendance"][0]["full_name"] == "Ananya Krishnan"
    assert len(data["trend"]) == 1
    assert data["trend"][0]["percentage"] == 66.67
    assert data["faculty_count"] is None

    filtered = client.get(
        "/api/v1/dashboard", params={"class_id": base_data.class_one.id}
    )
    assert filtered.status_code == 200
    assert filtered.json()["scope_label"].startswith("III CSE")


def test_admin_dashboard_and_audit_visibility(client, base_data):
    authed_client(client, "admin@test.edu")
    _one_finalized_session(client, base_data)
    data = client.get("/api/v1/dashboard").json()
    assert data["role"] == "admin"
    assert data["total_classes"] == 2
    assert data["total_students"] == 4
    assert data["faculty_count"] == 2
    assert data["user_count"] == 4
    assert data["scope_label"] == "All classes"
    logs = client.get("/api/v1/audit-logs").json()
    assert logs["total"] > 0


def test_settings_threshold_validation_and_permissions(client, base_data):
    authed_client(client, "faculty@test.edu")
    current = client.get("/api/v1/settings")
    assert current.status_code == 200
    invalid = client.patch(
        "/api/v1/settings",
        json={
            "attendance_threshold": 101,
            "od_counts_as_attended": True,
            "leave_counts_as_attended": False,
        },
    )
    assert invalid.status_code == 422
    updated = client.patch(
        "/api/v1/settings",
        json={
            "attendance_threshold": 90,
            "od_counts_as_attended": True,
            "leave_counts_as_attended": True,
        },
    )
    assert updated.status_code == 200
    assert updated.json()["attendance_threshold"] == 90

    client.post("/api/v1/auth/logout")
    authed_client(client, "student@test.edu")
    assert client.get("/api/v1/settings").status_code == 403


def test_class_and_student_management_validation(client, base_data):
    authed_client(client, "admin@test.edu")
    duplicate_class = client.post(
        "/api/v1/classes",
        json={
            "name": "III CSE",
            "department": "Computer Science",
            "semester": 5,
            "academic_year": "2026-2027",
        },
    )
    assert duplicate_class.status_code == 409

    bad_semester = client.post(
        "/api/v1/classes",
        json={
            "name": "X",
            "department": "Y",
            "semester": 13,
            "academic_year": "2026-2027",
        },
    )
    assert bad_semester.status_code == 422

    base_data.students[0].is_active = False
    with SessionLocal() as db:
        from app.models import Student

        student = db.get(Student, base_data.students[0].id)
        student.is_active = False
        db.commit()
    inactive = client.get(
        "/api/v1/students", params={"is_active": False}
    ).json()
    assert any(item["roll_number"] == "CS01" for item in inactive["items"])

    duplicate_roll = client.post(
        "/api/v1/students",
        json={
            "roll_number": "CS01",
            "full_name": "Duplicate Roll",
            "class_id": base_data.class_one.id,
        },
    )
    assert duplicate_roll.status_code == 409


def test_csv_student_import(client, base_data):
    authed_client(client, "faculty@test.edu")
    csv_content = (
        "roll_number,full_name\n"
        "CS10,Imported One\n"
        "CS11,Imported Two\n"
        "CS01,Already Exists\n"
        "CS10,Duplicate In File\n"
        ",Missing Roll\n"
    )
    response = client.post(
        "/api/v1/students/import",
        data={"class_id": str(base_data.class_one.id)},
        files={"file": ("students.csv", csv_content.encode("utf-8"), "text/csv")},
    )
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["created"] == 2
    assert result["skipped"] == 2
    assert len(result["errors"]) == 2

    listed = client.get(
        "/api/v1/students", params={"class_id": base_data.class_one.id, "page_size": 50}
    ).json()
    rolls = {item["roll_number"] for item in listed["items"]}
    assert {"CS10", "CS11"} <= rolls

    bad_header = client.post(
        "/api/v1/students/import",
        data={"class_id": str(base_data.class_one.id)},
        files={"file": ("students.csv", b"name,roll\nA,B\n", "text/csv")},
    )
    assert bad_header.status_code == 400

    client.post("/api/v1/auth/logout")
    authed_client(client, "other@test.edu")
    forbidden = client.post(
        "/api/v1/students/import",
        data={"class_id": str(base_data.class_one.id)},
        files={"file": ("students.csv", csv_content.encode("utf-8"), "text/csv")},
    )
    assert forbidden.status_code == 403
