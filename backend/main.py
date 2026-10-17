from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from config.settings import settings
from db.mongodb import close_mongo_connection, connect_to_mongo
from routes.ai_routes import router as ai_router
from routes.audit_routes import router as audit_router
from routes.auth_routes import router as auth_router
from routes.conversation_routes import router as conversation_router
from routes.category_routes import router as category_router
from routes.customer_routes import router as customer_router
from routes.faq_routes import router as faq_router
from routes.model_version_routes import router as model_version_router
from routes.order_routes import router as order_router
from routes.product_routes import router as product_router
from routes.user_routes import router as user_router
from routes.whatsapp_routes import router as whatsapp_router
from routes.campaign_routes import router as campaign_router
from routes.courier_routes import router as courier_router
from routes.coupon_routes import router as coupon_router
from routes.review_routes import router as review_router
from controllers.coupon_controller import coupon_controller
from controllers.review_controller import review_controller


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Connect to MongoDB
    await connect_to_mongo()
    try:
        await coupon_controller.seed_default_coupons()
        await review_controller.seed_default_reviews()
    except Exception as e:
        print(f"[WARNING] Seed error: {e}")
    yield
    # Shutdown: Close MongoDB connection
    await close_mongo_connection()


app = FastAPI(
    title=settings.APP_NAME,
    description="WhatsApp Fashion AI Assistant with MongoDB, FastAPI, and ML",
    version="1.0.0",
    lifespan=lifespan,
)

# Security Headers Middleware (OWASP recommended)
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


# Hardened CORS Middleware (Supports localhost, 127.0.0.1, ngrok tunnels, and Vercel deployments with credentials)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|.*\.ngrok(-free)?\.app|.*\.ngrok\.io|.*\.vercel\.app)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, HTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    import traceback
    print(f"[ERROR] Uncaught exception at {request.url.path}: {exc}")
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={
            "detail": f"Database / Server Error: {str(exc)}",
            "error_type": type(exc).__name__,
            "path": str(request.url.path),
        },
    )

# Include All Routers under /api/v1
app.include_router(auth_router, prefix="/api/v1")
app.include_router(user_router, prefix="/api/v1")
app.include_router(category_router, prefix="/api/v1")
app.include_router(customer_router, prefix="/api/v1")
app.include_router(product_router, prefix="/api/v1")
app.include_router(order_router, prefix="/api/v1")
app.include_router(conversation_router, prefix="/api/v1")
app.include_router(whatsapp_router, prefix="/api/v1")
app.include_router(whatsapp_router, prefix="")
app.include_router(faq_router, prefix="/api/v1")
app.include_router(audit_router, prefix="/api/v1")
app.include_router(model_version_router, prefix="/api/v1")
app.include_router(ai_router, prefix="/api/v1")
app.include_router(campaign_router, prefix="/api/v1")
app.include_router(courier_router, prefix="/api/v1")
app.include_router(coupon_router, prefix="/api/v1")
app.include_router(review_router, prefix="/api/v1")

# Mount Static Files for Uploaded Product Images
import os
from fastapi.staticfiles import StaticFiles

_static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(os.path.join(_static_dir, "uploads"), exist_ok=True)
app.mount("/static", StaticFiles(directory=_static_dir), name="static")


# Direct Meta Webhook endpoints (supports both /webhook and /whatsapp/webhook Callback URLs)
from typing import Optional
from fastapi import BackgroundTasks, Query, Request
from controllers.whatsapp_controller import whatsapp_controller

@app.get("/webhook", tags=["WhatsApp Cloud API"], include_in_schema=False)
def direct_verify_webhook(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token"),
):
    return whatsapp_controller.verify_webhook(hub_mode, hub_verify_token, hub_challenge)

@app.post("/webhook", tags=["WhatsApp Cloud API"], include_in_schema=False)
async def direct_handle_webhook(request: Request, background_tasks: BackgroundTasks):
    return await whatsapp_controller.handle_incoming_webhook(request, background_tasks)


@app.get("/health", tags=["Health"])
@app.get("/api/v1/health", tags=["Health"])
async def health_check():
    db_status = "connected"
    db_error = None
    product_count = 0
    try:
        from db.mongodb import get_database
        database = get_database()
        await database.client.admin.command("ping")
        product_count = await database["products"].count_documents({})
    except Exception as e:
        db_status = "disconnected"
        db_error = str(e)

    raw_url = settings.DATABASE_URL or ""
    is_localhost = "localhost" in raw_url or "127.0.0.1" in raw_url
    masked_target = "localhost (NOT CONFIGURED ON RENDER)" if is_localhost else (raw_url.split("@")[-1].split("?")[0] if "@" in raw_url else "configured")

    return {
        "status": "healthy" if db_status == "connected" else "database_disconnected",
        "app": settings.APP_NAME,
        "database": db_status,
        "database_target": masked_target,
        "database_error": db_error,
        "products_in_db": product_count,
        "env": settings.APP_ENV,
    }


@app.get("/", tags=["Root"])
async def root():
    return {"message": "WhatsApp Fashion AI API is running with MongoDB."}


@app.get("/privacy", tags=["Legal"])
async def privacy_policy():
    from fastapi.responses import HTMLResponse
    return HTMLResponse("""
    <!DOCTYPE html>
    <html>
    <head><title>Privacy Policy - WhatsApp Fashion AI</title></head>
    <body style="font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; line-height: 1.6; padding: 0 20px;">
        <h1>Privacy Policy</h1>
        <p>Last updated: October 2026</p>
        <p>WhatsApp Fashion AI provides automated personal styling and customer support assistance on WhatsApp.</p>
        <h3>Data Collection & Usage</h3>
        <p>We only process messages sent by users to fulfill customer service queries, product recommendations, and order status updates.</p>
        <h3>Data Protection</h3>
        <p>User communications are handled securely and never sold to third parties.</p>
    </body>
    </html>
    """)
