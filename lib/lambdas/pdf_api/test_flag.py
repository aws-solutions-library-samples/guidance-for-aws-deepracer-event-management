"""Tests for flag.py — the country-flag fetch + cache layer."""
import base64
from unittest.mock import patch, MagicMock

import flag


def setup_function():
    """Reset cache between tests so they don't bleed."""
    flag._cache.clear()


def test_returns_none_for_falsy():
    assert flag.flag_data_uri(None) is None
    assert flag.flag_data_uri("") is None
    assert flag.flag_data_uri(0) is None


def test_returns_none_for_non_alpha_input():
    assert flag.flag_data_uri("12") is None
    assert flag.flag_data_uri("g1") is None
    assert flag.flag_data_uri("USA") is None  # 3-letter code not valid for flagcdn
    assert flag.flag_data_uri("g") is None


def _png_bytes(label=b"x"):
    """Minimal valid PNG signature + a body byte so it passes the magic check."""
    return b"\x89PNG\r\n\x1a\n" + label


def test_successful_fetch_returns_data_uri_and_caches():
    fake_png = _png_bytes(b"GBflag")
    fake_resp = MagicMock()
    fake_resp.read.return_value = fake_png
    fake_resp.__enter__ = lambda s: s
    fake_resp.__exit__ = lambda *a: False

    with patch.object(flag.urllib.request, "urlopen", return_value=fake_resp) as urlopen:
        out1 = flag.flag_data_uri("GB")
        out2 = flag.flag_data_uri("gb")  # same country, different case → cached

    assert out1 == "data:image/png;base64," + base64.b64encode(fake_png).decode()
    assert out2 == out1
    # Network hit only once thanks to cache + case-normalisation.
    assert urlopen.call_count == 1
    # And it called the lowercase URL.
    assert "gb.png" in urlopen.call_args[0][0]


def test_network_failure_returns_none_and_negative_caches():
    import urllib.error

    with patch.object(
        flag.urllib.request, "urlopen", side_effect=urllib.error.URLError("nope"),
    ) as urlopen:
        out1 = flag.flag_data_uri("XY")
        out2 = flag.flag_data_uri("XY")

    assert out1 is None
    assert out2 is None
    # Negative result cached → second call is a no-op, not a re-fetch.
    assert urlopen.call_count == 1


def test_non_png_payload_treated_as_failure():
    """flagcdn occasionally serves a 404 HTML page with 200 status under odd
    routing. Reject anything not starting with the PNG magic bytes."""
    fake_resp = MagicMock()
    fake_resp.read.return_value = b"<html>404 not found</html>"
    fake_resp.__enter__ = lambda s: s
    fake_resp.__exit__ = lambda *a: False

    with patch.object(flag.urllib.request, "urlopen", return_value=fake_resp):
        assert flag.flag_data_uri("ZZ") is None
