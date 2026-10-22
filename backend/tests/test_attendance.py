from __future__ import annotations

from tests.conftest import authed_client


def _create_session(client, base_data, session_number=1, session_date="2026-10-01", subject=None):
    return client.post(
        "/api/v1/attendance/sessions",
        json={
            "class_id": base_data.class_one.id,
            "subject_id": (subject or base_data.subject_one).id,
            "session_date": session_date,
            "session_number": session_number,
        },
    )


def _save_all(client, session_id, statuses, remarks=None):
    records = [
        {"student_id": student_id, "status": status, "remarks": (remarks or {}).get(student_id)}
        for student_id, status in statuses.items()
    ]
    return client.put(
        f"/api/v1/attendance/sessions/{session_id}/records",
        json={"records": records},
    )


def test_new_session_is_unmarked_and_duplicate_is_prevented(client, base_data):
    authed_client(client, "faculty@test.edu")
    response = _create_session(client, base_data)
    assert response.status_code == 201
    body = response.json()
    assert body["counts"]["total"] == 0
    assert len(body["entries"]) == 3
    assert all(entry["status"] is None for entry in body["entries"])

    duplicate = _create_session(client, base_data)
    assert duplicate.status_code == 409


def test_save_finalize_and_percentage_calculation(client, base_data):
    authed_client(client, "faculty@test.edu")
    session = _create_session(client, base_data).json()
    session_id = session["id"]
    s1, s2, s3 = [student.id for student in base_data.students[:3]]

    partial = _save_all(client, session_id, {s1: "present", s2: "absent"})
    assert partial.status_code == 200
    assert partial.json()["counts"]["present"] == 1
    assert partial.json()["counts"]["absent"] == 1
    assert partial.json()["counts"]["unmarked"] == 0

    cannot_finalize = client.patch(
        f"/api/v1/attendance/sessions/{session_id}/finalize",
        json={"is_finalized": True},
    )
    assert cannot_finalize.status_code == 400
    assert "Missing" in cannot_finalize.json()["detail"]

    saved = _save_all(client, session_id, {s1: "present", s2: "absent", s3: "present"})
    assert saved.status_code == 200
    assert saved.json()["counts"]["total"] == 3

    finalized = client.patch(
        f"/api/v1/attendance/sessions/{session_id}/finalize",
        json={"is_finalized": True},
    )
    assert finalized.status_code == 200
    assert finalized.json()["is_finalized"] is True

    summary = client.get(
        f"/api/v1/attendance/reports/summary?class_id={base_data.class_one.id}"
    )
    assert summary.status_code == 200
    data = summary.json()
    assert data["total_students"] == 3
    assert data["finalized_sessions"] == 1
    rows = {row["student_id"]: row for row in data["students"]}
    assert rows[s1]["percentage"] == 100.0
    assert rows[s2]["percentage"] == 0.0
    assert rows[s3]["percentage"] == 100.0
    assert data["average_percentage"] == 66.67
    assert data["low_attendance_count"] == 1
    assert rows[s2]["below_threshold"] is True

    locked = _save_all(client, session_id, {s1: "absent"})
    assert locked.status_code == 409

    unlocked = client.patch(
        f"/api/v1/attendance/sessions/{session_id}/finalize",
        json={"is_finalized": False},
    )
    assert unlocked.status_code == 403


def test_unfinalized_sessions_are_excluded_from_denominator(client, base_data):
    authed_client(client, "faculty@test.edu")
    s1, s2, s3 = [student.id for student in base_data.students[:3]]
    first = _create_session(client, base_data, 1, "2026-10-01").json()
    _save_all(client, first["id"], {s1: "present", s2: "present", s3: "present"})
    client.patch(
        f"/api/v1/attendance/sessions/{first['id']}/finalize",
        json={"is_finalized": True},
    )

    second = _create_session(client, base_data, 2, "2026-10-02").json()
    _save_all(client, second["id"], {s1: "absent", s2: "present", s3: "present"})

    summary = client.get(
        f"/api/v1/attendance/reports/summary?class_id={base_data.class_one.id}"
    ).json()
    assert summary["finalized_sessions"] == 1
    assert all(row["eligible"] == 1 for row in summary["students"])
    assert all(row["percentage"] == 100.0 for row in summary["students"])

    client.patch(
        f"/api/v1/attendance/sessions/{second['id']}/finalize",
        json={"is_finalized": True},
    )
    summary = client.get(
        f"/api/v1/attendance/reports/summary?class_id={base_data.class_one.id}"
    ).json()
    rows = {row["student_id"]: row for row in summary["students"]}
    assert rows[s1]["eligible"] == 2
    assert rows[s1]["percentage"] == 50.0
    assert summary["finalized_sessions"] == 2
    assert summary["low_attendance_count"] == 1


def test_admin_can_unlock_session_and_corrections_are_audited(client, base_data):
    authed_client(client, "faculty@test.edu")
    s1, s2, s3 = [student.id for student in base_data.students[:3]]
    session = _create_session(client, base_data).json()
    _save_all(client, session["id"], {s1: "present", s2: "present", s3: "present"})
    client.patch(
        f"/api/v1/attendance/sessions/{session['id']}/finalize",
        json={"is_finalized": True},
    )
    client.post("/api/v1/auth/logout")

    authed_client(client, "admin@test.edu")
    unlocked = client.patch(
        f"/api/v1/attendance/sessions/{session['id']}/finalize",
        json={"is_finalized": False},
    )
    assert unlocked.status_code == 200
    corrected = _save_all(
        client,
        session["id"],
        {s1: "absent", s2: "present", s3: "present"},
        remarks={s1: "Medical leave verified"},
    )
    assert corrected.status_code == 200

    logs = client.get(
        "/api/v1/audit-logs", params={"entity_type": "attendance_record", "page_size": 50}
    )
    assert logs.status_code == 200
    actions = [item["action"] for item in logs.json()["items"]]
    assert "corrected" in actions
    assert any(item["previous_value"] for item in logs.json()["items"])


def test_attendance_policy_controls_od_and_leave(client, base_data):
    authed_client(client, "faculty@test.edu")
    s1, s2, s3 = [student.id for student in base_data.students[:3]]
    session = _create_session(client, base_data).json()
    _save_all(client, session["id"], {s1: "od", s2: "leave", s3: "present"})
    client.patch(
        f"/api/v1/attendance/sessions/{session['id']}/finalize",
        json={"is_finalized": True},
    )

    summary = client.get(
        f"/api/v1/attendance/reports/summary?class_id={base_data.class_one.id}"
    ).json()
    rows = {row["student_id"]: row for row in summary["students"]}
    assert rows[s1]["percentage"] == 100.0
    assert rows[s2]["percentage"] == 0.0

    update = client.patch(
        "/api/v1/settings",
        json={
            "attendance_threshold": 80,
            "od_counts_as_attended": False,
            "leave_counts_as_attended": True,
        },
    )
    assert update.status_code == 200
    summary = client.get(
        f"/api/v1/attendance/reports/summary?class_id={base_data.class_one.id}"
    ).json()
    rows = {row["student_id"]: row for row in summary["students"]}
    assert rows[s1]["percentage"] == 0.0
    assert rows[s2]["percentage"] == 100.0
    assert summary["threshold"] == 80


def test_zero_session_summary_has_no_division_error(client, base_data):
    authed_client(client, "admin@test.edu")
    response = client.get(
        f"/api/v1/attendance/reports/summary?class_id={base_data.class_two.id}"
    )
    assert response.status_code == 200
    data = response.json()
    assert data["finalized_sessions"] == 0
    assert data["average_percentage"] == 0.0
    assert data["students"][0]["percentage"] == 0.0
    assert data["students"][0]["below_threshold"] is False


def test_attendance_validation_and_permissions(client, base_data):
    authed_client(client, "faculty@test.edu")
    session = _create_session(client, base_data).json()
    invalid_status = client.put(
        f"/api/v1/attendance/sessions/{session['id']}/records",
        json={"records": [{"student_id": base_data.students[0].id, "status": "late"}]},
    )
    assert invalid_status.status_code == 422

    other_student = base_data.students[3].id
    wrong_class = client.put(
        f"/api/v1/attendance/sessions/{session['id']}/records",
        json={"records": [{"student_id": other_student, "status": "present"}]},
    )
    assert wrong_class.status_code == 400

    future = client.post(
        "/api/v1/attendance/sessions",
        json={
            "class_id": base_data.class_one.id,
            "subject_id": base_data.subject_one.id,
            "session_date": "2099-01-01",
            "session_number": 2,
        },
    )
    assert future.status_code == 400

    mismatch = client.post(
        "/api/v1/attendance/sessions",
        json={
            "class_id": base_data.class_one.id,
            "subject_id": base_data.subject_two.id,
            "session_date": "2026-10-01",
            "session_number": 3,
        },
    )
    assert mismatch.status_code == 400

    reversed_dates = client.get(
        f"/api/v1/attendance/reports/summary?class_id={base_data.class_one.id}"
        "&date_from=2026-10-10&date_to=2026-10-01"
    )
    assert reversed_dates.status_code == 400


def test_student_report_and_history_access(client, base_data):
    authed_client(client, "faculty@test.edu")
    s1, s2, s3 = [student.id for student in base_data.students[:3]]
    session = _create_session(client, base_data).json()
    _save_all(client, session["id"], {s1: "present", s2: "absent", s3: "od"})
    client.patch(
        f"/api/v1/attendance/sessions/{session['id']}/finalize",
        json={"is_finalized": True},
    )

    report = client.get(f"/api/v1/attendance/reports/student/{s1}")
    assert report.status_code == 200
    data = report.json()
    assert data["percentage"] == 100.0
    assert data["subjects"][0]["subject_name"] == "DBMS"
    assert data["history"][0]["status"] == "present"

    history = client.get(
        "/api/v1/attendance/reports/history",
        params={"class_id": base_data.class_one.id, "status": "absent"},
    )
    assert history.status_code == 200
    assert history.json()["total"] == 1
    assert history.json()["items"][0]["student_id"] == s2

    client.post("/api/v1/auth/logout")
    authed_client(client, "student@test.edu")
    assert client.get(f"/api/v1/attendance/reports/student/{s1}").status_code == 200
    assert client.get(f"/api/v1/attendance/reports/student/{s2}").status_code == 403
