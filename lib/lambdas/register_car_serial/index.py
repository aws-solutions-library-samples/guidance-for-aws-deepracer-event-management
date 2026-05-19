#!/usr/bin/python3
# encoding=utf-8
"""
register_car_serial — tag a newly-activated managed-instance with its
chassis serial, capture history for dedup victims, and dedup older
managed-instances that share the serial.

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
    2. For each old mi-xxx (not the one we're registering):
        a. Read its current metadata (carName, fleet) from the cars-status
           DDB table, write a CarsHistory row with deregisteredAt = now.
           This persists the link from chassis_serial → mi-xxx → carName
           BEFORE the SSM record disappears, so future "show all races by
           this physical car" queries can still resolve historical race
           entries (which reference carName at race time) back to the
           same chassis.
        b. ssm.deregister_managed_instance — removes the mi from SSM.
    3. Tag the new managed-instance with ChassisSerial=<serial>, then
       record it in CarsHistory too (deregisteredAt = null).

Failure modes are non-fatal — the script invokes us best-effort and
ignores errors, so the activation itself still succeeds even if dedup,
history capture, or tagging fails.
"""
import os
from datetime import datetime, timezone

from aws_lambda_powertools import Logger, Tracer

tracer = Tracer()
logger = Logger()

CHASSIS_TAG_KEY = "ChassisSerial"

CARS_STATUS_TABLE = os.environ.get("CARS_STATUS_TABLE", "")
CARS_HISTORY_TABLE = os.environ.get("CARS_HISTORY_TABLE", "")


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def lambda_handler(event, context):
    # boto3 imported lazily so unit tests can exercise `_register` with
    # mocked clients without needing boto3 installed in the test venv.
    import boto3
    ddb = boto3.resource("dynamodb")
    return _register(
        event,
        ssm=boto3.client("ssm"),
        tagging=boto3.client("resourcegroupstaggingapi"),
        status_table=ddb.Table(CARS_STATUS_TABLE) if CARS_STATUS_TABLE else None,
        history_table=ddb.Table(CARS_HISTORY_TABLE) if CARS_HISTORY_TABLE else None,
    )


def _register(event, ssm, tagging, status_table=None, history_table=None):
    """
    Pure-ish core that takes injected clients — keeps the Lambda handler
    thin and lets unit tests pass in mocks without needing to patch
    import-time module state.
    """
    managed_instance_id = (event or {}).get("managedInstanceId", "").strip()
    chassis_serial = (event or {}).get("chassisSerial", "").strip()

    if not managed_instance_id.startswith("mi-"):
        return {"ok": False, "error": "managedInstanceId must start with 'mi-'"}
    if not chassis_serial:
        return {"ok": False, "error": "chassisSerial is required"}

    now = datetime.now(timezone.utc).isoformat()
    deregistered = []
    for old_id in _find_existing_instances(tagging, chassis_serial):
        if old_id == managed_instance_id:
            continue
        # Capture history BEFORE we deregister so we can read the old
        # mi's last-known carName/fleet from the cars-status DDB table.
        # Best-effort: a missing row or DDB error shouldn't block the
        # dedup itself.
        _record_history(
            history_table,
            status_table,
            chassis_serial=chassis_serial,
            managed_instance_id=old_id,
            now=now,
            deregistered_at=now,
        )
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
    # Record the new mi too — its carName won't be in status_table yet
    # (status updater hasn't run), so this row carries just the linkage;
    # later status-update cycles will fill it in via a separate flow if
    # we ever want lastSeen freshness here.
    _record_history(
        history_table,
        status_table,
        chassis_serial=chassis_serial,
        managed_instance_id=managed_instance_id,
        now=now,
        deregistered_at=None,
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


def _record_history(history_table, status_table, *, chassis_serial, managed_instance_id, now, deregistered_at):
    """
    Write a CarsHistory row capturing the link between chassis_serial and
    managed_instance_id. Pulls carName/fleet from the cars-status table
    when available — that's the only place we know the human-readable
    name for an mi-xxx by the time we get here.

    Best-effort: any failure is logged and swallowed so the calling
    dedup/tag flow continues.
    """
    if history_table is None:
        return
    item = {
        "chassisSerial": chassis_serial,
        "managedInstanceId": managed_instance_id,
        "lastSeen": now,
    }
    if deregistered_at is not None:
        item["deregisteredAt"] = deregistered_at
    if status_table is not None:
        try:
            response = status_table.get_item(Key={"InstanceId": managed_instance_id})
            existing = response.get("Item") or {}
            for source_key, dest_key in (
                ("ComputerName", "carName"),
                ("fleetId", "fleetId"),
                ("fleetName", "fleetName"),
                ("RegistrationDate", "registrationDate"),
            ):
                value = existing.get(source_key)
                if value:
                    item[dest_key] = value
        except Exception as exc:  # noqa: BLE001 — best-effort enrichment
            logger.warning(
                "status_table lookup failed",
                extra={"managedInstanceId": managed_instance_id, "error": str(exc)},
            )
    try:
        history_table.put_item(Item=item)
        logger.info("wrote cars-history row", extra={"row": item})
    except Exception as exc:  # noqa: BLE001 — best-effort write
        logger.warning(
            "history write failed",
            extra={"managedInstanceId": managed_instance_id, "error": str(exc)},
        )
