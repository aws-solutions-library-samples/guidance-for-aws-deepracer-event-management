"""Shared helpers used by orchestrator, worker, and getPdfJob Lambdas."""
import datetime as dt
import decimal
import io
import os
import uuid
import zipfile

import boto3
from aws_lambda_powertools import Logger
from boto3.dynamodb.conditions import Attr, Key

from race_summary import calculate_racer_summary, rank_racers
from render import render_pdf

logger = Logger()

PDF_BUCKET = os.environ["PDF_BUCKET"]
RACE_TABLE = os.environ["RACE_TABLE"]
EVENTS_TABLE = os.environ["EVENTS_TABLE"]
USER_POOL_ID = os.environ["USER_POOL_ID"]

_dynamodb = boto3.resource("dynamodb")
_s3 = boto3.client("s3")
_cognito = boto3.client("cognito-idp")
_race_table = _dynamodb.Table(RACE_TABLE)
_events_table = _dynamodb.Table(EVENTS_TABLE)

ADMIN_GROUPS = {"admin", "operator", "commentator"}


def replace_decimal_with_float(obj):
    if isinstance(obj, decimal.Decimal):
        if obj == int(obj):
            return int(obj)
        return float(obj)
    if isinstance(obj, dict):
        return {k: replace_decimal_with_float(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [replace_decimal_with_float(i) for i in obj]
    return obj


def requester_identity(event_identity) -> dict:
    """Extract { sub, groups } from AppSync context.identity.

    The empty-string filter in the comprehension is intentional: cognito claims
    with no groups arrive as `""`, which would otherwise split into `[""]` and
    produce a spurious `{""}` group. Filtering yields a clean `set()`.
    """
    claims = (event_identity or {}).get("claims") or {}
    groups_raw = claims.get("cognito:groups") or ""
    groups = set(g for g in groups_raw.split(",") if g) if isinstance(groups_raw, str) else set(groups_raw)
    return {"sub": claims.get("sub", ""), "groups": groups}


def enforce_racer_self_service(requester: dict, target_user_id: str):
    if requester["groups"] & ADMIN_GROUPS:
        return
    if requester["sub"] != target_user_id:
        raise PermissionError("You can only download your own certificate")


def get_event(event_id: str) -> dict | None:
    resp = _events_table.get_item(Key={"eventId": event_id})
    return replace_decimal_with_float(resp.get("Item")) if resp.get("Item") else None


def get_races(event_id: str, track_id: str | None) -> list[dict]:
    items: list[dict] = []
    kwargs = {
        "KeyConditionExpression": Key("eventId").eq(event_id),
        "FilterExpression": Attr("type").eq("race"),
    }
    if track_id:
        kwargs["KeyConditionExpression"] = Key("eventId").eq(event_id) & Key("sk").begins_with(f"TRACK#{track_id}#")
    resp = _race_table.query(**kwargs)
    items.extend(resp["Items"])
    while "LastEvaluatedKey" in resp:
        kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]
        resp = _race_table.query(**kwargs)
        items.extend(resp["Items"])
    return replace_decimal_with_float(items)


def lookup_user(user_id: str) -> dict:
    try:
        resp = _cognito.list_users(UserPoolId=USER_POOL_ID, Filter=f'sub = "{user_id}"')
        if not resp["Users"]:
            return {"username": user_id[:8], "countryCode": ""}
        u = resp["Users"][0]
        attrs = {a["Name"]: a["Value"] for a in u["Attributes"]}
        return {"username": u["Username"], "countryCode": attrs.get("custom:countryCode", "")}
    except Exception as e:
        logger.warning(f"Cognito lookup failed for {user_id}: {e}")
        return {"username": user_id[:8], "countryCode": ""}


def build_summaries(races: list[dict], user_map: dict[str, dict]) -> list[dict]:
    races_by_user: dict[str, list[dict]] = {}
    for r in races:
        races_by_user.setdefault(r["userId"], []).append(r)
    summaries = []
    for uid, user_races in races_by_user.items():
        s = calculate_racer_summary(uid, user_races)
        u = user_map.get(uid, {})
        s["username"] = u.get("username", uid[:8])
        s["countryCode"] = u.get("countryCode", "")
        summaries.append(s)
    return summaries


def default_brand() -> dict:
    static_dir = os.path.join(os.path.dirname(__file__), "templates", "static")
    return {
        "logo_url": f"file://{os.path.join(static_dir, 'deepracer-logo.png')}",
        "primary": "#232F3E",
        "accent": "#FF9900",
    }


def format_lap(time_ms):
    if time_ms is None:
        return "—"
    return f"{time_ms / 1000:.3f}s"


def s3_key(event_id: str, name: str) -> str:
    ts = dt.datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    uid = uuid.uuid4().hex[:8]
    return f"{event_id}/{name}-{ts}-{uid}{'.zip' if name == 'certificates' else '.pdf'}"


def render_organiser(event: dict, ranked: list[dict], brand: dict, generated_at: str) -> bytes:
    by_track: dict[str, list[dict]] = {}
    for r in ranked:
        by_track.setdefault("all", []).append(r)
    totals = {
        "racers": len(ranked),
        "races": sum(1 for r in ranked),
        "validLaps": sum(r.get("numberOfValidLaps", 0) for r in ranked),
        "fastestLapFormatted": format_lap(
            min((r["fastestLapTime"] for r in ranked if r.get("fastestLapTime") is not None), default=None)
        ),
    }
    return render_pdf("organiser_summary.html", {
        "event": event,
        "tracks": [{"trackId": k, "racers": v} for k, v in by_track.items()],
        "totals": totals,
        "brand": brand,
        "generated_at": generated_at,
        "page_title": f"{event['eventName']} — Summary",
    })


def render_podium(event: dict, ranked: list[dict], brand: dict, generated_at: str) -> bytes:
    return render_pdf("podium.html", {
        "event": event,
        "podium": ranked[:3],
        "runners_up": ranked[3:10],
        "brand": brand,
        "generated_at": generated_at,
        "page_title": f"{event['eventName']} — Podium",
    })


def render_certificate(event: dict, racer: dict, brand: dict, generated_at: str) -> bytes:
    return render_pdf("racer_certificate.html", {
        "event": event,
        "racer": racer,
        "brand": brand,
        "generated_at": generated_at,
        "page_title": f"Certificate — {racer['username']}",
        "page_orientation": "landscape",
    })


def render_bulk_zip(event: dict, ranked: list[dict], brand: dict, generated_at: str) -> bytes:
    """Render one certificate per unique racer who has at least one valid lap."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for racer in ranked:
            if racer.get("fastestLapTime") is None:
                continue
            pdf = render_certificate(event, racer, brand, generated_at)
            zf.writestr(f"{racer['username']}.pdf", pdf)
    return buf.getvalue()


def build_ranked(event: dict, races: list[dict]) -> list[dict]:
    user_ids = sorted({r["userId"] for r in races})
    user_map = {uid: lookup_user(uid) for uid in user_ids}
    summaries = build_summaries(races, user_map)
    method = (event.get("raceConfig") or {}).get("rankingMethod") or "BEST_LAP_TIME"
    return rank_racers(summaries, method=method)


def put_pdf_object(key: str, body: bytes, filename: str):
    _s3.put_object(
        Bucket=PDF_BUCKET,
        Key=key,
        Body=body,
        ContentType="application/zip" if filename.endswith(".zip") else "application/pdf",
    )
