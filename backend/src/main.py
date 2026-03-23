from __future__ import annotations

from fastapi import FastAPI

app: FastAPI = FastAPI(
    title="InnoMapCAD",
    version="0.1.0",
    description="Backend service for interactive CAD map editing",
)


@app.get("/health")
async def health() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}
