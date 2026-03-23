from __future__ import annotations

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from src.routers.health import router as health_router
from src.routers.layers import router as layers_router
from src.routers.presets import router as presets_router
from src.routers.validate import router as validate_router
from src.services.data_store import data_store


class PrivateNetworkAccessMiddleware(BaseHTTPMiddleware):
    """Add Access-Control-Allow-Private-Network header for Chrome PNA preflight."""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        response = await call_next(request)
        if request.headers.get("Access-Control-Request-Private-Network") == "true":
            response.headers["Access-Control-Allow-Private-Network"] = "true"
        return response


_ALLOWED_ORIGINS: list[str] = [
    "https://4dinno.ru",
    "https://www.4dinno.ru",
]


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None]:
    """Load GeoJSON data at startup."""
    data_store.load_from_directory()
    yield


app: FastAPI = FastAPI(
    title="InnoMapCAD",
    version="0.1.0",
    description="Backend service for interactive CAD map editing",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_origin_regex=r"^http://localhost(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(PrivateNetworkAccessMiddleware)

app.include_router(health_router)
app.include_router(presets_router)
app.include_router(layers_router)
app.include_router(validate_router)
