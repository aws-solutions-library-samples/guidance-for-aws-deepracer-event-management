"""
Template rendering tests — Jinja2 only, no WeasyPrint dependency.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from render import render_html


def _fixture_event():
    return {
        "eventId": "evt-1",
        "eventName": "Test Regional 2026",
        "eventDate": "2026-03-15",
        "countryCode": "GB",
        "typeOfEvent": "OFFICIAL_TRACK_RACE",
        "sponsor": "AWS",
        "raceConfig": {"rankingMethod": "BEST_LAP_TIME"},
    }


def _fixture_tracks():
    return [
        {
            "trackId": "track-1",
            "racers": [
                {
                    "rank": 1, "userId": "u1", "username": "alice", "countryCode": "GB",
                    "fastestLapTime": 6500.0, "avgLapTime": 7200.0,
                    "numberOfValidLaps": 10, "numberOfInvalidLaps": 2,
                    "mostConsecutiveLaps": 5,
                },
                {
                    "rank": 2, "userId": "u2", "username": "bob", "countryCode": "US",
                    "fastestLapTime": 7100.0, "avgLapTime": 7800.0,
                    "numberOfValidLaps": 8, "numberOfInvalidLaps": 1,
                    "mostConsecutiveLaps": 4,
                },
            ],
        }
    ]


def _brand_defaults():
    return {
        "logo_url": "file:///tmp/logo.png",
        "primary": "#232F3E",
        "accent": "#FF9900",
    }


class TestOrganiserSummary:
    def test_event_fields_rendered(self):
        html = render_html("organiser_summary.html", {
            "event": _fixture_event(),
            "tracks": _fixture_tracks(),
            "totals": {"racers": 2, "races": 3, "validLaps": 18, "fastestLapFormatted": "6.500s"},
            "brand": _brand_defaults(),
            "page_title": "Summary",
            "generated_at": "2026-04-19",
        })
        assert "Test Regional 2026" in html
        assert "OFFICIAL TRACK RACE" in html
        assert "alice" in html
        assert "bob" in html
        assert "6.500s" in html


class TestRacerCertificate:
    def test_racer_name_rendered(self):
        html = render_html("racer_certificate.html", {
            "event": _fixture_event(),
            "racer": {
                "rank": 1, "username": "alice", "fastestLapTime": 6500.0,
                "mostConsecutiveLaps": 5,
            },
            "brand": _brand_defaults(),
            "page_title": "Certificate",
            "generated_at": "2026-04-19",
        })
        assert "Certificate of Achievement" in html
        assert "alice" in html
        assert "Test Regional 2026" in html


class TestPodium:
    def test_top_three_rendered(self):
        html = render_html("podium.html", {
            "event": _fixture_event(),
            "podium": _fixture_tracks()[0]["racers"][:2]
                + [{"rank": 3, "username": "carol", "countryCode": "FR",
                    "fastestLapTime": 7300.0, "avgLapTime": 7900.0,
                    "numberOfValidLaps": 6, "numberOfInvalidLaps": 0,
                    "mostConsecutiveLaps": 3}],
            "runners_up": [],
            "brand": _brand_defaults(),
            "page_title": "Podium",
            "generated_at": "2026-04-19",
        })
        assert "alice" in html
        assert "bob" in html
        assert "carol" in html
        assert "Podium" in html
