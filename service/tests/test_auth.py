import importlib
import os
import sys
from pathlib import Path

import pytest
from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).parent.parent))

OLD = "old-key-aaaaaaaaaaaaaaaaaaaa"
NEW = "new-key-bbbbbbbbbbbbbbbbbbbb"


def load_main(route_api_key: str):
    """Import main.py fresh with the given ROUTE_API_KEY (read at import time)."""
    os.environ["ROUTE_API_KEY"] = route_api_key
    os.environ.setdefault("GH_BASE", "http://127.0.0.1:8989")
    sys.modules.pop("main", None)
    return importlib.import_module("main")


class FakeRequest:
    def __init__(self, key=None):
        self.headers = {} if key is None else {"x-api-key": key}


async def verify(main, key):
    await main.verify_key(FakeRequest(key))


@pytest.mark.asyncio
async def test_single_key_accepted():
    main = load_main(NEW)
    await verify(main, NEW)  # does not raise


@pytest.mark.asyncio
async def test_wrong_key_rejected():
    main = load_main(NEW)
    with pytest.raises(HTTPException) as e:
        await verify(main, OLD)
    assert e.value.status_code == 403


@pytest.mark.asyncio
async def test_missing_key_rejected():
    main = load_main(NEW)
    with pytest.raises(HTTPException) as e:
        await verify(main, None)
    assert e.value.status_code == 403


@pytest.mark.asyncio
async def test_both_keys_accepted_during_rotation():
    main = load_main(f"{OLD},{NEW}")
    await verify(main, OLD)
    await verify(main, NEW)


@pytest.mark.asyncio
async def test_rotation_list_tolerates_whitespace():
    main = load_main(f" {OLD} , {NEW} ")
    await verify(main, OLD)
    await verify(main, NEW)


@pytest.mark.asyncio
async def test_retired_key_rejected_after_window_closes():
    main = load_main(NEW)
    with pytest.raises(HTTPException) as e:
        await verify(main, OLD)
    assert e.value.status_code == 403


@pytest.mark.asyncio
async def test_empty_string_key_rejected():
    """A blank x-api-key must never satisfy a stray empty entry in the list."""
    main = load_main(f"{NEW},")
    with pytest.raises(HTTPException) as e:
        await verify(main, "")
    assert e.value.status_code == 403
