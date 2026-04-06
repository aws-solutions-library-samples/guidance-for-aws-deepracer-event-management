"""
Pure computation — takes raw DynamoDB race items, returns model objects.
No I/O, no network calls. Ported from drem-api-stats/compute.py.
"""
from typing import Optional
from models import (
    RacerStats, TrackStats, EventStats, RacerEventSummary,
    MIN_VALID_LAP_MS,
)


def compute_event_stats(
    event: dict,
    races: list[dict],
    user_map: dict[str, dict] | None = None,
) -> Optional[EventStats]:
    """
    Compute stats for a single event from its raw race data (DynamoDB items).

    Args:
        event: Event record with eventId, eventName, eventDate, typeOfEvent,
               countryCode, raceConfig.
        races: List of race DynamoDB items. Each has userId, trackId, laps,
               averageLaps.
        user_map: Optional {userId: {"username": str, "countryCode": str}}.

    Returns:
        EventStats or None if no races.
    """
    if not races:
        return None

    rc = event.get("raceConfig") or {}
    stats = EventStats(
        event_id=event["eventId"],
        event_name=event.get("eventName") or "",
        event_date=event.get("eventDate") or "",
        event_type=event.get("typeOfEvent") or "",
        country_code=event.get("countryCode") or "",
        race_config=rc,
        total_races=len(races),
    )

    for race in races:
        track_id = race.get("trackId") or "unknown"
        if track_id not in stats.tracks:
            stats.tracks[track_id] = TrackStats(track_id=track_id)
        track = stats.tracks[track_id]

        uid = race["userId"]
        if uid not in track.racers:
            user_info = (user_map or {}).get(uid, {})
            track.racers[uid] = RacerStats(
                user_id=uid,
                username=user_info.get("username"),
                country_code=user_info.get("countryCode"),
            )
        racer = track.racers[uid]
        racer.race_count += 1

        for lap in (race.get("laps") or []):
            t = lap.get("time")
            if lap.get("isValid") and t is not None and t >= MIN_VALID_LAP_MS:
                racer.valid_lap_times.append(float(t))
            else:
                racer.invalid_lap_count += 1
            racer.total_resets += lap.get("resets") or 0

        for window in (race.get("averageLaps") or []):
            avg = window.get("avgTime")
            if avg and avg >= MIN_VALID_LAP_MS:
                if racer.best_avg_lap_ms is None or avg < racer.best_avg_lap_ms:
                    racer.best_avg_lap_ms = float(avg)

    # Sanity check: rolling avg can't be lower than the best individual lap.
    for track in stats.tracks.values():
        for racer in track.racers.values():
            if (racer.best_avg_lap_ms is not None
                    and racer.best_lap_time_ms is not None
                    and racer.best_avg_lap_ms < racer.best_lap_time_ms):
                racer.best_avg_lap_ms = None

    return stats


def build_racer_event_summary(
    event_stats: EventStats,
) -> list[RacerEventSummary]:
    """
    Extract per-racer summaries from an EventStats.
    Returns a list of RacerEventSummary for each racer in the event.
    """
    rc = event_stats.race_config
    track_type = rc.get("trackType") or ""
    summaries = []
    for uid, racer in event_stats.merged_racers.items():
        summaries.append(RacerEventSummary(
            event_id=event_stats.event_id,
            event_name=event_stats.event_name,
            event_date=event_stats.event_date,
            track_type=track_type,
            country_code=event_stats.country_code,
            race_count=racer.race_count,
            valid_lap_count=racer.valid_lap_count,
            best_lap_ms=racer.best_lap_time_ms,
            avg_lap_ms=racer.avg_lap_time_ms,
            best_avg_lap_ms=racer.best_avg_lap_ms,
            lap_completion_ratio=racer.lap_completion_ratio,
            total_resets=racer.total_resets,
        ))
    return summaries
