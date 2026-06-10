import os
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

_raw_url = os.getenv(
    "REPORTING_DB_URL",
    "mysql://root:password@mysql:3306/fineract_default",
)

if _raw_url.startswith("mysql://"):
    ASYNC_URL = _raw_url.replace("mysql://", "mysql+aiomysql://", 1)
elif _raw_url.startswith("postgresql://"):
    ASYNC_URL = _raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)
else:
    ASYNC_URL = _raw_url

engine = create_async_engine(
    ASYNC_URL,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    echo=False,
)

_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@asynccontextmanager
async def get_session():
    async with _session_factory() as session:
        yield session
