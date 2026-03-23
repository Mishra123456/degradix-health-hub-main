"""
JWT authentication module.
Endpoints: /auth/register, /auth/login, /auth/me
"""

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from database import get_db, User

# --------------------------------------------------
# CONFIG
# --------------------------------------------------
SECRET_KEY = "degradix-secret-key-change-in-production-2024"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# --------------------------------------------------
# UTILS
# --------------------------------------------------
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

router = APIRouter(prefix="/auth", tags=["Authentication"])


# --------------------------------------------------
# SCHEMAS
# --------------------------------------------------
class UserRegister(BaseModel):
    username: str
    email: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


# --------------------------------------------------
# HELPERS
# --------------------------------------------------
def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user


# --------------------------------------------------
# ENDPOINTS
# --------------------------------------------------
from fastapi import Header

@router.post("/register")
def register(data: UserRegister, db: Session = Depends(get_db)):
    # Check duplicates
    if db.query(User).filter(User.username == data.username).first():
        return {"error": "Username already taken"}
    if db.query(User).filter(User.email == data.email).first():
        return {"error": "Email already registered"}

    user = User(
        username=data.username,
        email=data.email,
        hashed_password=hash_password(data.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": UserResponse.model_validate(user).dict(),
    }


@router.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        return {"error": "Incorrect username or password"}

    token = create_access_token({"sub": str(user.id)})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": UserResponse.model_validate(user).dict(),
    }


from fastapi import Request

@router.get("/me")
def me(request: Request, db: Session = Depends(get_db)):
    auth_header = request.headers.get("authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return {"error": "Unauthorized no header"}
    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is not None:
            # Force cast to int because SQLite requires integer for PK matches
            user_id = int(str(user_id))
            user = db.query(User).filter(User.id == user_id).first()
            if user:
                return UserResponse.model_validate(user).dict()
    except Exception:
        pass
    return {"error": "Unauthorized invalid token"}
