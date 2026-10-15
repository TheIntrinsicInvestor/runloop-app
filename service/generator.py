import asyncio
import math
import uuid
from dataclasses import dataclass

import httpx


@dataclass
class Route:
    id: str
    geometry: dict  # GeoJSON LineString
    actual_km: float
    overlap_pct: float  # 0-100
    ascent_m: float


def haversine(a: list, b: list) -> float:
    """Meters between two [lng, lat] points."""
    R = 6371000
    dlat = math.radians(b[1] - a[1])
    dlng = math.radians(b[0] - a[0])
    s = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(a[1])) * math.cos(math.radians(b[1])) * math.sin(dlng / 2) ** 2)
    return 2 * R * math.asin(math.sqrt(s))


def overlap_pct(coords: list) -> float:
    """Fraction (0-1) of route length that re-traverses already-seen segments (undirected, 5dp rounded)."""
    segs: dict = {}
    total = 0.0
    for i in range(len(coords) - 1):
        a, b = coords[i], coords[i + 1]
        L = haversine(a, b)
        total += L
        ka = "%.5f,%.5f" % (a[0], a[1])
        kb = "%.5f,%.5f" % (b[0], b[1])
        key = ka + "|" + kb if ka < kb else kb + "|" + ka
        e = segs.get(key, [0, 0.0])
        e[0] += 1
        e[1] += L
        segs[key] = e
    repeated = sum((L / cnt) * (cnt - 1) for cnt, L in segs.values() if cnt > 1)
    return repeated / total if total else 0.0


_UNPAVED = "surface == GRAVEL || surface == DIRT || surface == GROUND || surface == SAND || surface == GRASS"


def _build_custom_model(avoid_hills: bool, surface: str) -> dict | None:
    """Server-owned custom models; tuned empirically (Singapore is flat, so
    expect a visible effect only near Faber/Bukit Timah)."""
    priority = []
    if avoid_hills:
        priority.append({"if": "average_slope >= 4", "multiply_by": "0.2"})
        priority.append({"if": "average_slope >= 8", "multiply_by": "0.05"})
    if surface == "paved":
        priority.append({"if": _UNPAVED, "multiply_by": "0.3"})
    elif surface == "trail":
        priority.append({"if": _UNPAVED, "multiply_by": "1"})
        priority.append({"else": "", "multiply_by": "0.3"})
    return {"priority": priority} if priority else None


async def _fetch_one(client: httpx.AsyncClient, gh_base: str, lat: float, lng: float,
                     distance_m: int, seed: int, avoid_hills: bool, surface: str) -> dict | None:
    body = {
        "points": [[lng, lat]],
        "profile": "foot",
        "algorithm": "round_trip",
        "round_trip.distance": distance_m,
        "round_trip.seed": seed,
        "ch.disable": True,
        "points_encoded": False,
    }
    custom_model = _build_custom_model(avoid_hills, surface)
    if custom_model:
        body["custom_model"] = custom_model
    try:
        r = await client.post(f"{gh_base}/route", json=body, timeout=40.0)
        r.raise_for_status()
        return r.json()["paths"][0]
    except Exception:
        return None


async def _batch(client: httpx.AsyncClient, gh_base: str, lat: float, lng: float,
                 distance_m: int, seeds: list[int], avoid_hills: bool, surface: str) -> list[dict]:
    results = await asyncio.gather(*[
        _fetch_one(client, gh_base, lat, lng, distance_m, s, avoid_hills, surface) for s in seeds
    ])
    return [r for r in results if r is not None]


_FLAT_BUCKET = 0.05


def _filter_and_rank(paths: list[dict], target_m: int, tol: float,
                     avoid_hills: bool = False) -> list[dict]:
    """Keep paths within ±tol, annotate with error/overlap/ascent, and sort.

    Default: |error| then overlap. With avoid_hills the user has explicitly asked for
    flat, so distance error is bucketed to _FLAT_BUCKET and the flattest route in the
    best bucket wins. The bucket has to be this wide to do anything: a real Berkeley
    8 km set differed by 0.12/0.88/3.12%, so a 1% bucket left every route in its own
    bucket and changed nothing, still ranking a 217 m climb above a 78 m one.

    Ascent is normalised per km, since a bucket spans routes of slightly different
    lengths. Bucketing is applied only on request: in flat terrain SRTM sampling noise
    dominates real ascent (a flat Singapore 5 km loop reports ~137 m), so ranking on it
    unasked would reorder routes on noise.
    """
    annotated = []
    for p in paths:
        err = (p["distance"] - target_m) / target_m
        if abs(err) > tol:
            continue
        ov = overlap_pct(p["points"]["coordinates"])
        km = max(p["distance"] / 1000, 0.001)
        annotated.append({
            "path": p,
            "abs_error": abs(err),
            "overlap": ov,
            "ascent_per_km": p.get("ascend", 0.0) / km,
        })
    if avoid_hills:
        annotated.sort(key=lambda x: (int(x["abs_error"] / _FLAT_BUCKET),
                                      x["ascent_per_km"], x["overlap"]))
    else:
        annotated.sort(key=lambda x: (x["abs_error"], x["overlap"]))
    return annotated


async def generate(lat: float, lng: float, distance_km: float, gh_base: str,
                   avoid_hills: bool = False, surface: str = "any") -> tuple[list[Route], bool]:
    """
    Best-of-N loop generation. Returns (routes, partial).
    partial=True means nothing hit tolerance; routes[0] is the closest found.
    """
    K = 3
    TOL_ACCEPT = 0.15
    target_m = int(distance_km * 1000)

    async with httpx.AsyncClient() as client:
        paths = await _batch(client, gh_base, lat, lng, target_m, list(range(12)), avoid_hills, surface)
        candidates = _filter_and_rank(paths, target_m, TOL_ACCEPT, avoid_hills)

        if len(candidates) < K:
            extra = await _batch(client, gh_base, lat, lng, target_m, list(range(12, 20)), avoid_hills, surface)
            paths.extend(extra)
            candidates = _filter_and_rank(paths, target_m, TOL_ACCEPT, avoid_hills)

        # Systematic overshoot → length-adjust retry
        if paths and (not candidates or candidates[0]["abs_error"] > 0.20):
            actuals = sorted(p["distance"] for p in paths)
            median_actual = actuals[len(actuals) // 2]
            adjusted_m = int(target_m * target_m / median_actual)
            if abs(adjusted_m - target_m) > 100:
                retry = await _batch(client, gh_base, lat, lng, adjusted_m, list(range(12)), avoid_hills, surface)
                paths.extend(retry)
                candidates = _filter_and_rank(paths, target_m, TOL_ACCEPT, avoid_hills)

        # Deduplicate and take up to K
        seen: set[str] = set()
        routes: list[Route] = []
        for c in candidates:
            if len(routes) >= K:
                break
            p = c["path"]
            coords = p["points"]["coordinates"]
            fp = "%.4f,%.4f,%.0f,%.0f" % (coords[0][0], coords[0][1], p["distance"], c["overlap"] * 10000)
            if fp in seen:
                continue
            seen.add(fp)
            routes.append(Route(
                id=str(uuid.uuid4()),
                geometry=p["points"],
                actual_km=round(p["distance"] / 1000, 2),
                overlap_pct=round(c["overlap"] * 100, 1),
                ascent_m=round(p.get("ascend", 0.0), 1),
            ))

        if routes:
            return routes, False

        # Fallback: return closest regardless of tolerance
        if paths:
            best = min(paths, key=lambda p: abs(p["distance"] - target_m))
            ov = overlap_pct(best["points"]["coordinates"])
            return [Route(
                id=str(uuid.uuid4()),
                geometry=best["points"],
                actual_km=round(best["distance"] / 1000, 2),
                overlap_pct=round(ov * 100, 1),
                ascent_m=round(best.get("ascend", 0.0), 1),
            )], True

        return [], True
