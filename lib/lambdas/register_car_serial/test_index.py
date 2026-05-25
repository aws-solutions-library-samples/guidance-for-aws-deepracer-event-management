"""Tests for register_car_serial Lambda."""
import os
import sys
from unittest.mock import MagicMock

sys.path.insert(0, os.path.dirname(__file__))


def _mk_ssm_fetch(stdout, status="Success"):
    ssm = MagicMock()
    ssm.send_command.return_value = {"Command": {"CommandId": "cmd-1"}}
    ssm.get_command_invocation.return_value = {
        "Status": status,
        "StandardOutputContent": stdout,
    }
    return ssm


def _mk_tagging(arns):
    """Build a mocked resourcegroupstaggingapi client whose paginator
    yields one page containing the given managed-instance ARNs."""
    paginator = MagicMock()
    paginator.paginate.return_value = [
        {"ResourceTagMappingList": [{"ResourceARN": arn} for arn in arns]}
    ]
    tagging = MagicMock()
    tagging.get_paginator.return_value = paginator
    return tagging


def _mk_status_table(rows):
    """`rows` is a dict mi-id → item; missing keys return no Item."""
    status_table = MagicMock()
    def _get_item(Key):
        item = rows.get(Key.get("InstanceId"))
        return {"Item": item} if item else {}
    status_table.get_item.side_effect = _get_item
    return status_table


def _register(event, *, ssm=None, tagging_arns=(), status_rows=None, history_table=None):
    """Invoke the pure core with injected mocks."""
    from index import _register

    return _register(
        event,
        ssm=ssm or MagicMock(),
        tagging=_mk_tagging(tagging_arns),
        status_table=_mk_status_table(status_rows or {}),
        history_table=history_table or MagicMock(),
    )


def test_happy_path_no_existing_instances():
    ssm = MagicMock()
    history = MagicMock()
    result = _register(
        {"managedInstanceId": "mi-aaa", "chassisSerial": "SERIAL1"},
        ssm=ssm,
        history_table=history,
    )

    assert result["ok"] is True
    assert result["deregistered"] == []
    ssm.deregister_managed_instance.assert_not_called()
    ssm.add_tags_to_resource.assert_called_once()
    args = ssm.add_tags_to_resource.call_args.kwargs
    assert args["ResourceId"] == "mi-aaa"
    assert args["Tags"] == [{"Key": "ChassisSerial", "Value": "SERIAL1"}]
    # New mi gets a history row with no deregisteredAt
    history.put_item.assert_called_once()
    new_row = history.put_item.call_args.kwargs["Item"]
    assert new_row["chassisSerial"] == "SERIAL1"
    assert new_row["managedInstanceId"] == "mi-aaa"
    assert "deregisteredAt" not in new_row


def test_history_captured_before_deregister():
    """Each old mi gets a history row with its carName/fleet read from
    the status table BEFORE we deregister it — otherwise we'd lose the
    link from chassis to carName for race-record joins."""
    ssm = MagicMock()
    history = MagicMock()
    status_rows = {
        "mi-old1": {
            "InstanceId": "mi-old1",
            "ComputerName": "deepracer01",
            "fleetId": "fleet-a",
            "fleetName": "Fleet A",
        },
    }
    result = _register(
        {"managedInstanceId": "mi-new", "chassisSerial": "SERIAL1"},
        ssm=ssm,
        tagging_arns=[
            "arn:aws:ssm:eu-west-1:123:managed-instance/mi-old1",
            "arn:aws:ssm:eu-west-1:123:managed-instance/mi-new",
        ],
        status_rows=status_rows,
        history_table=history,
    )
    assert result["deregistered"] == ["mi-old1"]

    # History writes: one for old1 (with carName/fleet + deregisteredAt),
    # one for the new mi.
    put_calls = history.put_item.call_args_list
    written_rows = [c.kwargs["Item"] for c in put_calls]
    old_rows = [r for r in written_rows if r["managedInstanceId"] == "mi-old1"]
    new_rows = [r for r in written_rows if r["managedInstanceId"] == "mi-new"]
    assert len(old_rows) == 1
    assert len(new_rows) == 1
    assert old_rows[0]["carName"] == "deepracer01"
    assert old_rows[0]["fleetId"] == "fleet-a"
    assert old_rows[0]["fleetName"] == "Fleet A"
    assert "deregisteredAt" in old_rows[0]
    assert "deregisteredAt" not in new_rows[0]


def test_history_write_failure_is_non_fatal():
    """A boto error on history write must NOT prevent the SSM tag or
    deregister steps — losing the audit trail is bad but losing the
    activation entirely is worse."""
    ssm = MagicMock()
    history = MagicMock()
    history.put_item.side_effect = Exception("ddb down")

    result = _register(
        {"managedInstanceId": "mi-new", "chassisSerial": "X"},
        ssm=ssm,
        tagging_arns=["arn:aws:ssm:eu-west-1:123:managed-instance/mi-old"],
        history_table=history,
    )
    assert result["ok"] is True
    assert result["deregistered"] == ["mi-old"]
    ssm.add_tags_to_resource.assert_called_once()


def test_status_table_missing_row_still_writes_minimal_history():
    """Old mi with no row in the cars-status DDB still gets a history
    entry — chassis/mi linkage is the load-bearing data; carName is
    enrichment that's nice-to-have."""
    ssm = MagicMock()
    history = MagicMock()
    result = _register(
        {"managedInstanceId": "mi-new", "chassisSerial": "X"},
        ssm=ssm,
        tagging_arns=["arn:aws:ssm:eu-west-1:123:managed-instance/mi-unknown"],
        status_rows={},  # mi-unknown not in DDB
        history_table=history,
    )
    assert result["deregistered"] == ["mi-unknown"]
    old_row = next(
        c.kwargs["Item"]
        for c in history.put_item.call_args_list
        if c.kwargs["Item"]["managedInstanceId"] == "mi-unknown"
    )
    assert old_row["chassisSerial"] == "X"
    assert "carName" not in old_row  # no enrichment
    assert "deregisteredAt" in old_row


def test_dedups_older_managed_instances():
    ssm = MagicMock()
    result = _register(
        {"managedInstanceId": "mi-new", "chassisSerial": "SERIAL1"},
        ssm=ssm,
        tagging_arns=[
            "arn:aws:ssm:eu-west-1:123:managed-instance/mi-old1",
            "arn:aws:ssm:eu-west-1:123:managed-instance/mi-old2",
            "arn:aws:ssm:eu-west-1:123:managed-instance/mi-new",
        ],
    )

    assert sorted(result["deregistered"]) == ["mi-old1", "mi-old2"]
    deregister_ids = sorted(
        c.kwargs["InstanceId"] for c in ssm.deregister_managed_instance.call_args_list
    )
    assert deregister_ids == ["mi-old1", "mi-old2"]


def test_validates_managed_instance_id_prefix():
    ssm = MagicMock()
    result = _register({"managedInstanceId": "i-ec2id", "chassisSerial": "X"}, ssm=ssm)
    assert result["ok"] is False
    ssm.add_tags_to_resource.assert_not_called()


def test_requires_chassis_serial():
    # chassisSerial="" now triggers the SSM-fetch path; with a plain MagicMock
    # ssm the Status never reaches a terminal value so _fetch_serial_via_ssm
    # returns "" — the instance gets a lastSerialCheck tag and we get
    # serialStatus=unavailable instead of a hard "required" error.
    ssm = _mk_ssm_fetch("\n")  # empty output → serial unavailable
    result = _register({"managedInstanceId": "mi-aaa", "chassisSerial": ""}, ssm=ssm)
    assert result["ok"] is False
    assert result["serialStatus"] == "unavailable"
    keys = [t["Key"] for c in ssm.add_tags_to_resource.call_args_list for t in c.kwargs["Tags"]]
    assert "lastSerialCheck" in keys
    assert "ChassisSerial" not in keys


def test_skips_self_when_already_in_dedup_results():
    """If the new instance was already tagged (e.g. a retry), we still
    re-tag it but never deregister ourselves."""
    ssm = MagicMock()
    result = _register(
        {"managedInstanceId": "mi-new", "chassisSerial": "X"},
        ssm=ssm,
        tagging_arns=["arn:aws:ssm:eu-west-1:123:managed-instance/mi-new"],
    )

    assert result["deregistered"] == []
    ssm.deregister_managed_instance.assert_not_called()
    ssm.add_tags_to_resource.assert_called_once()


def test_deregister_errors_are_non_fatal():
    """A boto error on one deregister shouldn't stop the others or
    prevent the new instance being tagged."""
    ssm = MagicMock()
    ssm.deregister_managed_instance.side_effect = [Exception("nope"), None]

    result = _register(
        {"managedInstanceId": "mi-new", "chassisSerial": "X"},
        ssm=ssm,
        tagging_arns=[
            "arn:aws:ssm:eu-west-1:123:managed-instance/mi-fails",
            "arn:aws:ssm:eu-west-1:123:managed-instance/mi-ok",
        ],
    )

    # Only the second one made it into the "deregistered" list because
    # the first raised, but both calls were attempted.
    assert result["deregistered"] == ["mi-ok"]
    assert ssm.deregister_managed_instance.call_count == 2
    ssm.add_tags_to_resource.assert_called_once()


def test_fetch_serial_via_ssm_returns_trimmed_value():
    sys.modules.pop("index", None)
    from index import _fetch_serial_via_ssm
    ssm = _mk_ssm_fetch("AMSS-9QCJ\n")
    assert _fetch_serial_via_ssm(ssm, "mi-abc", poll_seconds=0) == "AMSS-9QCJ"
    ssm.send_command.assert_called_once()


def test_fetch_serial_via_ssm_empty_output_returns_blank():
    sys.modules.pop("index", None)
    from index import _fetch_serial_via_ssm
    ssm = _mk_ssm_fetch("\n")
    assert _fetch_serial_via_ssm(ssm, "mi-abc", poll_seconds=0) == ""


def test_fetch_serial_via_ssm_failed_command_returns_blank():
    sys.modules.pop("index", None)
    from index import _fetch_serial_via_ssm
    ssm = _mk_ssm_fetch("ignored", status="Failed")
    assert _fetch_serial_via_ssm(ssm, "mi-abc", poll_seconds=0) == ""


def test_fetch_serial_via_ssm_send_command_error_returns_blank():
    sys.modules.pop("index", None)
    from index import _fetch_serial_via_ssm
    ssm = MagicMock()
    ssm.send_command.side_effect = Exception("throttled")
    assert _fetch_serial_via_ssm(ssm, "mi-abc", poll_seconds=0) == ""
    ssm.get_command_invocation.assert_not_called()


def test_fetch_serial_via_ssm_never_terminal_returns_blank():
    sys.modules.pop("index", None)
    from index import _fetch_serial_via_ssm, SSM_POLL_ATTEMPTS
    ssm = MagicMock()
    ssm.send_command.return_value = {"Command": {"CommandId": "cmd-1"}}
    ssm.get_command_invocation.return_value = {"Status": "InProgress", "StandardOutputContent": ""}
    assert _fetch_serial_via_ssm(ssm, "mi-abc", poll_seconds=0) == ""
    assert ssm.get_command_invocation.call_count == SSM_POLL_ATTEMPTS


def test_register_fetches_serial_when_not_supplied():
    ssm = _mk_ssm_fetch("AMSS-9QCJ\n")
    history = MagicMock()
    result = _register({"managedInstanceId": "mi-new"}, ssm=ssm, history_table=history)
    assert result["ok"] is True
    assert result["taggedInstanceId"] == "mi-new"
    add = ssm.add_tags_to_resource.call_args.kwargs
    assert {"Key": "ChassisSerial", "Value": "AMSS-9QCJ"} in add["Tags"]


def test_register_marks_unavailable_when_no_serial():
    # No serial supplied AND the SSM read returns nothing -> Unavailable.
    # (test_requires_chassis_serial covers the explicit empty-string variant;
    #  both normalise to "" via .get(...,"").strip().)
    ssm = _mk_ssm_fetch("\n")
    result = _register({"managedInstanceId": "mi-new"}, ssm=ssm, history_table=MagicMock())
    assert result["ok"] is False
    assert result["serialStatus"] == "unavailable"
    keys = [t["Key"] for c in ssm.add_tags_to_resource.call_args_list for t in c.kwargs["Tags"]]
    assert "lastSerialCheck" in keys
    assert "ChassisSerial" not in keys
