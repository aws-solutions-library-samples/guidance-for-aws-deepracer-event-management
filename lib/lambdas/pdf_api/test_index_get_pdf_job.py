import os
os.environ.setdefault("PDF_BUCKET", "test-bucket")
os.environ.setdefault("RACE_TABLE", "test-race")
os.environ.setdefault("EVENTS_TABLE", "test-events")
os.environ.setdefault("USER_POOL_ID", "test-pool")
os.environ.setdefault("PDF_JOBS_TABLE", "test-jobs")
os.environ.setdefault("WORKER_FUNCTION_NAME", "test-worker")
os.environ.setdefault("URL_EXPIRY_SECONDS", "3600")

from unittest.mock import patch, MagicMock

import pytest

import index


def _call_resolver(jobId, claims):
    """Invoke the resolver directly, mocking the AppSyncResolver state."""
    # Mock the app object's state with proper identity structure
    index.app.current_event = MagicMock()
    index.app.current_event.identity = {"claims": claims}

    return index.get_pdf_job(jobId)


def test_returns_none_when_row_missing():
    with patch.object(index, "_jobs_table") as t:
        t.get_item.return_value = {}
        assert _call_resolver("missing", {"sub": "u1", "cognito:groups": "racer"}) is None


def test_raises_when_row_belongs_to_another_racer():
    with patch.object(index, "_jobs_table") as t:
        t.get_item.return_value = {"Item": {
            "jobId": "j1", "createdBy": "other", "status": "PENDING",
            "type": "PODIUM", "eventId": "e1",
            "createdAt": "2026-01-01T00:00:00Z",
        }}
        with pytest.raises(PermissionError):
            _call_resolver("j1", {"sub": "u1", "cognito:groups": "racer"})


def test_admin_can_read_any_row():
    with patch.object(index, "_jobs_table") as t:
        t.get_item.return_value = {"Item": {
            "jobId": "j1", "createdBy": "other", "status": "PENDING",
            "type": "PODIUM", "eventId": "e1",
            "createdAt": "2026-01-01T00:00:00Z",
        }}
        r = _call_resolver("j1", {"sub": "admin1", "cognito:groups": "admin"})
        assert r["jobId"] == "j1"
        assert r.get("downloadUrl") is None


def test_success_row_gets_fresh_presigned_url():
    with patch.object(index, "_jobs_table") as t, \
         patch.object(index, "_s3") as s3:
        t.get_item.return_value = {"Item": {
            "jobId": "j1", "createdBy": "u1", "status": "SUCCESS",
            "type": "PODIUM", "eventId": "e1", "s3Key": "e1/podium-xyz.pdf",
            "filename": "podium.pdf",
            "createdAt": "2026-01-01T00:00:00Z",
        }}
        s3.generate_presigned_url.return_value = "https://presigned.example/pdf"
        r = _call_resolver("j1", {"sub": "u1", "cognito:groups": "racer"})
    assert r["downloadUrl"] == "https://presigned.example/pdf"
    s3.generate_presigned_url.assert_called_once()
    args, kwargs = s3.generate_presigned_url.call_args
    assert kwargs["ExpiresIn"] == 3600
    assert 'filename="podium.pdf"' in kwargs["Params"]["ResponseContentDisposition"]


def test_pending_row_has_no_url():
    with patch.object(index, "_jobs_table") as t:
        t.get_item.return_value = {"Item": {
            "jobId": "j1", "createdBy": "u1", "status": "PENDING",
            "type": "PODIUM", "eventId": "e1",
            "createdAt": "2026-01-01T00:00:00Z",
        }}
        r = _call_resolver("j1", {"sub": "u1", "cognito:groups": "racer"})
    assert r.get("downloadUrl") is None
