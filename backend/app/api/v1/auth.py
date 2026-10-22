from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.deps import get_current_user
from app.core.security import (
    CSRF_COOKIE,
    clear_auth_cookies,
    create_access_token,
    generate_csrf_token,
    hash_password,
    set_auth_cookies,
    set_csrf_cookie,
    verify_password,
)
from app.db.session import get_db
from app.models import ClassRoom, Student, User
from app.schemas.auth import (
    ChangePasswordRequest,
    CurrentUser,
    LoginRequest,
    RegisterRequest,
    SetupStatus,
    StudentRegisterRequest,
    StudentRegistrationOptions,
)
from app.schemas.class_ import ClassBrief
from app.schemas.common import Message
from app.services.audit import record_audit
from app.services.presenters import current_user_out

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _load_user(db: Session, user_id: int) -> User | None:
    return db.scalars(
        select(User)
        .options(joinedload(User.student).joinedload(Student.class_))
        .where(User.id == user_id)
    ).first()


def _normalize_name(value: str) -> str:
    return " ".join(value.split()).casefold()


def _active_admin_count(db: Session) -> int:
    return int(
        db.scalar(
            select(func.count(User.id)).where(
                User.role == "admin", User.is_active.is_(True)
            )
        )
        or 0
    )


@router.get("/setup-status", response_model=SetupStatus)
def setup_status(db: Session = Depends(get_db)):
    return SetupStatus(
        setup_required=_active_admin_count(db) == 0,
        registration_enabled=settings.allow_public_registration,
    )


@router.get("/student-registration", response_model=StudentRegistrationOptions)
def student_registration_options(db: Session = Depends(get_db)):
    classes = db.scalars(
        select(ClassRoom).order_by(
            ClassRoom.department, ClassRoom.semester, ClassRoom.name
        )
    ).all()
    return StudentRegistrationOptions(
        enabled=settings.allow_public_registration,
        classes=[
            ClassBrief(
                id=class_.id,
                name=class_.name,
                department=class_.department,
                semester=class_.semester,
                academic_year=class_.academic_year,
            )
            for class_ in classes
        ],
    )


@router.post("/setup", response_model=CurrentUser, status_code=201)
def setup(payload: RegisterRequest, response: Response, db: Session = Depends(get_db)):
    """Create the initial administrator once, before any admin exists."""
    db.execute(text("SELECT pg_advisory_xact_lock(740913)"))
    if _active_admin_count(db):
        raise HTTPException(
            status_code=409,
            detail="Setup is already complete. Sign in or ask an administrator for an account.",
        )
    email = payload.email.lower().strip()
    existing = db.scalar(select(User).where(func.lower(User.email) == email))
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = User(
        full_name=payload.full_name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        role="admin",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    record_audit(
        db,
        user,
        "user",
        user.id,
        "initial_admin",
        new_value={"email": email, "role": "admin"},
    )
    db.commit()
    loaded = _load_user(db, user.id)
    assert loaded is not None
    token = create_access_token(loaded.id)
    csrf_token = generate_csrf_token()
    set_auth_cookies(response, token, csrf_token)
    response.headers["X-CSRF-Token"] = csrf_token
    return CurrentUser(**current_user_out(loaded))


@router.post("/register", response_model=CurrentUser, status_code=201)
def register(
    payload: RegisterRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    if not settings.allow_public_registration:
        raise HTTPException(
            status_code=403,
            detail="Public registration is disabled. Ask an administrator for an account.",
        )
    email = payload.email.lower().strip()
    existing = db.scalar(select(User).where(func.lower(User.email) == email))
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = User(
        full_name=payload.full_name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        role="faculty",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    record_audit(db, user, "user", user.id, "registered", new_value={"email": email, "role": "faculty"})
    db.commit()
    loaded = _load_user(db, user.id)
    assert loaded is not None
    token = create_access_token(loaded.id)
    csrf_token = generate_csrf_token()
    set_auth_cookies(response, token, csrf_token)
    response.headers["X-CSRF-Token"] = csrf_token
    return CurrentUser(**current_user_out(loaded))


@router.post("/register/student", response_model=CurrentUser, status_code=201)
def register_student(
    payload: StudentRegisterRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    if not settings.allow_public_registration:
        raise HTTPException(
            status_code=403,
            detail="Student registration is disabled. Ask your teacher or administrator.",
        )
    email = payload.email.lower().strip()
    existing = db.scalar(select(User).where(func.lower(User.email) == email))
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    student = db.scalars(
        select(Student)
        .where(
            Student.class_id == payload.class_id,
            func.lower(Student.roll_number) == payload.roll_number.strip().lower(),
        )
        .with_for_update()
    ).first()
    if not student:
        raise HTTPException(
            status_code=404,
            detail=(
                "No student found for that class and registration number. "
                "Ask your teacher to add you to the class first."
            ),
        )
    if not student.is_active:
        raise HTTPException(
            status_code=403,
            detail="This student record is inactive. Contact your teacher or administrator.",
        )
    if student.user_account is not None:
        raise HTTPException(
            status_code=409,
            detail="This student already has a portal account. Sign in or reset it with an administrator.",
        )
    if _normalize_name(student.full_name) != _normalize_name(payload.full_name):
        raise HTTPException(
            status_code=400,
            detail="The name does not match the class roster. Use the name your teacher added.",
        )

    user = User(
        full_name=student.full_name,
        email=email,
        password_hash=hash_password(payload.password),
        role="student",
        is_active=True,
        student_id=student.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    record_audit(
        db,
        user,
        "user",
        user.id,
        "student_registered",
        new_value={
            "email": email,
            "student_id": student.id,
            "class_id": student.class_id,
        },
    )
    db.commit()

    loaded = _load_user(db, user.id)
    assert loaded is not None
    token = create_access_token(loaded.id)
    csrf_token = generate_csrf_token()
    set_auth_cookies(response, token, csrf_token)
    response.headers["X-CSRF-Token"] = csrf_token
    return CurrentUser(**current_user_out(loaded))


@router.post("/login", response_model=CurrentUser)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    email = payload.email.lower().strip()
    user = db.scalars(
        select(User)
        .options(joinedload(User.student).joinedload(Student.class_))
        .where(func.lower(User.email) == email)
    ).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="This account is inactive. Contact an administrator.",
        )
    if payload.portal == "student" and user.role != "student":
        raise HTTPException(
            status_code=403,
            detail="This is not a student account. Use the correct sign-in page.",
        )
    if payload.portal == "faculty" and user.role != "faculty":
        raise HTTPException(
            status_code=403,
            detail="This is not a teacher account. Use the correct sign-in page.",
        )
    token = create_access_token(user.id)
    csrf_token = generate_csrf_token()
    set_auth_cookies(response, token, csrf_token)
    response.headers["X-CSRF-Token"] = csrf_token
    return CurrentUser(**current_user_out(user))


@router.post("/logout", response_model=Message)
def logout(response: Response):
    clear_auth_cookies(response)
    return Message(message="Signed out")


@router.get("/me", response_model=CurrentUser)
def me(
    request: Request,
    response: Response,
    user: User = Depends(get_current_user),
):
    csrf_token = request.cookies.get(CSRF_COOKIE)
    if not csrf_token:
        csrf_token = generate_csrf_token()
        set_csrf_cookie(response, csrf_token)
    response.headers["X-CSRF-Token"] = csrf_token
    return CurrentUser(**current_user_out(user))


@router.post("/change-password", response_model=Message)
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    user.password_hash = hash_password(payload.new_password)
    record_audit(db, user, "user", user.id, "password_changed")
    db.commit()
    return Message(message="Password updated successfully")
