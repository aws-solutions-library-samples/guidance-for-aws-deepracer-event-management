#!/usr/bin/python3
# encoding=utf-8
"""
PDF Lambda — AppSync resolver for generateRaceResultsPdf.
"""
import datetime as dt
import io
import os
import uuid
import zipfile

import boto3
import dynamo_helpers
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import AppSyncResolver
from aws_lambda_powertools.logging import correlation_paths
from boto3.dynamodb.conditions import Attr, Key

from race_summary import calculate_racer_summary, rank_racers
from render import render_pdf

tracer = Tracer()
logger = Logger()
app = AppSyncResolver()

PDF_BUCKET = os.environ["PDF_BUCKET"]
RACE_TABLE = os.environ["RACE_TABLE"]
EVENTS_TABLE = os.environ["EVENTS_TABLE"]
USER_POOL_ID = os.environ["USER_POOL_ID"]
URL_EXPIRY_SECONDS = int(os.environ.get("URL_EXPIRY_SECONDS", "3600"))

_dynamodb = boto3.resource("dynamodb")
_s3 = boto3.client("s3")
_cognito = boto3.client("cognito-idp")
_race_table = _dynamodb.Table(RACE_TABLE)
_events_table = _dynamodb.Table(EVENTS_TABLE)

ADMIN_GROUPS = {"admin", "operator", "commentator"}


@logger.inject_lambda_context(correlation_id_path=correlation_paths.APPSYNC_RESOLVER)
@tracer.capture_lambda_handler
def lambda_handler(event, context):
    # Diagnostic — log the dynamic-linker environment so we can see why
    # dlopen can't find libpango even though the file is in /opt/lib.
    try:
        opt_lib_contents = sorted(os.listdir("/opt/lib"))
        pango_matches = [f for f in opt_lib_contents if "pango" in f]
    except Exception as e:
        opt_lib_contents = [f"error: {e}"]
        pango_matches = []
    logger.info({
        "diag_LD_LIBRARY_PATH": os.environ.get("LD_LIBRARY_PATH"),
        "diag_pango_in_opt_lib": pango_matches,
        "diag_opt_lib_count": len(opt_lib_contents),
    })
    logger.info(event)
    return app.resolve(event, context)


@app.resolver(type_name="Mutation", field_name="generateRaceResultsPdf")
def generate_race_results_pdf(eventId: str, type: str, userId: str = None, trackId: str = None):  # noqa
    requester = _requester_identity()
    event = _get_event(eventId)
    if not event:
        raise ValueError(f"Unknown eventId: {eventId}")

    races = _get_races(eventId, trackId)
    if not races:
        raise ValueError("Cannot generate PDF for an event with no races")

    user_ids = sorted({r["userId"] for r in races})
    user_map = {uid: _lookup_user(uid) for uid in user_ids}

    summaries = _build_summaries(races, user_map)
    ranked = rank_racers(summaries, method=(event.get("raceConfig") or {}).get("rankingMethod") or "BEST_LAP_TIME")

    brand = _default_brand()
    generated_at = dt.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    if type == "ORGANISER_SUMMARY":
        pdf_bytes = _render_organiser(event, ranked, brand, generated_at)
        key, filename = _s3_key(eventId, "organiser-summary"), "organiser-summary.pdf"
    elif type == "PODIUM":
        pdf_bytes = _render_podium(event, ranked, brand, generated_at)
        key, filename = _s3_key(eventId, "podium"), "podium.pdf"
    elif type == "RACER_CERTIFICATE":
        if not userId:
            raise ValueError("userId is required for RACER_CERTIFICATE")
        _enforce_racer_self_service(requester, userId)
        racer = next((r for r in ranked if r["userId"] == userId), None)
        if not racer:
            raise ValueError(f"Racer {userId} has no results for event {eventId}")
        pdf_bytes = _render_certificate(event, racer, brand, generated_at)
        key, filename = _s3_key(eventId, f"certificate-{racer['username']}"), f"certificate-{racer['username']}.pdf"
    elif type == "RACER_CERTIFICATES_BULK":
        pdf_bytes = _render_bulk_zip(event, ranked, brand, generated_at)
        key, filename = _s3_key(eventId, "certificates"), "certificates.zip"
    else:
        raise ValueError(f"Unknown PdfType: {type}")

    _s3.put_object(Bucket=PDF_BUCKET, Key=key, Body=pdf_bytes,
                   ContentType="application/zip" if filename.endswith(".zip") else "application/pdf")
    download_url = _s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": PDF_BUCKET, "Key": key, "ResponseContentDisposition": f'attachment; filename="{filename}"'},
        ExpiresIn=URL_EXPIRY_SECONDS,
    )
    return {
        "downloadUrl": download_url,
        "filename": filename,
        "expiresAt": (dt.datetime.utcnow() + dt.timedelta(seconds=URL_EXPIRY_SECONDS)).isoformat() + "Z",
    }


def _requester_identity() -> dict:
    """Extract { sub, groups } from the AppSync request context."""
    ctx = app.current_event
    claims = (ctx.identity or {}).get("claims") or {}
    groups_raw = claims.get("cognito:groups") or ""
    groups = set(groups_raw.split(",")) if isinstance(groups_raw, str) else set(groups_raw)
    return {"sub": claims.get("sub", ""), "groups": groups}


def _enforce_racer_self_service(requester: dict, target_user_id: str):
    if requester["groups"] & ADMIN_GROUPS:
        return
    if requester["sub"] != target_user_id:
        raise PermissionError("You can only download your own certificate")


def _get_event(event_id: str) -> dict | None:
    resp = _events_table.get_item(Key={"eventId": event_id})
    return dynamo_helpers.replace_decimal_with_float(resp.get("Item")) if resp.get("Item") else None


def _get_races(event_id: str, track_id: str | None) -> list[dict]:
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
    return dynamo_helpers.replace_decimal_with_float(items)


def _lookup_user(user_id: str) -> dict:
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


def _build_summaries(races: list[dict], user_map: dict[str, dict]) -> list[dict]:
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


def _default_brand() -> dict:
    static_dir = os.path.join(os.path.dirname(__file__), "templates", "static")
    return {
        "logo_url": f"file://{os.path.join(static_dir, 'deepracer-logo.png')}",
        "primary": "#232F3E",
        "accent": "#FF9900",
    }


def _render_organiser(event: dict, ranked: list[dict], brand: dict, generated_at: str) -> bytes:
    by_track: dict[str, list[dict]] = {}
    for r in ranked:
        by_track.setdefault("all", []).append(r)
    totals = {
        "racers": len(ranked),
        "races": sum(1 for r in ranked),
        "validLaps": sum(r.get("numberOfValidLaps", 0) for r in ranked),
        "fastestLapFormatted": _format_lap(
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


def _render_podium(event: dict, ranked: list[dict], brand: dict, generated_at: str) -> bytes:
    return render_pdf("podium.html", {
        "event": event,
        "podium": ranked[:3],
        "runners_up": ranked[3:10],
        "brand": brand,
        "generated_at": generated_at,
        "page_title": f"{event['eventName']} — Podium",
    })


def _render_certificate(event: dict, racer: dict, brand: dict, generated_at: str) -> bytes:
    return render_pdf("racer_certificate.html", {
        "event": event,
        "racer": racer,
        "brand": brand,
        "generated_at": generated_at,
        "page_title": f"Certificate — {racer['username']}",
        "page_orientation": "landscape",
    })


def _render_bulk_zip(event: dict, ranked: list[dict], brand: dict, generated_at: str) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for racer in ranked:
            pdf = _render_certificate(event, racer, brand, generated_at)
            zf.writestr(f"{racer['username']}.pdf", pdf)
    return buf.getvalue()


def _format_lap(time_ms):
    if time_ms is None:
        return "—"
    return f"{time_ms / 1000:.3f}s"


def _s3_key(event_id: str, name: str) -> str:
    ts = dt.datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    uid = uuid.uuid4().hex[:8]
    return f"{event_id}/{name}-{ts}-{uid}{'.zip' if name == 'certificates' else '.pdf'}"
