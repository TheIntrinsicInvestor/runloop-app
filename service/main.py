import os
import secrets
from typing import Literal

from fastapi import Depends, FastAPI, HTTPException, Request, status
from pydantic import BaseModel, Field

from generator import Route, generate

app = FastAPI()

GH_BASE: str = os.environ["GH_BASE"]

# Comma-separated to allow a rotation window: already-shipped app builds carry
# the old key compiled into their bundle, so both must be accepted until the
# next release goes out. Drop the retired key from the env once it has.
ROUTE_API_KEYS: frozenset[str] = frozenset(
    k.strip() for k in os.environ["ROUTE_API_KEY"].split(",") if k.strip()
)


async def verify_key(request: Request) -> None:
    key = request.headers.get("x-api-key")
    # compare_digest over the whole set: constant-time per candidate, so a
    # timing side channel can't reveal how much of a key matched.
    if not key or not any(secrets.compare_digest(key, valid) for valid in ROUTE_API_KEYS):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid API key")


class GenerateRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)
    distanceKm: float = Field(..., ge=1, le=50)
    avoidHills: bool = False
    surface: Literal['any', 'paved', 'trail'] = 'any'


class RouteOut(BaseModel):
    id: str
    geometry: dict
    actualKm: float
    overlapPct: float
    ascentM: float


class GenerateResponse(BaseModel):
    routes: list[RouteOut]
    partial: bool


def _to_out(r: Route) -> RouteOut:
    return RouteOut(id=r.id, geometry=r.geometry, actualKm=r.actual_km, overlapPct=r.overlap_pct,
                    ascentM=r.ascent_m)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/generate", response_model=GenerateResponse, dependencies=[Depends(verify_key)])
async def generate_routes(req: GenerateRequest):
    routes, partial = await generate(req.lat, req.lng, req.distanceKm, GH_BASE,
                                     avoid_hills=req.avoidHills, surface=req.surface)
    return GenerateResponse(routes=[_to_out(r) for r in routes], partial=partial)
