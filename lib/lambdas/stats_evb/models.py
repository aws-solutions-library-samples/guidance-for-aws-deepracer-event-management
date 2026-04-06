"""Data models for stats computation. Pure dataclasses, no I/O."""
import statistics
from dataclasses import dataclass, field
from typing import Optional

MIN_VALID_LAP_MS = 5000  # sub-5s laps are data artefacts


@dataclass
class RacerStats:
    """Stats for one racer within a single track context."""
    user_id: str
    username: Optional[str] = None
    country_code: Optional[str] = None
    race_count: int = 0
    valid_lap_times: list = field(default_factory=list)
    invalid_lap_count: int = 0
    total_resets: int = 0
    best_avg_lap_ms: Optional[float] = None

    @property
    def valid_lap_count(self) -> int:
        return len(self.valid_lap_times)

    @property
    def total_lap_count(self) -> int:
        return self.valid_lap_count + self.invalid_lap_count

    @property
    def avg_lap_time_ms(self) -> Optional[float]:
        return sum(self.valid_lap_times) / len(self.valid_lap_times) if self.valid_lap_times else None

    @property
    def best_lap_time_ms(self) -> Optional[float]:
        return min(self.valid_lap_times) if self.valid_lap_times else None

    @property
    def lap_completion_ratio(self) -> Optional[float]:
        return self.valid_lap_count / self.total_lap_count if self.total_lap_count else None


@dataclass
class TrackStats:
    """Stats for all racers on a single track within an event."""
    track_id: str
    racers: dict = field(default_factory=dict)  # user_id -> RacerStats

    @property
    def total_valid_laps(self) -> int:
        return sum(r.valid_lap_count for r in self.racers.values())

    @property
    def total_invalid_laps(self) -> int:
        return sum(r.invalid_lap_count for r in self.racers.values())

    @property
    def overall_best_lap_ms(self) -> Optional[float]:
        times = [r.best_lap_time_ms for r in self.racers.values() if r.best_lap_time_ms]
        return min(times) if times else None


@dataclass
class EventStats:
    """Aggregated stats for a full event across all its tracks."""
    event_id: str
    event_name: str
    event_date: str
    event_type: str
    country_code: str
    race_config: dict
    tracks: dict = field(default_factory=dict)  # track_id -> TrackStats
    total_races: int = 0

    @property
    def merged_racers(self) -> dict:
        """Single merged view of all racers across all tracks."""
        merged: dict[str, RacerStats] = {}
        for track in self.tracks.values():
            for uid, rs in track.racers.items():
                if uid not in merged:
                    merged[uid] = RacerStats(
                        user_id=uid, username=rs.username,
                        country_code=rs.country_code,
                    )
                m = merged[uid]
                m.race_count += rs.race_count
                m.valid_lap_times.extend(rs.valid_lap_times)
                m.invalid_lap_count += rs.invalid_lap_count
                m.total_resets += rs.total_resets
                if rs.best_avg_lap_ms is not None:
                    if m.best_avg_lap_ms is None or rs.best_avg_lap_ms < m.best_avg_lap_ms:
                        m.best_avg_lap_ms = rs.best_avg_lap_ms
        return merged

    @property
    def total_racers(self) -> int:
        return len(self.merged_racers)

    @property
    def total_valid_laps(self) -> int:
        return sum(t.total_valid_laps for t in self.tracks.values())

    @property
    def total_invalid_laps(self) -> int:
        return sum(t.total_invalid_laps for t in self.tracks.values())

    @property
    def overall_best_lap_ms(self) -> Optional[float]:
        times = [t.overall_best_lap_ms for t in self.tracks.values() if t.overall_best_lap_ms]
        return min(times) if times else None


@dataclass
class RacerEventSummary:
    """A racer's performance at a single event."""
    event_id: str
    event_name: str
    event_date: str
    track_type: str
    country_code: str
    race_count: int
    valid_lap_count: int
    best_lap_ms: Optional[float]
    avg_lap_ms: Optional[float]
    best_avg_lap_ms: Optional[float]
    lap_completion_ratio: Optional[float]
    total_resets: int
