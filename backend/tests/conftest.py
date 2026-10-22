from __future__ import annotations

import os
from types import SimpleNamespace

import pytest

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://attendance:attendance_dev_pw@localhost:5432/attendance_test",
)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["APP_ENV"] = "test"
os.environ["JWT_SECRET_KEY"] = "test-only-secret-key-with-more-than-32-chars"
os.environ["CORS_ORIGINS"] = "http://localhost:5173"
os.environ["ALLOW_PUBLIC_REGISTRATION"] = "true"
os.environ["COOKIE_SECURE"] = "false"
os.environ["COOKIE_SAMESITE"] = "lax"

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core.security import CSRF_COOKIE, CSRF_HEADER, hash_password  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import (  # noqa: E402
    ClassRoom,
    FacultyClassAssignment,
    Student,
    Subject,
    User,
)

TABLES = [
    "attendance_records",
    "attendance_sessions",
    "custom_list_entries",
    "custom_lists",
    "audit_logs",
    "app_settings",
    "subjects",
    "faculty_class_assignments",
    "students",
    "users",
    "classes",
]


@pytest.fixture(scope="session", autouse=True)
def schema():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def clean_database():
    with engine.begin() as connection:
        connection.execute(text(f"TRUNCATE {', '.join(TABLES)} RESTART IDENTITY CASCADE"))
    yield


@pytest.fixture()
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


def make_user(
    db,
    email: str,
    password: str = "Password@123",
    role: str = "faculty",
    full_name: str | None = None,
    student_id: int | None = None,
    is_active: bool = True,
) -> User:
    user = User(
        full_name=full_name or email.split("@")[0].title(),
        email=email,
        password_hash=hash_password(password),
        role=role,
        is_active=is_active,
        student_id=student_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def make_class(db, name: str = "III CSE", semester: int = 5) -> ClassRoom:
    class_ = ClassRoom(
        name=name,
        department="Computer Science",
        semester=semester,
        academic_year="2026-2027",
    )
    db.add(class_)
    db.commit()
    db.refresh(class_)
    return class_


def make_subject(db, class_: ClassRoom, name: str = "DBMS", code: str = "CS501") -> Subject:
    subject = Subject(name=name, subject_code=code, class_id=class_.id)
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject


def make_student(db, class_: ClassRoom, roll: str, name: str) -> Student:
    student = Student(roll_number=roll, full_name=name, class_id=class_.id)
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


@pytest.fixture()
def base_data(db):
    admin = make_user(db, "admin@test.edu", role="admin", full_name="Admin User")
    faculty = make_user(db, "faculty@test.edu", role="faculty", full_name="Faculty One")
    other_faculty = make_user(db, "other@test.edu", role="faculty", full_name="Faculty Two")
    class_one = make_class(db, "III CSE", 5)
    class_two = make_class(db, "II IT", 3)
    db.add_all(
        [
            FacultyClassAssignment(faculty_id=faculty.id, class_id=class_one.id),
            FacultyClassAssignment(faculty_id=other_faculty.id, class_id=class_two.id),
        ]
    )
    db.commit()
    subject_one = make_subject(db, class_one, "DBMS", "CS501")
    subject_two = make_subject(db, class_two, "Data Structures", "IT301")
    students = [
        make_student(db, class_one, "CS01", "Aarav Menon"),
        make_student(db, class_one, "CS02", "Ananya Krishnan"),
        make_student(db, class_one, "CS03", "Rohan D'Souza"),
        make_student(db, class_two, "IT01", "Dev Malhotra"),
    ]
    student_user = make_user(
        db,
        "student@test.edu",
        role="student",
        full_name=students[0].full_name,
        student_id=students[0].id,
    )
    return SimpleNamespace(
        admin=admin,
        faculty=faculty,
        other_faculty=other_faculty,
        student_user=student_user,
        class_one=class_one,
        class_two=class_two,
        subject_one=subject_one,
        subject_two=subject_two,
        students=students,
    )


def login(client: TestClient, email: str, password: str = "Password@123"):
    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    client.headers[CSRF_HEADER] = client.cookies[CSRF_COOKIE]
    return response.json()


def authed_client(client: TestClient, email: str, password: str = "Password@123"):
    login(client, email, password)
    return client
