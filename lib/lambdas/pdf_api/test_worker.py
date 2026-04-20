import os
os.environ.setdefault("PDF_BUCKET", "test-bucket")
os.environ.setdefault("RACE_TABLE", "test-race")
os.environ.setdefault("EVENTS_TABLE", "test-events")
os.environ.setdefault("USER_POOL_ID", "test-pool")
os.environ.setdefault("PDF_JOBS_TABLE", "test-jobs")
os.environ.setdefault("APPSYNC_ENDPOINT", "https://x")
os.environ.setdefault("APPSYNC_REGION", "eu-west-1")

from unittest.mock import patch

import worker


def _fake_job(type_="PODIUM", userId=None):
    return {
        "jobId": "j-1",
        "type": type_,
        "eventId": "evt-1",
        "userId": userId,
        "trackId": None,
        "status": "PENDING",
    }


def test_worker_success_calls_update_with_s3key_and_filename():
    with patch.object(worker, "_jobs_table") as jobs_table, \
         patch.object(worker.shared, "get_event", return_value={"eventId": "evt-1", "eventName": "Test"}), \
         patch.object(worker.shared, "get_races", return_value=[{"userId": "u1", "raceId": "r1"}]), \
         patch.object(worker.shared, "build_ranked", return_value=[{"userId": "u1", "username": "alice", "fastestLapTime": 12345}]), \
         patch.object(worker.shared, "render_podium", return_value=b"%PDF-fake"), \
         patch.object(worker.shared, "put_pdf_object"), \
         patch.object(worker.appsync_iam, "send_mutation") as send_mutation:
        jobs_table.get_item.return_value = {"Item": _fake_job("PODIUM")}
        worker.lambda_handler({"jobId": "j-1"}, None)
    send_mutation.assert_called_once()
    variables = send_mutation.call_args[0][1]
    assert variables["jobId"] == "j-1"
    assert variables["status"] == "SUCCESS"
    assert variables["s3Key"].startswith("evt-1/podium-")
    assert variables["filename"] == "podium.pdf"


def test_worker_failure_calls_update_with_failed_status():
    with patch.object(worker, "_jobs_table") as jobs_table, \
         patch.object(worker.shared, "get_event", side_effect=RuntimeError("boom")), \
         patch.object(worker.appsync_iam, "send_mutation") as send_mutation:
        jobs_table.get_item.return_value = {"Item": _fake_job()}
        worker.lambda_handler({"jobId": "j-1"}, None)
    send_mutation.assert_called_once()
    variables = send_mutation.call_args[0][1]
    assert variables["status"] == "FAILED"
    assert "boom" in variables["error"]


def test_worker_failure_truncates_error_to_500_chars():
    long_msg = "x" * 1000
    with patch.object(worker, "_jobs_table") as jobs_table, \
         patch.object(worker.shared, "get_event", side_effect=RuntimeError(long_msg)), \
         patch.object(worker.appsync_iam, "send_mutation") as send_mutation:
        jobs_table.get_item.return_value = {"Item": _fake_job()}
        worker.lambda_handler({"jobId": "j-1"}, None)
    variables = send_mutation.call_args[0][1]
    assert len(variables["error"]) <= 500


def test_worker_racer_certificate_renders_target_user():
    ranked = [
        {"userId": "u1", "username": "alice", "fastestLapTime": 100},
        {"userId": "u2", "username": "bob", "fastestLapTime": 120},
    ]
    with patch.object(worker, "_jobs_table") as jobs_table, \
         patch.object(worker.shared, "get_event", return_value={"eventId": "evt-1", "eventName": "Test"}), \
         patch.object(worker.shared, "get_races", return_value=[{"userId": "u1"}, {"userId": "u2"}]), \
         patch.object(worker.shared, "build_ranked", return_value=ranked), \
         patch.object(worker.shared, "render_certificate", return_value=b"%PDF") as render_cert, \
         patch.object(worker.shared, "put_pdf_object"), \
         patch.object(worker.appsync_iam, "send_mutation") as send_mutation:
        jobs_table.get_item.return_value = {"Item": _fake_job("RACER_CERTIFICATE", userId="u2")}
        worker.lambda_handler({"jobId": "j-1"}, None)
    # render_certificate called once with bob's data (u2)
    render_cert.assert_called_once()
    args = render_cert.call_args.args
    # signature: render_certificate(event, racer, brand, generated_at)
    racer_arg = args[1]
    assert racer_arg["userId"] == "u2"
    # success path called with certificate-bob filename
    variables = send_mutation.call_args[0][1]
    assert variables["filename"] == "certificate-bob.pdf"
