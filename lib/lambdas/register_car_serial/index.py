#!/usr/bin/python3
# encoding=utf-8
"""
register_car_serial — tag a newly-activated managed-instance with its
chassis serial and dedup older managed-instances that share the serial.

Invoked directly (not via AppSync) from `car_activation.sh` after the SSM
agent registers. The car runs under the same IAM role passed to
`ssm.create_activation`, which we extend to allow `lambda:InvokeFunction`
on this Lambda only.

Input payload:
    {
        "managedInstanceId": "mi-0123abcd...",
        "chassisSerial": "ABCDEF123"
    }

Behaviour:
    1. Find existing ssm:managed-instance resources tagged
       ChassisSerial=<serial> via the Resource Groups Tagging API.
    2. Deregister any whose InstanceId != managedInstanceId. That
       releases the mi-xxxx slot and removes their SSM agent
       registration; the matching activation can be cleaned up
       separately by the existing `cleanup_hybrid_activations.py`
       script. (We don't delete activations here — we only have
       Lambda credentials, not console access to associate a managed-
       instance back to its parent activation.)
    3. Tag the new managed-instance with ChassisSerial=<serial>.

Failure modes are non-fatal — the script invokes us best-effort and
ignores errors, so the activation itself still succeeds even if dedup
or tagging fails.
"""
from aws_lambda_powertools import Logger, Tracer

tracer = Tracer()
logger = Logger()

CHASSIS_TAG_KEY = "ChassisSerial"


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def lambda_handler(event, context):
    # boto3 imported lazily so unit tests can exercise `_register` with
    # mocked clients without needing boto3 installed in the test venv.
    import boto3
    return _register(
        event,
        ssm=boto3.client("ssm"),
        tagging=boto3.client("resourcegroupstaggingapi"),
    )


def _register(event, ssm, tagging):
    """
    Pure-ish core that takes injected boto3 clients — keeps the Lambda
    handler thin and lets unit tests pass in mocks without needing to
    patch import-time module state.
    """
    managed_instance_id = (event or {}).get("managedInstanceId", "").strip()
    chassis_serial = (event or {}).get("chassisSerial", "").strip()

    if not managed_instance_id.startswith("mi-"):
        return {"ok": False, "error": "managedInstanceId must start with 'mi-'"}
    if not chassis_serial:
        return {"ok": False, "error": "chassisSerial is required"}

    deregistered = []
    for old_id in _find_existing_instances(tagging, chassis_serial):
        if old_id == managed_instance_id:
            continue
        try:
            ssm.deregister_managed_instance(InstanceId=old_id)
            deregistered.append(old_id)
            logger.info("deregistered stale mi", extra={"oldInstanceId": old_id})
        except Exception as exc:  # noqa: BLE001 — best-effort cleanup
            logger.warning(
                "deregister failed", extra={"oldInstanceId": old_id, "error": str(exc)}
            )

    ssm.add_tags_to_resource(
        ResourceType="ManagedInstance",
        ResourceId=managed_instance_id,
        Tags=[{"Key": CHASSIS_TAG_KEY, "Value": chassis_serial}],
    )

    return {
        "ok": True,
        "taggedInstanceId": managed_instance_id,
        "deregistered": deregistered,
    }


def _find_existing_instances(tagging, chassis_serial: str) -> list[str]:
    """Return mi-xxx ids of every ManagedInstance tagged ChassisSerial=<serial>."""
    ids: list[str] = []
    paginator = tagging.get_paginator("get_resources")
    for page in paginator.paginate(
        TagFilters=[{"Key": CHASSIS_TAG_KEY, "Values": [chassis_serial]}],
        ResourceTypeFilters=["ssm:managed-instance"],
    ):
        for resource in page.get("ResourceTagMappingList", []):
            # ARN shape: arn:aws:ssm:<region>:<acct>:managed-instance/mi-xxxx
            arn = resource.get("ResourceARN", "")
            if "/mi-" in arn:
                ids.append(arn.split("/", 1)[1])
    return ids
