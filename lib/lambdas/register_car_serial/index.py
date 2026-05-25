#!/usr/bin/python3
# encoding=utf-8
"""
register_car_serial — tag a newly-activated managed-instance with its
chassis serial, capture history for dedup victims, and dedup older
managed-instances that share the serial.

Invoked asynchronously by the `car_status_update` poller when it sees an
online managed-instance with no `ChassisSerial` tag. With only
`{managedInstanceId}` it reads the chassis serial off the car via SSM Run
Command (`AWS-RunShellScript`); it can also be called directly with
`{managedInstanceId, chassisSerial}` (used by tests / manual invokes).

Input payload:
    {
        "managedInstanceId": "mi-0123abcd...",
        "chassisSerial": "ABCDEF123"   # optional — read off the car via SSM Run Command when absent
    }

If no serial can be read, the instance is tagged `lastSerialCheck` and the call returns
`serialStatus='unavailable'` (no `ChassisSerial` tag).

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

Failure modes are non-fatal — the poller invokes this Lambda best-effort
and ignores errors, so the registration flow still succeeds even if dedup,
history capture, or tagging fails.
"""
import os
import time
from datetime import datetime, timezone

from aws_lambda_powertools import Logger, Tracer

tracer = Tracer()
logger = Logger()

CHASSIS_TAG_KEY = "ChassisSerial"

# Written when no serial can be read so the poll backs off and the UI shows "Unavailable" (used by the empty-serial path).
LAST_CHECK_TAG_KEY = "lastSerialCheck"
SSM_POLL_SECONDS = 2
SSM_POLL_ATTEMPTS = 12  # ~24s cap for a `cat` to report back

# Read the device's stable hardware serial. DeepRacer (x86) exposes it at the
# DMI chassis_serial; Raspberry Pi (ARM, no DMI) exposes the SoC serial via the
# devicetree node or /proc/cpuinfo. We deliberately do NOT fall back to
# product_serial/board_serial — those are different DMI fields with different
# values, so substituting one would capture an inconsistent id for the same car.
SERIAL_READ_SCRIPT = r"""
v=$(tr -d '\0' < /sys/class/dmi/id/chassis_serial 2>/dev/null | tr -d '[:space:]')
case "$v" in ""|"Defaultstring"|"ToBeFilledByO.E.M."|"0000000000000000"|"None") ;; *) echo "$v"; exit 0;; esac
v=$(tr -d '\0' < /sys/firmware/devicetree/base/serial-number 2>/dev/null | tr -d '[:space:]')
case "$v" in ""|"0000000000000000") ;; *) echo "$v"; exit 0;; esac
v=$(awk '/^Serial/{print $3}' /proc/cpuinfo 2>/dev/null | tr -d '[:space:]')
case "$v" in ""|"0000000000000000") ;; *) echo "$v";; esac
"""

_PLACEHOLDERS = {"", "defaultstring", "tobefilledbyo.e.m.", "0000000000000000", "none"}


def _is_real_serial(value: str) -> bool:
    s = value.strip()
    return s != "" and s.lower() not in _PLACEHOLDERS


def _fetch_serial_via_ssm(ssm, managed_instance_id, poll_seconds=SSM_POLL_SECONDS):
    """Run the multi-source read on the car via SSM Run Command and return the
    trimmed serial, or "" if the command failed or produced nothing usable."""
    try:
        command_id = ssm.send_command(
            InstanceIds=[managed_instance_id],
            DocumentName="AWS-RunShellScript",
            Parameters={"commands": [SERIAL_READ_SCRIPT]},
        )["Command"]["CommandId"]
    except Exception as exc:  # noqa: BLE001 — offline / throttled, retried next poll
        logger.warning("send_command failed", extra={"mi": managed_instance_id, "error": str(exc)})
        return ""

    for _ in range(SSM_POLL_ATTEMPTS):
        try:
            inv = ssm.get_command_invocation(CommandId=command_id, InstanceId=managed_instance_id)
        except Exception:  # noqa: BLE001 — invocation not registered yet
            time.sleep(poll_seconds)
            continue
        status = inv.get("Status")
        if status in ("Success", "Failed", "Cancelled", "TimedOut"):
            out = (inv.get("StandardOutputContent") or "").strip()
            return out if status == "Success" and _is_real_serial(out) else ""
        time.sleep(poll_seconds)
    return ""


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

    # If the caller didn't supply a serial (the server-side poll path), read it
    # off the car via SSM Run Command.
    if not chassis_serial:
        chassis_serial = _fetch_serial_via_ssm(ssm, managed_instance_id)

    if not chassis_serial:
        # Mark that we tried, so the poll backs off instead of hammering SSM,
        # and the UI can show "Unavailable" rather than "Pending".
        ssm.add_tags_to_resource(
            ResourceType="ManagedInstance",
            ResourceId=managed_instance_id,
            Tags=[{"Key": LAST_CHECK_TAG_KEY, "Value": datetime.now(timezone.utc).isoformat()}],
        )
        return {"ok": False, "serialStatus": "unavailable", "managedInstanceId": managed_instance_id}

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
