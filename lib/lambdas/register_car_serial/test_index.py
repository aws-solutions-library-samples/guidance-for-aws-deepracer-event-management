"""Tests for register_car_serial Lambda."""
import os
import sys
from unittest.mock import MagicMock

sys.path.insert(0, os.path.dirname(__file__))


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


def _register(event, *, ssm=None, tagging_arns=()):
    """Invoke the pure core with injected mocks — bypasses the
    Powertools logging decorator that needs a real Lambda context."""
    from index import _register

    return _register(
        event,
        ssm=ssm or MagicMock(),
        tagging=_mk_tagging(tagging_arns),
    )


def test_happy_path_no_existing_instances():
    ssm = MagicMock()
    result = _register({"managedInstanceId": "mi-aaa", "chassisSerial": "SERIAL1"}, ssm=ssm)

    assert result["ok"] is True
    assert result["deregistered"] == []
    ssm.deregister_managed_instance.assert_not_called()
    ssm.add_tags_to_resource.assert_called_once()
    args = ssm.add_tags_to_resource.call_args.kwargs
    assert args["ResourceId"] == "mi-aaa"
    assert args["Tags"] == [{"Key": "ChassisSerial", "Value": "SERIAL1"}]


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
    ssm = MagicMock()
    result = _register({"managedInstanceId": "mi-aaa", "chassisSerial": ""}, ssm=ssm)

    assert result["ok"] is False
    ssm.add_tags_to_resource.assert_not_called()


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
