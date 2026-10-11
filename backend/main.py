"""DwellBase FastAPI Application — replaces server/index.js."""

from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from backend.config import get_settings
from backend.routes import auth, rooms, tenants, charges, payments, regulations, settings, reports, seed, superadmin

s = get_settings()

app = FastAPI(
    title="DwellBase API",
    description="Property Management Platform API",
    version="2.0.0",
)

# ─── Exception Handlers (Express { error: string } compatibility) ─────────────
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    err_msg = str(exc.detail) if isinstance(exc.detail, str) else str(exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": err_msg, "detail": exc.detail},
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    err_msgs = [f"{err.get('loc', ['field'])[-1]}: {err.get('msg', 'invalid')}" for err in exc.errors()]
    combined = "; ".join(err_msgs)
    return JSONResponse(
        status_code=400,
        content={"error": combined, "detail": exc.errors()},
    )

# ─── CORS (mirrors the Express cors() config) ────────────────────────────────
allowed_origins = [o.strip() for o in s.FRONTEND_URL.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Production: lock this down to allowed_origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health check ─────────────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {"status": "ok", "time": datetime.now(timezone.utc).isoformat()}


# ─── Mount all API routers under /api ─────────────────────────────────────────
app.include_router(auth.router, prefix="/api")
app.include_router(rooms.router, prefix="/api")
app.include_router(tenants.router, prefix="/api")
app.include_router(charges.router, prefix="/api")
app.include_router(payments.router, prefix="/api")
app.include_router(regulations.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(seed.router, prefix="/api")
app.include_router(superadmin.router, prefix="/api")
