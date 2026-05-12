from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from db import engine
from routers import portfolio, collections, kyc_summary


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Verify DB connectivity at startup — fail fast if Fineract DB is unreachable
    try:
        async with engine.connect() as conn:
            await conn.execute(__import__('sqlalchemy').text("SELECT 1"))
    except Exception as exc:
        import logging
        logging.getLogger("reporting").warning(f"DB not reachable at startup: {exc}")
    yield
    await engine.dispose()


app = FastAPI(title="Mifos X Reporting API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def generic_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"error": str(exc)})


app.include_router(portfolio.router,    prefix="/reports/portfolio",  tags=["portfolio"])
app.include_router(collections.router,  prefix="/reports/collections", tags=["collections"])
app.include_router(kyc_summary.router,  prefix="/reports/kyc",        tags=["kyc"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "reporting"}
