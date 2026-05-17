"""
Pure ranking + summary computation for the PDF Lambda.

Ported from lib/lambdas/race_api/index.py's __calculate_race_summary. Kept
self-contained (no boto3, no env vars) so the templates can be rendered
from fixture data in unit tests without touching AWS.
"""
from statistics import mean


def calculate_racer_summary(user_id: str, races: list[dict]) -> dict:
    """Reduce a racer's races for an event into a summary dict."""
    valid_laps: list[dict] = []
    invalid_laps: list[dict] = []
    for race in races:
        for lap in race.get("laps") or []:
            if lap.get("isValid"):
                valid_laps.append(lap)
            else:
                invalid_laps.append(lap)

    total_laps = len(valid_laps) + len(invalid_laps)
    valid_times = [lap["time"] for lap in valid_laps]

    # Fastest rolling-average lap across all races (DREM pre-computes these)
    all_avg_laps = [a for r in races for a in (r.get("averageLaps") or [])]
    fastest_avg = None
    if all_avg_laps:
        fastest_avg = min(all_avg_laps, key=lambda a: a["avgTime"])

    # Most consecutive valid laps in any race
    streaks: list[int] = []
    for race in races:
        streak = 0
        for lap in race.get("laps") or []:
            if lap.get("isValid"):
                streak += 1
            else:
                streaks.append(streak)
                streak = 0
        streaks.append(streak)
    most_consecutive = max(streaks) if streaks else 0

    return {
        "userId": user_id,
        "numberOfValidLaps": len(valid_laps),
        "numberOfInvalidLaps": len(invalid_laps),
        "fastestLapTime": min(valid_times) if valid_times else None,
        "fastestAverageLap": fastest_avg,
        "avgLapTime": mean(valid_times) if valid_times else None,
        "lapCompletionRatio": (
            round(len(valid_laps) / total_laps, 2) * 100 if total_laps else 0.0
        ),
        "avgLapsPerAttempt": round(total_laps / len(races), 1) if races else 0.0,
        "mostConsecutiveLaps": most_consecutive,
    }


def rank_racers(summaries: list[dict], method: str) -> list[dict]:
    """
    Sort racer summaries by the event's ranking method and attach a `rank`.
    Racers with no valid laps sort last.
    """
    def _sort_key(s: dict):
        if method == "BEST_AVERAGE_LAP_TIME_X_LAP":
            avg = s.get("fastestAverageLap")
            return (avg is None, avg["avgTime"] if avg else 0)
        # default: BEST_LAP_TIME
        fastest = s.get("fastestLapTime")
        return (fastest is None, fastest or 0)

    ranked = sorted(summaries, key=_sort_key)
    for i, s in enumerate(ranked):
        s["rank"] = i + 1
    return ranked
