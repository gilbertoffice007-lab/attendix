from __future__ import annotations

from tests.conftest import authed_client

OPTIONS = [
    {"key": "paid", "label": "Paid", "color": "green"},
    {"key": "not_paid", "label": "Not Paid", "color": "red"},
    {"key": "pending", "label": "Pending", "color": "amber"},
]


def _create_list(client, base_data, title="November Exam Fees Paid List", visible=True, students=None):
    return client.post(
        "/api/v1/custom-lists",
        json={
            "title": title,
            "class_id": base_data.class_one.id,
            "description": "Tracking register only - not a payment gateway.",
            "status_options": OPTIONS,
            "visible_to_students": visible,
            "student_ids": (
                [student.id for student in students]
                if students is not None
                else [student.id for student in base_data.students[:3]]
            ),
        },
    )


def test_create_list_populates_and_prevents_duplicate_entries(client, base_data):
    authed_client(client, "faculty@test.edu")
    response = _create_list(client, base_data)
    assert response.status_code == 201, response.text
    item = response.json()
    assert item["entry_count"] == 3
    assert item["title"] == "November Exam Fees Paid List"
    assert item["creator_name"] == "Faculty One"
    assert all(entry["status"] == "paid" for entry in item["entries"])

    add_again = client.post(
        f"/api/v1/custom-lists/{item['id']}/entries",
        json={"student_ids": [student.id for student in base_data.students[:2]]},
    )
    assert add_again.status_code == 200
    assert add_again.json()["added"] == 0
    assert add_again.json()["skipped"] == 2

    add_new = client.post(
        f"/api/v1/custom-lists/{item['id']}/entries",
        json={"student_ids": [base_data.students[3].id]},
    )
    assert add_new.status_code == 400


def test_entry_status_updates_and_summary(client, base_data):
    authed_client(client, "faculty@test.edu")
    item = _create_list(client, base_data).json()
    entries = item["entries"]
    assert len(entries) == 3

    update = client.patch(
        f"/api/v1/custom-lists/{item['id']}/entries/{entries[0]['id']}",
        json={"status": "not_paid", "remarks": "Receipt not submitted"},
    )
    assert update.status_code == 200
    assert update.json()["status"] == "not_paid"
    assert update.json()["remarks"] == "Receipt not submitted"

    bulk = client.patch(
        f"/api/v1/custom-lists/{item['id']}/entries/bulk",
        json={
            "entry_ids": [entries[1]["id"]],
            "status": "not_paid",
            "remarks": "Bulk update",
        },
    )
    assert bulk.status_code == 200
    summary = bulk.json()
    assert summary["total"] == 3
    assert summary["counts"]["paid"] == 1
    assert summary["counts"]["not_paid"] == 2
    assert summary["percentages"]["not_paid"] == 66.67

    invalid = client.patch(
        f"/api/v1/custom-lists/{item['id']}/entries/{entries[0]['id']}",
        json={"status": "unknown"},
    )
    assert invalid.status_code == 400

    all_update = client.patch(
        f"/api/v1/custom-lists/{item['id']}/entries/bulk",
        json={"apply_to_all": True, "status": "pending"},
    )
    assert all_update.status_code == 200
    assert all_update.json()["counts"]["pending"] == 3


def test_list_update_rename_archive_and_status_option_guard(client, base_data):
    authed_client(client, "faculty@test.edu")
    item = _create_list(client, base_data).json()
    renamed = client.patch(
        f"/api/v1/custom-lists/{item['id']}",
        json={"title": "Semester Examination Fee Status", "description": None},
    )
    assert renamed.status_code == 200
    assert renamed.json()["title"] == "Semester Examination Fee Status"
    assert renamed.json()["description"] is None

    # Make an entry use a status that would be removed.
    client.patch(
        f"/api/v1/custom-lists/{item['id']}/entries/{item['entries'][0]['id']}",
        json={"status": "not_paid"},
    )
    guarded = client.patch(
        f"/api/v1/custom-lists/{item['id']}",
        json={"status_options": OPTIONS[:1]},
    )
    assert guarded.status_code == 422 or guarded.status_code == 400

    archived = client.patch(
        f"/api/v1/custom-lists/{item['id']}/archive", json={"is_archived": True}
    )
    assert archived.status_code == 200
    assert archived.json()["is_archived"] is True
    blocked = client.patch(
        f"/api/v1/custom-lists/{item['id']}/entries/bulk",
        json={"apply_to_all": True, "status": "paid"},
    )
    assert blocked.status_code == 409
    restored = client.patch(
        f"/api/v1/custom-lists/{item['id']}/archive", json={"is_archived": False}
    )
    assert restored.status_code == 200


def test_faculty_cannot_access_other_class_lists(client, base_data):
    authed_client(client, "faculty@test.edu")
    item = _create_list(client, base_data).json()
    client.post("/api/v1/auth/logout")

    authed_client(client, "other@test.edu")
    assert client.get(f"/api/v1/custom-lists/{item['id']}").status_code == 403
    assert client.get(f"/api/v1/custom-lists/{item['id']}/summary").status_code == 403
    assert client.get(f"/api/v1/custom-lists/{item['id']}/export").status_code == 403


def test_student_sees_only_permitted_own_status(client, base_data):
    authed_client(client, "faculty@test.edu")
    visible = _create_list(client, base_data, visible=True).json()
    hidden = _create_list(client, base_data, title="Private List", visible=False).json()
    # A visible list that does not include the student.
    partial = _create_list(
        client,
        base_data,
        title="Partially Populated List",
        visible=True,
        students=base_data.students[1:3],
    ).json()
    client.post("/api/v1/auth/logout")

    authed_client(client, "student@test.edu")
    lists = client.get("/api/v1/custom-lists/me").json()
    ids = {item["id"] for item in lists["items"]}
    assert visible["id"] in ids
    assert hidden["id"] not in ids
    assert partial["id"] not in ids
    mine = next(item for item in lists["items"] if item["id"] == visible["id"])
    assert mine["my_status"] == "paid"

    assert client.get(f"/api/v1/custom-lists/{visible['id']}").status_code == 200
    assert client.get(f"/api/v1/custom-lists/{hidden['id']}").status_code == 403
    assert client.get(f"/api/v1/custom-lists/{partial['id']}").status_code == 403
    detail = client.get(f"/api/v1/custom-lists/{visible['id']}").json()
    assert len(detail["entries"]) == 1
    assert detail["entries"][0]["student_id"] == base_data.students[0].id


def test_list_export_csv_and_xlsx(client, base_data):
    authed_client(client, "faculty@test.edu")
    item = _create_list(client, base_data).json()
    csv_response = client.get(
        f"/api/v1/custom-lists/{item['id']}/export?format=csv"
    )
    assert csv_response.status_code == 200
    assert "attachment" in csv_response.headers["content-disposition"]
    assert "november_exam_fees_paid_list" in csv_response.headers["content-disposition"]
    text = csv_response.content.decode("utf-8-sig")
    assert "Aarav Menon" in text
    assert "Paid" in text
    assert "november exam fees" in text.lower()

    xlsx_response = client.get(
        f"/api/v1/custom-lists/{item['id']}/export?format=xlsx"
    )
    assert xlsx_response.status_code == 200
    assert xlsx_response.content[:2] == b"PK"
    assert "spreadsheetml" in xlsx_response.headers["content-type"]
