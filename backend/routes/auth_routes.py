from fastapi import APIRouter, Request
from controllers.auth_controller import auth_controller
from models.user_model import UserCreate, UserLogin
from utils.rate_limiter import rate_limiter

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register")
async def register(user_in: UserCreate, request: Request):
    rate_limiter.check(request, action_name="register", max_requests=5, window_seconds=600)
    return await auth_controller.register_user(user_in)


@router.post("/login")
async def login(credentials: UserLogin, request: Request):
    rate_limiter.check(request, action_name="login", max_requests=10, window_seconds=300)
    return await auth_controller.login_user(credentials)
