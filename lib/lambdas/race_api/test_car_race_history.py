from decimal import Decimal

import car_race_history as crh


def test_parse_iso_handles_z_offset_space_and_naive():
    assert crh._parse_iso("2026-05-25T10:00:00Z") is not None
    assert crh._parse_iso("2026-05-25T10:00:00+00:00") is not None
    assert crh._parse_iso("2026-05-25 10:00:00") is not None  # space separator
    assert crh._parse_iso("2026-05-25") is not None            # date only
    assert crh._parse_iso("") is None
    assert crh._parse_iso(None) is None
    assert crh._parse_iso("not-a-date") is None
    # naive input is treated as UTC and is comparable to aware input
    naive = crh._parse_iso("2026-05-25T10:00:00")
    aware = crh._parse_iso("2026-05-25T09:00:00Z")
    assert naive > aware


def test_collect_paginated_walks_all_pages():
    pages = [
        {"Items": [1, 2], "LastEvaluatedKey": {"k": "a"}},
        {"Items": [3], "LastEvaluatedKey": {"k": "b"}},
        {"Items": [4]},
    ]
    calls = []

    def page_fn(start_key):
        calls.append(start_key)
        return pages[len(calls) - 1]

    assert crh.collect_paginated(page_fn) == [1, 2, 3, 4]
    assert calls == [None, {"k": "a"}, {"k": "b"}]


def test_build_windows_skips_rows_without_registration_or_name():
    rows = [
        {"managedInstanceId": "mi-1", "carName": "LGW01",
         "registrationDate": "2026-01-01T00:00:00Z", "deregisteredAt": "2026-02-01T00:00:00Z"},
        {"managedInstanceId": "mi-2", "carName": "LGW02"},          # no registrationDate -> skip
        {"managedInstanceId": "mi-3", "registrationDate": "2026-03-01T00:00:00Z"},  # no carName -> skip
        {"managedInstanceId": "mi-4", "carName": "LGW04",
         "registrationDate": "2026-04-01T00:00:00Z", "deregisteredAt": None},  # open-ended -> kept
    ]
    windows = crh.build_activation_windows(rows)
    assert [w["managedInstanceId"] for w in windows] == ["mi-1", "mi-4"]
    assert windows[0]["to"] is not None   # mi-1 has a closed window
    assert windows[1]["to"] is None       # mi-4 is open-ended


def test_match_activation_is_time_bounded():
    rows = [
        {"managedInstanceId": "mi-1", "carName": "LGW01",
         "registrationDate": "2026-01-01T00:00:00Z", "deregisteredAt": "2026-02-01T00:00:00Z"},
        {"managedInstanceId": "mi-2", "carName": "LGW02",
         "registrationDate": "2026-02-01T00:00:00Z", "deregisteredAt": None},
    ]
    windows = crh.build_activation_windows(rows)
    # in LGW01's window
    assert crh.match_activation("LGW01", "2026-01-15T00:00:00Z", windows)["managedInstanceId"] == "mi-1"
    # LGW02 open-ended window, far future still matches
    assert crh.match_activation("LGW02", "2099-01-01T00:00:00Z", windows)["managedInstanceId"] == "mi-2"
    # right name, wrong time (before LGW01 ever existed) -> no match
    assert crh.match_activation("LGW01", "2025-01-01T00:00:00Z", windows) is None
    # name not in lineage -> no match
    assert crh.match_activation("OTHER", "2026-01-15T00:00:00Z", windows) is None


def test_assemble_joins_two_hostnames_for_one_chassis():
    history = [
        {"managedInstanceId": "mi-1", "carName": "LGW01",
         "registrationDate": "2026-01-01T00:00:00Z", "deregisteredAt": "2026-02-01T00:00:00Z"},
        {"managedInstanceId": "mi-2", "carName": "LGW02",
         "registrationDate": "2026-02-01T00:00:00Z", "deregisteredAt": None},
    ]
    races = [
        {"raceId": "r1", "eventId": "e1", "trackId": "1", "type": "race",
         "createdAt": "2026-01-10T00:00:00Z",
         "laps": [{"lapId": "l1", "carName": "LGW01", "time": Decimal("12.5"), "isValid": True},
                  {"lapId": "l2", "carName": "LGW01", "time": Decimal("99.9"), "isValid": False}]},
        {"raceId": "r2", "eventId": "e2", "trackId": "2", "type": "race",
         "createdAt": "2026-03-10T00:00:00Z",
         "laps": [{"lapId": "l3", "carName": "LGW02", "time": Decimal("11.0"), "isValid": True}]},
        # reused name on a DIFFERENT chassis, before LGW01's window -> excluded
        {"raceId": "r3", "eventId": "e3", "trackId": "1", "type": "race",
         "createdAt": "2025-06-01T00:00:00Z",
         "laps": [{"lapId": "l4", "carName": "LGW01", "time": Decimal("5.0"), "isValid": True}]},
    ]
    out = crh.assemble_car_race_history("AMSS-9QCJ", history, races)
    assert out["chassisSerial"] == "AMSS-9QCJ"
    assert out["summary"]["totalRaces"] == 2          # r1 + r2, NOT r3
    assert out["summary"]["totalLaps"] == 3
    assert out["summary"]["totalValidLaps"] == 2
    assert out["summary"]["bestLapTime"] == Decimal("11.0")
    names = {a["carName"]: a for a in out["activations"]}
    assert names["LGW01"]["raceCount"] == 1 and names["LGW01"]["lapCount"] == 2
    assert names["LGW02"]["raceCount"] == 1 and names["LGW02"]["lapCount"] == 1
    # activations sorted most-recent-first by window start
    assert out["activations"][0]["carName"] == "LGW02"


def test_assemble_empty_lineage_returns_empty():
    out = crh.assemble_car_race_history("X", [], [{"raceId": "r1", "createdAt": "2026-01-01T00:00:00Z",
                                                   "laps": [{"carName": "LGW01", "time": Decimal("1")}]}])
    assert out["activations"] == []
    assert out["summary"] == {"totalRaces": 0, "totalLaps": 0, "totalValidLaps": 0, "bestLapTime": None}


def test_assemble_ignores_laps_without_car_name():
    history = [{"managedInstanceId": "mi-1", "carName": "LGW01",
                "registrationDate": "2026-01-01T00:00:00Z", "deregisteredAt": None}]
    races = [{"raceId": "r1", "createdAt": "2026-01-10T00:00:00Z",
              "laps": [{"lapId": "l1", "time": Decimal("5.0"), "isValid": True}]}]  # no carName
    out = crh.assemble_car_race_history("X", history, races)
    assert out["summary"]["totalLaps"] == 0
    assert out["activations"][0]["lapCount"] == 0
