"""Fetch a country-flag PNG and return it as a data URI for PDF templates.

We use flagcdn.com's free, no-auth, lowercase-ISO-3166-alpha-2 endpoint
(`https://flagcdn.com/w40/<cc>.png`) and cache results in-process for the
lifetime of a warm Lambda — typical events touch 1–10 unique countries so
the per-render cost is one fetch per country, not per racer.

Failures (timeout, 404, network) return None so callers can fall back to
plain-text country code without special-casing. Flags are cosmetic; we
shouldn't fail a podium PDF because flagcdn is briefly unreachable.
"""
import base64
import urllib.error
import urllib.request
from typing import Optional

from aws_lambda_powertools import Logger

logger = Logger()

_FLAG_URL_TEMPLATE = "https://flagcdn.com/w40/{cc}.png"
_FETCH_TIMEOUT_S = 2.0

# Module-level cache survives between invocations on a warm container — same
# event's PDFs reuse the same flags. Negative results (None) are also cached
# so a single broken country code doesn't re-hit the network on every render.
_cache: dict[str, Optional[str]] = {}


def flag_data_uri(country_code) -> Optional[str]:
    """Return `data:image/png;base64,…` for an ISO-3166-alpha-2 country code.

    Accepts upper- or lower-case input; returns None on any failure including
    invalid input.
    """
    if not country_code or not isinstance(country_code, str):
        return None
    cc = country_code.strip().lower()
    if len(cc) != 2 or not cc.isalpha():
        return None

    if cc in _cache:
        return _cache[cc]

    url = _FLAG_URL_TEMPLATE.format(cc=cc)
    try:
        with urllib.request.urlopen(url, timeout=_FETCH_TIMEOUT_S) as resp:
            png = resp.read()
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        logger.warning(f"flag fetch failed for {cc!r}: {e}")
        _cache[cc] = None
        return None

    if not png.startswith(b"\x89PNG\r\n\x1a\n"):
        logger.warning(f"flag fetch for {cc!r} returned non-PNG payload")
        _cache[cc] = None
        return None

    data_uri = "data:image/png;base64," + base64.b64encode(png).decode("ascii")
    _cache[cc] = data_uri
    return data_uri
