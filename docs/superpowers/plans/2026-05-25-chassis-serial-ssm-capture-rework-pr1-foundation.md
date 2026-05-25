# Chassis-Serial Capture Rework — PR 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture each device's stable hardware serial server-side via SSM Run Command (no car-side AWS CLI/creds), keep a complete+current activation lineage, and surface a `Pending`/`Unavailable` serial status — reusing the existing tag/dedup/history core.

**Architecture:** Flip capture direction — `car_status_update_function` (the existing SSM poller) detects online cars missing a `ChassisSerial` tag and async-invokes `register_car_serial`, which runs a multi-source `cat`/`awk` read on the car via `ssm:SendCommand`, validates the serial, then tags + dedups + writes history. The poller also upserts each tagged car's CarsHistory row every cycle (lineage completeness) and derives the displayed serial status.

**Tech Stack:** Python 3.12 Lambda (boto3, AWS Lambda Powertools, pytest), AWS CDK (TypeScript, `awscdk-appsync-utils`), Bash (`car_activation.sh`), React/CloudScape (TypeScript).

**Spec:** `docs/superpowers/specs/2026-05-25-chassis-serial-ssm-capture-rework-design.md`
**Branch:** `feat/car-chassis-serial`
**Scope note:** #66 (cross-hostname race join + view) is **PR 2**, a separate plan. This plan is independently shippable and car-testable.

---

### Task 1: Multi-source serial read + SSM fetch in `register_car_serial`

**Files:**
- Modify: `lib/lambdas/register_car_serial/index.py`
- Test: `lib/lambdas/register_car_serial/test_index.py`

Run tests with the venv created by `make local.config.python`:
`./.venv/bin/python -m pytest lib/lambdas/register_car_serial/test_index.py -v`

- [ ] **Step 1: Write the failing test for the SSM fetch helper**

Add to `test_index.py`:

```python
def _mk_ssm_fetch(stdout, status="Success"):
    ssm = MagicMock()
    ssm.send_command.return_value = {"Command": {"CommandId": "cmd-1"}}
    ssm.get_command_invocation.return_value = {
        "Status": status,
        "StandardOutputContent": stdout,
    }
    return ssm

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
```

- [ ] **Step 2: Run to verify it fails**

Run: `./.venv/bin/python -m pytest lib/lambdas/register_car_serial/test_index.py -k fetch_serial -v`
Expected: FAIL with `ImportError: cannot import name '_fetch_serial_via_ssm'`

- [ ] **Step 3: Implement the read script + fetch helper**

In `index.py`, after the existing `CHASSIS_TAG_KEY` constant add:

```python
import time

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
    return value.strip().lower().rstrip() not in _PLACEHOLDERS and value.strip() != ""


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
```

- [ ] **Step 4: Run to verify it passes**

Run: `./.venv/bin/python -m pytest lib/lambdas/register_car_serial/test_index.py -k fetch_serial -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/lambdas/register_car_serial/index.py lib/lambdas/register_car_serial/test_index.py
git commit -m "feat(cars): SSM multi-source serial read helper in register_car_serial"
```

---

### Task 2: Make `chassisSerial` optional — fetch when absent, mark `lastSerialCheck` when empty

**Files:**
- Modify: `lib/lambdas/register_car_serial/index.py` (`lambda_handler`, `_register`)
- Test: `lib/lambdas/register_car_serial/test_index.py`

- [ ] **Step 1: Write the failing tests**

```python
def test_register_fetches_serial_when_not_supplied():
    sys.modules.pop("index", None)
    from index import _register
    ssm = _mk_ssm_fetch("AMSS-9QCJ\n")
    history = MagicMock()
    result = _register({"managedInstanceId": "mi-new"}, ssm=ssm, history_table=history)
    assert result["ok"] is True
    assert result["taggedInstanceId"] == "mi-new"
    # tagged with the fetched serial
    add = ssm.add_tags_to_resource.call_args.kwargs
    assert {"Key": "ChassisSerial", "Value": "AMSS-9QCJ"} in add["Tags"]

def test_register_marks_unavailable_when_no_serial():
    sys.modules.pop("index", None)
    from index import _register
    ssm = _mk_ssm_fetch("\n")  # empty
    result = _register({"managedInstanceId": "mi-new"}, ssm=ssm, history_table=MagicMock())
    assert result["ok"] is False
    assert result["serialStatus"] == "unavailable"
    # a lastSerialCheck tag was written, but NOT a ChassisSerial tag
    keys = [t["Key"] for c in ssm.add_tags_to_resource.call_args_list for t in c.kwargs["Tags"]]
    assert "lastSerialCheck" in keys
    assert "ChassisSerial" not in keys
```

The `_register` test helper (top of `test_index.py`) already forwards `ssm=`; ensure the helper passes the raw `event` through unchanged (it does).

- [ ] **Step 2: Run to verify they fail**

Run: `./.venv/bin/python -m pytest lib/lambdas/register_car_serial/test_index.py -k "fetches_serial or unavailable" -v`
Expected: FAIL (serial required → `{"ok": False, "error": "chassisSerial is required"}`)

- [ ] **Step 3: Implement optional-serial + unavailable marking**

In `_register`, replace the early `chassis_serial` validation block:

```python
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
```

(The rest of `_register` — find-existing, dedup, tag, history — is unchanged.)

`lambda_handler` already injects `ssm=boto3.client("ssm")`, so no change there.

- [ ] **Step 4: Run the full file to verify pass + no regressions**

Run: `./.venv/bin/python -m pytest lib/lambdas/register_car_serial/test_index.py -v`
Expected: PASS (existing 9 + the 5 new = 14)

- [ ] **Step 5: Commit**

```bash
git add lib/lambdas/register_car_serial/index.py lib/lambdas/register_car_serial/test_index.py
git commit -m "feat(cars): register_car_serial fetches serial via SSM when not supplied; marks lastSerialCheck on empty"
```

---

### Task 3: Poller — serial status, history upsert, and capture trigger

**Files:**
- Modify: `lib/lambdas/car_status_update_function/index.py`
- Create: `lib/lambdas/car_status_update_function/test_index.py`

- [ ] **Step 1: Write the failing tests (new file)**

```python
import os, sys, importlib
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.dirname(__file__))

def _load(monkeypatch_env=None):
    for k, v in (monkeypatch_env or {}).items():
        os.environ[k] = v
    sys.modules.pop("index", None)
    return importlib.import_module("index")

def test_serial_status_value_pending_unavailable():
    idx = _load()
    assert idx.derive_serial_status({"ChassisSerial": "AMSS-9QCJ"}) == "AMSS-9QCJ"
    assert idx.derive_serial_status({"lastSerialCheck": "2026-05-25T00:00:00Z"}) == "Unavailable"
    assert idx.derive_serial_status({}) == "Pending"

def test_capture_due_only_when_untagged_and_back_off_elapsed():
    idx = _load()
    now = datetime(2026, 5, 25, 12, 0, tzinfo=timezone.utc)
    assert idx.capture_due({}, now) is True                       # never tried
    assert idx.capture_due({"ChassisSerial": "X"}, now) is False  # already tagged
    recent = (now.replace(hour=11, minute=30)).isoformat()
    assert idx.capture_due({"lastSerialCheck": recent}, now) is False   # within 1h back-off
    old = (now.replace(hour=10, minute=0)).isoformat()
    assert idx.capture_due({"lastSerialCheck": old}, now) is True       # back-off elapsed
```

- [ ] **Step 2: Run to verify it fails**

Run: `./.venv/bin/python -m pytest lib/lambdas/car_status_update_function/test_index.py -v`
Expected: FAIL with `AttributeError: module 'index' has no attribute 'derive_serial_status'`

- [ ] **Step 3: Implement status derivation + back-off helpers**

Add to `car_status_update_function/index.py` (near the top, after the clients):

```python
import json
from datetime import timezone

client_lambda = boto3.client("lambda")
_ddb = boto3.resource("dynamodb")

CARS_HISTORY_TABLE = os.environ.get("CARS_HISTORY_TABLE", "")
REGISTER_CAR_SERIAL_FUNCTION = os.environ.get("REGISTER_CAR_SERIAL_FUNCTION", "")
SERIAL_BACKOFF = timedelta(hours=1)


def derive_serial_status(instance: dict) -> str:
    if instance.get("ChassisSerial"):
        return instance["ChassisSerial"]
    if instance.get("lastSerialCheck"):
        return "Unavailable"
    return "Pending"


def capture_due(instance: dict, now) -> bool:
    if instance.get("ChassisSerial"):
        return False
    last = instance.get("lastSerialCheck")
    if not last:
        return True
    try:
        return (now - datetime.fromisoformat(last)) >= SERIAL_BACKOFF
    except ValueError:
        return True
```

Note: add `lastSerialCheck` to the `tag_keys_to_copy` list in `fetch_and_process_tags` so the poller can read it.

- [ ] **Step 4: Run to verify pass**

Run: `./.venv/bin/python -m pytest lib/lambdas/car_status_update_function/test_index.py -v`
Expected: PASS (2 tests)

- [ ] **Step 5: Wire the helpers into the loop + history upsert + capture invoke**

In `lambda_handler`, inside `if instance["PingStatus"] == "Online":` (after `fetch_and_process_tags(instance)`):

```python
                    now = datetime.now(timezone.utc)
                    instance["ChassisSerialStatus"] = derive_serial_status(instance)
                    if instance.get("ChassisSerial"):
                        upsert_history(instance, now)
                    elif REGISTER_CAR_SERIAL_FUNCTION and capture_due(instance, now):
                        client_lambda.invoke(
                            FunctionName=REGISTER_CAR_SERIAL_FUNCTION,
                            InvocationType="Event",
                            Payload=json.dumps({"managedInstanceId": instance["InstanceId"]}).encode(),
                        )
```

Add the `upsert_history` function:

```python
def upsert_history(instance: dict, now) -> None:
    """Keep the CarsHistory row for the current activation complete + fresh."""
    if not CARS_HISTORY_TABLE:
        return
    item = {
        "chassisSerial": instance["ChassisSerial"],
        "managedInstanceId": instance["InstanceId"],
        "lastSeen": now.isoformat(),
    }
    for src, dst in (("ComputerName", "carName"), ("fleetId", "fleetId"),
                     ("fleetName", "fleetName"), ("RegistrationDate", "registrationDate")):
        if instance.get(src):
            item[dst] = instance[src]
    try:
        _ddb.Table(CARS_HISTORY_TABLE).update_item(
            Key={"chassisSerial": item["chassisSerial"], "managedInstanceId": item["managedInstanceId"]},
            UpdateExpression="SET " + ", ".join(f"#{k}=:{k}" for k in item if k not in ("chassisSerial", "managedInstanceId")),
            ExpressionAttributeNames={f"#{k}": k for k in item if k not in ("chassisSerial", "managedInstanceId")},
            ExpressionAttributeValues={f":{k}": v for k, v in item.items() if k not in ("chassisSerial", "managedInstanceId")},
        )
    except Exception as e:  # noqa: BLE001 — best-effort, never block status update
        logger.warning(f"history upsert failed for {item['managedInstanceId']}: {e}")
```

Add `ChassisSerialStatus` to the `allowed_fields` list in `clean_instance_data` (connected branch) and to the `carsUpdateStatus` mutation selection in `send_status_update` (next to `ChassisSerial`).

- [ ] **Step 6: Add a test for the wired behaviour (invoke gate + upsert call)**

```python
def test_online_untagged_triggers_capture_invoke():
    idx = _load({"REGISTER_CAR_SERIAL_FUNCTION": "fn"})
    idx.client_lambda = MagicMock()
    idx.client_ssm = MagicMock()
    idx.client_ssm.list_tags_for_resource.return_value = {"TagList": []}
    idx.client_ssm.list_inventory_entries.return_value = {"Entries": []}
    event = {"Instances": {"InstanceInformationList": [
        {"InstanceId": "mi-1", "PingStatus": "Online", "ResourceType": "ManagedInstance"}]}}
    with patch.object(idx, "send_status_update"):
        idx.lambda_handler(event, None)
    idx.client_lambda.invoke.assert_called_once()
    assert idx.client_lambda.invoke.call_args.kwargs["InvocationType"] == "Event"
```

Run: `./.venv/bin/python -m pytest lib/lambdas/car_status_update_function/test_index.py -v`
Expected: PASS (3 tests)

- [ ] **Step 7: Commit**

```bash
git add lib/lambdas/car_status_update_function/
git commit -m "feat(cars): poll-driven serial capture trigger + history upsert + serial status"
```

---

### Task 4: AppSync schema — `ChassisSerialStatus` field

**Files:**
- Modify: `lib/constructs/cars-manager.ts` (~line 538, the `carOnline` ObjectType + `carOnlineInput` InputType)

- [ ] **Step 1: Add the field to both the type and the input**

Next to `ChassisSerial: GraphqlType.string(),` in **both** the `carOnline` `ObjectType` (~line 538) and the `carOnlineInput` `InputType` (~line 548), add:

```ts
        ChassisSerialStatus: GraphqlType.string(),
```

- [ ] **Step 2: Build to verify the schema compiles**

Run: `npm run build`
Expected: exit 0 (TypeScript compiles)

- [ ] **Step 3: Commit**

```bash
git add lib/constructs/cars-manager.ts
git commit -m "feat(cars): add ChassisSerialStatus to carOnline type + input"
```

---

### Task 5: CDK — IAM + Lambda wiring

**Files:**
- Modify: `lib/constructs/cars-manager.ts`

- [ ] **Step 1: Grant the capture Lambda SSM Run Command perms**

In the `register_car_serial_handler.addToRolePolicy([...])` actions list (~line 327), add:

```ts
          'ssm:SendCommand',
          'ssm:GetCommandInvocation',
```

- [ ] **Step 2: Remove the now-unused car-side invoke grant**

Delete the line (~343):

```ts
    register_car_serial_handler.grantInvoke(ssmRunCommandRole);
```

- [ ] **Step 3: Wire the poller → capture invoke + history write + env**

On `carStatusUpdateHandler` (defined ~line 80–101), add after its definition:

```ts
    register_car_serial_handler.grantInvoke(carStatusUpdateHandler);
    carsHistoryTable.grantWriteData(carStatusUpdateHandler);
    carStatusUpdateHandler.addEnvironment('REGISTER_CAR_SERIAL_FUNCTION', register_car_serial_handler.functionName);
    carStatusUpdateHandler.addEnvironment('CARS_HISTORY_TABLE', carsHistoryTable.tableName);
```

(Place this after **both** `register_car_serial_handler` and `carsHistoryTable` are declared — i.e. after line ~344.)

- [ ] **Step 4: Build + run the CDK unit tests**

Run: `npm run build && npm test`
Expected: build exit 0; Jest `7 passed` (no `Fn::ImportValue`, SSM-param tests still green).

- [ ] **Step 5: Commit**

```bash
git add lib/constructs/cars-manager.ts
git commit -m "feat(cars): poller invokes capture + writes history; capture gains SSM Run Command; drop car-side invoke grant"
```

---

### Task 6: Remove the dead car-side invoke from the activation script + UI

**Files:**
- Modify: `website/public/car_activation.sh`
- Modify: `website/src/admin/carActivationOriginal.tsx`

- [ ] **Step 1: Strip the invoke from `car_activation.sh`**

- Remove the `serialLambda=NULL` line (~27).
- Remove the `l) serialLambda=${OPTARG};;` case (~37).
- Remove the entire chassis-serial callback block (the comment + `if [ ${serialLambda} != NULL ]; then ... fi`, ~241–266), leaving the `echo "...visible in DREM in ~5 minutes"` line intact.

- [ ] **Step 2: Strip the `-l` plumbing from `carActivationOriginal.tsx`**

- Remove the `carActivationConfig` / `serialLambdaArg` block (~146–152).
- Remove `+ serialLambdaArg` from the `setUpdateCommand(...)` template (~169).

- [ ] **Step 3: Verify the website type-checks**

Run: `cd website && npx tsc --noEmit && cd ..`
Expected: exit 0 (no unused-var / missing-ref errors from the removal)

- [ ] **Step 4: Commit**

```bash
git add website/public/car_activation.sh website/src/admin/carActivationOriginal.tsx
git commit -m "refactor(cars): drop car-side aws lambda invoke (capture is now server-side)"
```

---

### Task 7: Frontend — `Pending`/`Unavailable` badge in the ChassisSerial column

**Files:**
- Modify: `website/src/components/devices-table/deviceTableConfig.tsx`
- Modify: `website/src/types/domain.ts` (the `Car` type)
- Modify: `website/src/graphql/queries.ts` (the `listCars` selection) and `website/src/graphql/subscriptions.ts` (the cars-update subscription) — add `ChassisSerialStatus`
- Modify: `website/src/i18n/en/translation.json` (+ other locales) — `devices.serial-pending` / `devices.serial-unavailable`

- [ ] **Step 1: Add `ChassisSerialStatus` to the `Car` type**

In `website/src/types/domain.ts`, in the `Car` interface next to `ChassisSerial`:

```ts
  ChassisSerialStatus?: string;
```

- [ ] **Step 2: Add the field to the GraphQL selections**

In `website/src/graphql/queries.ts` (`listCars`) and `website/src/graphql/subscriptions.ts` (the `onCarsUpdateStatus`/cars subscription), add `ChassisSerialStatus` next to `ChassisSerial`.

- [ ] **Step 3: Render the badge**

In `deviceTableConfig.tsx`, replace the chassisSerial cell (~315):

```tsx
        cell: (item: Car) => {
          if (item.ChassisSerial) return item.ChassisSerial;
          if (item.ChassisSerialStatus === 'Unavailable')
            return <Badge color="grey">{i18next.t('devices.serial-unavailable')}</Badge>;
          return <Badge color="blue">{i18next.t('devices.serial-pending')}</Badge>;
        },
```

Add `import { Badge } from '@cloudscape-design/components';` at the top of the file if not already imported.

- [ ] **Step 4: Add the i18n strings**

In `website/src/i18n/en/translation.json` under `devices`:

```json
    "serial-pending": "Pending",
    "serial-unavailable": "Unavailable",
```

(Mirror in the other locale files — `de, es, fr, jp, se` — using the English string as a placeholder; they're translated in the normal i18n pass.)

- [ ] **Step 5: Verify + run the web tests**

Run: `cd website && npx tsc --noEmit && npm test && cd ..`
Expected: type-check exit 0; Vitest passes.

- [ ] **Step 6: Commit**

```bash
git add website/src/
git commit -m "feat(cars): show Pending/Unavailable serial status badge in Devices"
```

---

### Task 8: Full verification

- [ ] **Step 1: Python tests**

Run: `./.venv/bin/python -m pytest lib/lambdas/register_car_serial lib/lambdas/car_status_update_function -v`
Expected: all pass.

- [ ] **Step 2: CDK build + tests**

Run: `npm run build && npm test`
Expected: build exit 0; Jest `7 passed`.

- [ ] **Step 3: Website build**

Run: `cd website && npm run build && cd ..`
Expected: exit 0.

- [ ] **Step 4: Final review commit (if any fixups)**

```bash
git add -A && git commit -m "chore(cars): foundation rework cleanup" || echo "nothing to commit"
```

---

## Notes for the implementer

- **Run order for a real-car test after deploy:** the poller picks up the untagged online car on its next cycle and invokes capture; the `ChassisSerial` tag + history row land within a poll cycle and surface in DREM (the column flips from `Pending` to the serial).
- **DynamoDB key:** CarsHistory is `pk=chassisSerial, sk=managedInstanceId` — the upsert keys on exactly those two.
- **Schema codegen:** `ChassisSerialStatus` is admin-only (cars), so only `website/src/graphql` needs the field — **not** leaderboard/overlays. After `make local.config`, delete any stale codegen `.js` that shadows the `.ts` queries.
- **Don't** reintroduce a `product_serial`/`board_serial` fallback — different DMI field, different value (see spec).
