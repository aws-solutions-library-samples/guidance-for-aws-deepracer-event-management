import decimal
import os
os.environ.setdefault("PDF_BUCKET", "test-bucket")
os.environ.setdefault("RACE_TABLE", "test-race")
os.environ.setdefault("EVENTS_TABLE", "test-events")
os.environ.setdefault("USER_POOL_ID", "test-pool")

from shared import replace_decimal_with_float, requester_identity, enforce_racer_self_service, s3_key, format_lap


def test_replace_decimal_handles_nested():
    obj = {"a": decimal.Decimal("1"), "b": [decimal.Decimal("2.5"), {"c": decimal.Decimal("3")}]}
    result = replace_decimal_with_float(obj)
    assert result == {"a": 1, "b": [2.5, {"c": 3}]}
    assert isinstance(result["a"], int)
    assert isinstance(result["b"][0], float)


def test_requester_identity_parses_groups_string():
    ev = {"claims": {"sub": "abc", "cognito:groups": "admin,operator"}}
    assert requester_identity(ev) == {"sub": "abc", "groups": {"admin", "operator"}}


def test_requester_identity_handles_missing_claims():
    assert requester_identity(None) == {"sub": "", "groups": set()}
    assert requester_identity({}) == {"sub": "", "groups": set()}


def test_requester_identity_empty_groups_string_yields_empty_set():
    ev = {"claims": {"sub": "abc", "cognito:groups": ""}}
    assert requester_identity(ev) == {"sub": "abc", "groups": set()}


def test_enforce_racer_self_service_admin_passes():
    enforce_racer_self_service({"sub": "x", "groups": {"admin"}}, "y")  # no raise


def test_enforce_racer_self_service_self_passes():
    enforce_racer_self_service({"sub": "x", "groups": set()}, "x")  # no raise


def test_enforce_racer_self_service_other_raises():
    import pytest
    with pytest.raises(PermissionError):
        enforce_racer_self_service({"sub": "x", "groups": set()}, "y")


def test_s3_key_zip_for_certificates():
    k = s3_key("evt-1", "certificates")
    assert k.startswith("evt-1/certificates-") and k.endswith(".zip")


def test_s3_key_pdf_for_other():
    k = s3_key("evt-1", "podium")
    assert k.startswith("evt-1/podium-") and k.endswith(".pdf")


def test_format_lap_none():
    assert format_lap(None) == "—"


def test_format_lap_rounds_to_ms():
    assert format_lap(1234) == "1.234s"
