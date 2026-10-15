import math
import sys
import types
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent.parent))

from generator import Route, _build_custom_model, _fetch_one, _filter_and_rank, generate, haversine, overlap_pct


# --- haversine ---

def test_haversine_zero():
    assert haversine([103.8, 1.3], [103.8, 1.3]) == 0.0


def test_haversine_known():
    # ~1 degree of latitude ≈ 111 km
    d = haversine([0.0, 0.0], [0.0, 1.0])
    assert 110_000 < d < 112_000


# --- overlap_pct ---

def _seg(a, b):
    """Return a coordinate pair going from a to b as [lng, lat] pairs."""
    return [a, b]


def test_overlap_pct_no_overlap():
    # Simple triangle: no repeated segment
    coords = [[0.0, 0.0], [0.001, 0.0], [0.001, 0.001], [0.0, 0.0]]
    assert overlap_pct(coords) == pytest.approx(0.0)


def test_overlap_pct_full_overlap():
    # Out-and-back: A→B→A — every segment repeated once → 50% overlap
    coords = [[0.0, 0.0], [0.001, 0.0], [0.0, 0.0]]
    ov = overlap_pct(coords)
    # Segment A→B appears twice; half of total length is repeated
    assert ov == pytest.approx(0.5, abs=0.01)


def test_overlap_pct_partial():
    # A→B→C→B→D: segment B→C repeated, rest unique
    a, b, c, d = [0.0, 0.0], [0.001, 0.0], [0.002, 0.0], [0.001, 0.001]
    coords = [a, b, c, b, d]
    ov = overlap_pct(coords)
    assert 0.0 < ov < 1.0


# --- _filter_and_rank ---

def _fake_path(distance_m: float, coords=None, ascend: float | None = None) -> dict:
    if coords is None:
        coords = [[0.0, 0.0], [0.001, 0.0], [0.001, 0.001], [0.0, 0.0]]
    p = {"distance": distance_m, "points": {"type": "LineString", "coordinates": coords}}
    if ascend is not None:
        p["ascend"] = ascend
    return p


def test_filter_drops_outside_tolerance():
    target = 5000
    paths = [
        _fake_path(5000),   # 0% error — keep
        _fake_path(5750),   # +15% — keep (boundary)
        _fake_path(5751),   # +15.02% — drop
        _fake_path(4249),   # -15.02% — drop
    ]
    result = _filter_and_rank(paths, target, 0.15)
    assert len(result) == 2


def test_filter_rank_by_error():
    target = 5000
    paths = [
        _fake_path(5400),  # +8%
        _fake_path(5100),  # +2% — should rank first
    ]
    result = _filter_and_rank(paths, target, 0.15)
    assert result[0]["abs_error"] < result[1]["abs_error"]


def test_filter_tiebreak_by_overlap():
    # Two paths with identical distance but different overlap
    target = 5000
    # High-overlap path: out-and-back
    zig = [[0.0, 0.0], [0.001, 0.0], [0.0, 0.0]]
    # Low-overlap path: triangle
    tri = [[0.0, 0.0], [0.001, 0.0], [0.001, 0.001], [0.0, 0.0]]
    paths = [_fake_path(5000, zig), _fake_path(5000, tri)]
    result = _filter_and_rank(paths, target, 0.15)
    # triangle (lower overlap) should come first
    assert result[0]["overlap"] < result[1]["overlap"]


# The real Berkeley 8 km candidates that motivated ascent-aware ranking. Distance
# errors are 0.12 / 0.88 / 3.12 %, so anything narrower than a ~4% bucket leaves each
# route alone in its bucket and the ordering never changes.
_BERKELEY_8K = [(7990, 126.0), (8070, 217.0), (8250, 78.0)]


def test_filter_rank_avoid_hills_prefers_flattest_within_bucket():
    paths = [_fake_path(d, ascend=a) for d, a in _BERKELEY_8K]
    result = _filter_and_rank(paths, 8000, 0.15, avoid_hills=True)
    assert [r["path"]["distance"] for r in result] == [8250, 7990, 8070]


def test_filter_rank_without_avoid_hills_is_unchanged_by_ascent():
    # Singapore path: ascent is SRTM noise and must not reorder anything.
    paths = [_fake_path(d, ascend=a) for d, a in _BERKELEY_8K]
    result = _filter_and_rank(paths, 8000, 0.15)
    assert [r["path"]["distance"] for r in result] == [7990, 8070, 8250]


def test_filter_rank_avoid_hills_still_respects_the_distance_bucket():
    # 9200 m is a 15% miss: flat, inside tolerance, but a whole bucket behind.
    paths = [_fake_path(8000, ascend=300.0), _fake_path(9200, ascend=5.0)]
    result = _filter_and_rank(paths, 8000, 0.15, avoid_hills=True)
    assert result[0]["path"]["distance"] == 8000


def test_filter_rank_avoid_hills_normalises_ascent_per_km():
    # Same bucket, same total climb, different lengths: the shorter route is steeper.
    paths = [_fake_path(7800, ascend=100.0), _fake_path(8200, ascend=100.0)]
    result = _filter_and_rank(paths, 8000, 0.15, avoid_hills=True)
    assert result[0]["path"]["distance"] == 8200


def test_filter_rank_handles_paths_with_no_ascend_key():
    paths = [_fake_path(8000), _fake_path(8100)]
    result = _filter_and_rank(paths, 8000, 0.15, avoid_hills=True)
    assert len(result) == 2


# --- generate (async, mocked _fetch_one) ---

def _gh_path(distance_m: float, ascend: float = 12.0) -> dict:
    coords = [[103.860, 1.283], [103.861, 1.283], [103.861, 1.284], [103.860, 1.283]]
    return {"distance": float(distance_m), "ascend": ascend,
            "points": {"type": "LineString", "coordinates": coords}}


@pytest.mark.asyncio
async def test_generate_returns_up_to_3():
    # All 12 seeds return a valid path within ±15%
    target = 5000
    with patch("generator._fetch_one", new=AsyncMock(return_value=_gh_path(target))):
        routes, partial = await generate(1.283, 103.860, 5.0, "http://fake")
    assert partial is False
    assert 1 <= len(routes) <= 3
    for r in routes:
        assert isinstance(r, Route)
        assert r.actual_km == pytest.approx(5.0, abs=0.01)
        assert r.ascent_m == pytest.approx(12.0)


@pytest.mark.asyncio
async def test_generate_partial_when_all_fail():
    # All seeds fail (return None)
    with patch("generator._fetch_one", new=AsyncMock(return_value=None)):
        routes, partial = await generate(1.283, 103.860, 5.0, "http://fake")
    assert partial is True
    assert routes == []


@pytest.mark.asyncio
async def test_generate_partial_fallback_closest():
    # Seeds return routes far outside tolerance (50% overshoot)
    far_path = _gh_path(7500)  # +50% of 5000
    with patch("generator._fetch_one", new=AsyncMock(return_value=far_path)):
        routes, partial = await generate(1.283, 103.860, 5.0, "http://fake")
    assert partial is True
    assert len(routes) == 1
    assert routes[0].actual_km == pytest.approx(7.5, abs=0.01)


# --- _build_custom_model ---

def test_build_custom_model_no_prefs_returns_none():
    assert _build_custom_model(avoid_hills=False, surface="any") is None


def test_build_custom_model_avoid_hills():
    model = _build_custom_model(avoid_hills=True, surface="any")
    assert model == {"priority": [
        {"if": "average_slope >= 4", "multiply_by": "0.2"},
        {"if": "average_slope >= 8", "multiply_by": "0.05"},
    ]}


def test_build_custom_model_paved_penalizes_unpaved():
    model = _build_custom_model(avoid_hills=False, surface="paved")
    assert len(model["priority"]) == 1
    assert "GRAVEL" in model["priority"][0]["if"]
    assert model["priority"][0]["multiply_by"] == "0.3"


def test_build_custom_model_trail_penalizes_paved():
    model = _build_custom_model(avoid_hills=False, surface="trail")
    assert model["priority"][0]["multiply_by"] == "1"
    assert model["priority"][1]["else"] == ""
    assert model["priority"][1]["multiply_by"] == "0.3"


def test_build_custom_model_combines_avoid_hills_and_surface():
    model = _build_custom_model(avoid_hills=True, surface="paved")
    assert len(model["priority"]) == 3


# --- _fetch_one POST body ---

@pytest.mark.asyncio
async def test_fetch_one_posts_expected_body_with_custom_model():
    fake_response = MagicMock()
    fake_response.json.return_value = {"paths": [_gh_path(3000)]}
    fake_response.raise_for_status = MagicMock()
    client = MagicMock()
    client.post = AsyncMock(return_value=fake_response)

    await _fetch_one(client, "http://fake", 1.283, 103.860, 3000, 0, avoid_hills=True, surface="paved")

    client.post.assert_awaited_once()
    call = client.post.call_args
    assert call.args[0] == "http://fake/route"
    body = call.kwargs["json"]
    assert body["points"] == [[103.860, 1.283]]
    assert body["round_trip.distance"] == 3000
    assert body["round_trip.seed"] == 0
    assert body["ch.disable"] is True
    assert body["custom_model"] == _build_custom_model(True, "paved")


@pytest.mark.asyncio
async def test_fetch_one_omits_custom_model_when_no_prefs():
    fake_response = MagicMock()
    fake_response.json.return_value = {"paths": [_gh_path(3000)]}
    fake_response.raise_for_status = MagicMock()
    client = MagicMock()
    client.post = AsyncMock(return_value=fake_response)

    await _fetch_one(client, "http://fake", 1.283, 103.860, 3000, 0, avoid_hills=False, surface="any")

    body = client.post.call_args.kwargs["json"]
    assert "custom_model" not in body
