# Race Results PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate server-side PDFs for organiser event summaries, per-racer certificates, and podiums, triggered via AppSync and delivered as S3 pre-signed URLs.

**Architecture:** New `RaceResultsPdf` CDK construct exposes one AppSync mutation `generateRaceResultsPdf`. A Python 3.12 Lambda loads event + race data from the existing DynamoDB tables, reuses the ranking/summary logic (ported from `race_api`), renders a Jinja2 HTML template, and converts it to PDF via WeasyPrint. Output is written to a dedicated S3 bucket (1-day lifecycle), a 1-hour pre-signed URL is returned. A custom Lambda layer ships the WeasyPrint native dependencies (cairo, pango, etc.).

**Tech Stack:** Python 3.12 ARM64 Lambda, WeasyPrint 62.x, Jinja2, AWS CDK, AppSync, S3, React + CloudScape frontend.

**Design spec:** `docs/superpowers/specs/2026-04-19-race-results-pdf-design.md`

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `lib/lambda_layers/weasyprint/Dockerfile` | Custom bundling image — installs cairo/pango/gdk-pixbuf plus Python WeasyPrint |
| `lib/lambda_layers/weasyprint/README.md` | How the layer is built and why it needs a custom Dockerfile |
| `lib/lambdas/pdf_api/__init__.py` | Package marker |
| `lib/lambdas/pdf_api/index.py` | Lambda handler — AppSyncResolver with PDF type dispatch |
| `lib/lambdas/pdf_api/race_summary.py` | Port of `race_api.__calculate_race_summary` — ranking, fastest lap, etc. |
| `lib/lambdas/pdf_api/render.py` | `render_pdf(template_name, context) -> bytes` wrapper around Jinja2 + WeasyPrint |
| `lib/lambdas/pdf_api/templates/base.html` | Shared layout — `@page`, footer, CSS variables for branding |
| `lib/lambdas/pdf_api/templates/_components.html` | Jinja macros — `kpi_box`, `racer_row`, `podium_step` |
| `lib/lambdas/pdf_api/templates/organiser_summary.html` | Organiser summary template |
| `lib/lambdas/pdf_api/templates/racer_certificate.html` | Certificate template |
| `lib/lambdas/pdf_api/templates/podium.html` | Podium template |
| `lib/lambdas/pdf_api/templates/static/deepracer-logo.png` | Copied from `website/public/logo.png` |
| `lib/lambdas/pdf_api/test_race_summary.py` | Unit tests for summary computation |
| `lib/lambdas/pdf_api/test_render.py` | Unit tests for template rendering (no WeasyPrint required) |
| `lib/constructs/race-results-pdf.ts` | CDK construct — bucket, layer, Lambda, AppSync schema + mutation |
| `website/src/hooks/usePdfApi.ts` | Frontend hook wrapping the mutation |

### Existing files to modify

| File | Change |
|------|--------|
| `lib/drem-app-stack.ts` | Import + instantiate `RaceResultsPdf`, pass `raceTable`/`eventsTable` |
| `website/src/graphql/mutations.ts` | Add `generateRaceResultsPdf` mutation |
| `website/src/admin/race-admin/raceAdmin.tsx` | Add "Download PDF" split button (organiser summary / bulk certificates / podium) |
| `website/public/locales/en/translation.json` | Add `pdf.*` i18n keys |

---

## Task 1: Port Race Summary Compute to pdf_api

Port the ranking and summary logic from `race_api` so the PDF Lambda can compute the same values without a round-trip.

**Files:**
- Create: `lib/lambdas/pdf_api/__init__.py`
- Create: `lib/lambdas/pdf_api/race_summary.py`
- Create: `lib/lambdas/pdf_api/test_race_summary.py`

- [ ] **Step 1: Create package marker**

```bash
mkdir -p lib/lambdas/pdf_api/templates/static
touch lib/lambdas/pdf_api/__init__.py
```

- [ ] **Step 2: Write failing tests**

```python
# lib/lambdas/pdf_api/test_race_summary.py
"""Tests for race summary computation used by the PDF Lambda."""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from race_summary import calculate_racer_summary, rank_racers


def _lap(time_ms, is_valid=True, resets=0):
    return {"time": time_ms, "isValid": is_valid, "resets": resets}


def _race(user_id="u1", track_id="t1", laps=None, average_laps=None):
    return {
        "userId": user_id,
        "trackId": track_id,
        "laps": laps or [],
        "averageLaps": average_laps or [],
    }


class TestCalculateRacerSummary:
    def test_fastest_valid_lap(self):
        races = [_race(laps=[_lap(8000), _lap(6500), _lap(7200)])]
        s = calculate_racer_summary("u1", races)
        assert s["fastestLapTime"] == 6500

    def test_invalid_laps_excluded(self):
        races = [_race(laps=[_lap(6500, is_valid=False), _lap(7200)])]
        s = calculate_racer_summary("u1", races)
        assert s["fastestLapTime"] == 7200
        assert s["numberOfValidLaps"] == 1
        assert s["numberOfInvalidLaps"] == 1

    def test_most_consecutive_laps(self):
        races = [_race(laps=[
            _lap(7000), _lap(7100), _lap(6500, is_valid=False),
            _lap(7200), _lap(7300), _lap(7400),
        ])]
        s = calculate_racer_summary("u1", races)
        assert s["mostConsecutiveLaps"] == 3

    def test_no_valid_laps(self):
        races = [_race(laps=[_lap(6500, is_valid=False)])]
        s = calculate_racer_summary("u1", races)
        assert s["fastestLapTime"] is None


class TestRankRacers:
    def test_rank_by_fastest_lap(self):
        summaries = [
            {"userId": "alice", "fastestLapTime": 7500},
            {"userId": "bob", "fastestLapTime": 6500},
            {"userId": "carol", "fastestLapTime": 7000},
        ]
        ranked = rank_racers(summaries, method="BEST_LAP_TIME")
        assert [r["userId"] for r in ranked] == ["bob", "carol", "alice"]
        assert ranked[0]["rank"] == 1
        assert ranked[2]["rank"] == 3

    def test_none_sorted_last(self):
        summaries = [
            {"userId": "alice", "fastestLapTime": 7500},
            {"userId": "bob", "fastestLapTime": None},
            {"userId": "carol", "fastestLapTime": 7000},
        ]
        ranked = rank_racers(summaries, method="BEST_LAP_TIME")
        assert ranked[-1]["userId"] == "bob"
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd lib/lambdas/pdf_api && python3 -m pytest test_race_summary.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'race_summary'`

- [ ] **Step 4: Implement race_summary.py**

```python
# lib/lambdas/pdf_api/race_summary.py
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
            # sort None to the end; otherwise by avgTime ascending
            return (avg is None, avg["avgTime"] if avg else 0)
        # default: BEST_LAP_TIME
        fastest = s.get("fastestLapTime")
        return (fastest is None, fastest or 0)

    ranked = sorted(summaries, key=_sort_key)
    for i, s in enumerate(ranked):
        s["rank"] = i + 1
    return ranked
```

- [ ] **Step 5: Run tests — expect PASS**

Run: `cd lib/lambdas/pdf_api && python3 -m pytest test_race_summary.py -v`
Expected: all 6 tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/lambdas/pdf_api/__init__.py lib/lambdas/pdf_api/race_summary.py lib/lambdas/pdf_api/test_race_summary.py
git commit -m "feat(pdf): port race summary + ranking logic into pdf_api"
```

---

## Task 2: Jinja Templates — Base Layout + Components

Shared `base.html` (page CSS, footer, brand variables) and Jinja macros that the three PDF templates compose.

**Files:**
- Create: `lib/lambdas/pdf_api/templates/base.html`
- Create: `lib/lambdas/pdf_api/templates/_components.html`

- [ ] **Step 1: Create base.html**

```html
{# lib/lambdas/pdf_api/templates/base.html #}
<!DOCTYPE html>
<html lang="{{ lang|default('en') }}">
<head>
<meta charset="utf-8">
<title>{{ page_title }}</title>
<style>
  :root {
    --brand-primary: {{ brand.primary|default('#232F3E') }};
    --brand-accent:  {{ brand.accent|default('#FF9900') }};
    --brand-text:    {{ brand.text|default('#0F141A') }};
    --brand-muted:   {{ brand.muted|default('#5F6B7A') }};
    --brand-line:    {{ brand.line|default('#DEDEE3') }};
  }
  @page {
    size: {{ page_size|default('A4') }} {{ page_orientation|default('portrait') }};
    margin: 15mm 12mm 18mm 12mm;
    @bottom-left {
      content: "{{ footer_left|default('Generated by DREM') }} · {{ generated_at }}";
      font-size: 8pt;
      color: var(--brand-muted);
    }
    @bottom-right {
      content: "Page " counter(page) " of " counter(pages);
      font-size: 8pt;
      color: var(--brand-muted);
    }
  }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: "Helvetica", "Arial", sans-serif;
    color: var(--brand-text);
    font-size: 10pt;
    line-height: 1.4;
  }
  .brand-primary { color: var(--brand-primary); }
  .brand-accent  { color: var(--brand-accent); }
  h1, h2, h3 { color: var(--brand-primary); margin: 0; }
  h1 { font-size: 22pt; }
  h2 { font-size: 14pt; margin-top: 8mm; }
  h3 { font-size: 11pt; }
  table { width: 100%; border-collapse: collapse; margin-top: 4mm; }
  th, td { padding: 4px 8px; text-align: left; border-bottom: 1px solid var(--brand-line); font-size: 9pt; }
  th { background: var(--brand-primary); color: white; font-weight: 600; }
  .header { display: flex; align-items: center; gap: 12mm; border-bottom: 2px solid var(--brand-accent); padding-bottom: 4mm; }
  .header img.logo { height: 14mm; }
  .header .meta { color: var(--brand-muted); font-size: 9pt; }
  .kpi-row { display: flex; gap: 4mm; margin-top: 4mm; }
  .kpi { flex: 1; padding: 3mm; border: 1px solid var(--brand-line); border-radius: 2mm; }
  .kpi .label { color: var(--brand-muted); font-size: 8pt; text-transform: uppercase; letter-spacing: 0.5px; }
  .kpi .value { font-size: 16pt; font-weight: 700; color: var(--brand-primary); }
</style>
</head>
<body>
{% block content %}{% endblock %}
</body>
</html>
```

- [ ] **Step 2: Create _components.html**

```html
{# lib/lambdas/pdf_api/templates/_components.html #}
{% macro kpi_box(label, value) %}
<div class="kpi">
  <div class="label">{{ label }}</div>
  <div class="value">{{ value }}</div>
</div>
{% endmacro %}

{% macro format_lap(time_ms) %}
{% if time_ms is none %}—{% else %}{{ '%.3f'|format(time_ms / 1000) }}s{% endif %}
{% endmacro %}

{% macro racer_row(r) %}
<tr>
  <td>{{ r.rank }}</td>
  <td>{{ r.username }}</td>
  <td>{{ r.countryCode|default('') }}</td>
  <td>{{ format_lap(r.fastestLapTime) }}</td>
  <td>{{ format_lap(r.avgLapTime) }}</td>
  <td>{{ r.numberOfValidLaps }}/{{ r.numberOfValidLaps + r.numberOfInvalidLaps }}</td>
  <td>{{ r.mostConsecutiveLaps }}</td>
</tr>
{% endmacro %}

{% macro podium_step(position, racer, height_mm) %}
<div class="podium-step podium-{{ position }}" style="height: {{ height_mm }}mm;">
  <div class="rank">{{ position }}</div>
  <div class="name">{{ racer.username }}</div>
  <div class="country">{{ racer.countryCode|default('') }}</div>
  <div class="lap">{{ format_lap(racer.fastestLapTime) }}</div>
</div>
{% endmacro %}
```

- [ ] **Step 3: Commit**

```bash
git add lib/lambdas/pdf_api/templates/base.html lib/lambdas/pdf_api/templates/_components.html
git commit -m "feat(pdf): add shared Jinja base layout and component macros"
```

---

## Task 3: Template — Organiser Summary

**Files:**
- Create: `lib/lambdas/pdf_api/templates/organiser_summary.html`

- [ ] **Step 1: Create the template**

```html
{# lib/lambdas/pdf_api/templates/organiser_summary.html #}
{% extends "base.html" %}
{% from "_components.html" import kpi_box, racer_row %}
{% block content %}
<div class="header">
  <img class="logo" src="{{ brand.logo_url }}" alt="logo">
  <div>
    <h1>{{ event.eventName }}</h1>
    <div class="meta">
      {{ event.eventDate }}
      {% if event.countryCode %} · {{ event.countryCode }}{% endif %}
      {% if event.typeOfEvent %} · {{ event.typeOfEvent.replace('_', ' ') }}{% endif %}
      {% if event.sponsor %} · Sponsored by {{ event.sponsor }}{% endif %}
    </div>
  </div>
</div>

<div class="kpi-row">
  {{ kpi_box('Racers', totals.racers) }}
  {{ kpi_box('Races', totals.races) }}
  {{ kpi_box('Valid laps', totals.validLaps) }}
  {{ kpi_box('Fastest lap', totals.fastestLapFormatted) }}
</div>

{% for track in tracks %}
  {% if tracks|length > 1 %}
    <h2>Track: {{ track.trackId }}</h2>
  {% else %}
    <h2>Leaderboard</h2>
  {% endif %}
  <table>
    <thead>
      <tr>
        <th>#</th><th>Racer</th><th>Country</th><th>Fastest</th><th>Average</th><th>Valid / Total</th><th>Most consecutive</th>
      </tr>
    </thead>
    <tbody>
      {% for r in track.racers %}
        {{ racer_row(r) }}
      {% endfor %}
    </tbody>
  </table>
{% endfor %}
{% endblock %}
```

- [ ] **Step 2: Commit**

```bash
git add lib/lambdas/pdf_api/templates/organiser_summary.html
git commit -m "feat(pdf): add organiser summary template"
```

---

## Task 4: Template — Racer Certificate

**Files:**
- Create: `lib/lambdas/pdf_api/templates/racer_certificate.html`

- [ ] **Step 1: Create the template**

```html
{# lib/lambdas/pdf_api/templates/racer_certificate.html #}
{% extends "base.html" %}
{% from "_components.html" import format_lap %}
{% block content %}
<style>
  @page { size: A4 landscape; margin: 18mm; }
  .cert-border {
    border: 3mm double var(--brand-accent);
    padding: 18mm;
    min-height: 170mm;
    text-align: center;
    position: relative;
  }
  .cert-logo { height: 20mm; margin-bottom: 8mm; }
  .cert-title {
    font-size: 30pt;
    font-weight: 700;
    color: var(--brand-primary);
    letter-spacing: 2px;
    text-transform: uppercase;
  }
  .cert-body { font-size: 14pt; margin-top: 10mm; color: var(--brand-text); }
  .cert-name { font-size: 28pt; font-weight: 700; color: var(--brand-primary); margin: 6mm 0; }
  .cert-stats {
    margin-top: 14mm;
    display: flex;
    justify-content: center;
    gap: 10mm;
  }
  .cert-stat { text-align: center; }
  .cert-stat .label { color: var(--brand-muted); font-size: 9pt; text-transform: uppercase; }
  .cert-stat .value { font-size: 20pt; font-weight: 700; color: var(--brand-primary); }
</style>

<div class="cert-border">
  <img class="cert-logo" src="{{ brand.logo_url }}" alt="logo">
  <div class="cert-title">Certificate of Achievement</div>
  <div class="cert-body">This certificate is proudly presented to</div>
  <div class="cert-name">{{ racer.username }}</div>
  <div class="cert-body">
    for participation in <strong>{{ event.eventName }}</strong>
    {% if event.eventDate %} on {{ event.eventDate }}{% endif %}.
  </div>

  <div class="cert-stats">
    <div class="cert-stat">
      <div class="label">Position</div>
      <div class="value">{{ racer.rank }}</div>
    </div>
    <div class="cert-stat">
      <div class="label">Fastest lap</div>
      <div class="value">{{ format_lap(racer.fastestLapTime) }}</div>
    </div>
    <div class="cert-stat">
      <div class="label">Most consecutive laps</div>
      <div class="value">{{ racer.mostConsecutiveLaps }}</div>
    </div>
  </div>
</div>
{% endblock %}
```

- [ ] **Step 2: Commit**

```bash
git add lib/lambdas/pdf_api/templates/racer_certificate.html
git commit -m "feat(pdf): add racer certificate template"
```

---

## Task 5: Template — Podium

**Files:**
- Create: `lib/lambdas/pdf_api/templates/podium.html`

- [ ] **Step 1: Create the template**

```html
{# lib/lambdas/pdf_api/templates/podium.html #}
{% extends "base.html" %}
{% from "_components.html" import format_lap %}
{% block content %}
<style>
  .podium-block {
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 2mm;
    margin: 10mm 0;
    height: 90mm;
  }
  .podium-step {
    width: 52mm;
    padding: 4mm;
    text-align: center;
    color: white;
    font-weight: 600;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }
  .podium-step .rank { font-size: 22pt; }
  .podium-step .name { font-size: 14pt; margin-top: 2mm; }
  .podium-step .country { font-size: 10pt; opacity: 0.85; }
  .podium-step .lap { font-size: 11pt; margin-top: 2mm; opacity: 0.95; }
  .podium-1 { background: #D4AF37; order: 2; }
  .podium-2 { background: #9AA4B2; order: 1; }
  .podium-3 { background: #CD7F32; order: 3; }
</style>

<div class="header">
  <img class="logo" src="{{ brand.logo_url }}" alt="logo">
  <div>
    <h1>{{ event.eventName }} — Podium</h1>
    <div class="meta">{{ event.eventDate }}</div>
  </div>
</div>

<div class="podium-block">
  {% if podium|length > 1 %}
    <div class="podium-step podium-2" style="height: 60mm;">
      <div class="rank">2</div>
      <div class="name">{{ podium[1].username }}</div>
      <div class="country">{{ podium[1].countryCode|default('') }}</div>
      <div class="lap">{{ format_lap(podium[1].fastestLapTime) }}</div>
    </div>
  {% endif %}
  {% if podium|length > 0 %}
    <div class="podium-step podium-1" style="height: 80mm;">
      <div class="rank">1</div>
      <div class="name">{{ podium[0].username }}</div>
      <div class="country">{{ podium[0].countryCode|default('') }}</div>
      <div class="lap">{{ format_lap(podium[0].fastestLapTime) }}</div>
    </div>
  {% endif %}
  {% if podium|length > 2 %}
    <div class="podium-step podium-3" style="height: 45mm;">
      <div class="rank">3</div>
      <div class="name">{{ podium[2].username }}</div>
      <div class="country">{{ podium[2].countryCode|default('') }}</div>
      <div class="lap">{{ format_lap(podium[2].fastestLapTime) }}</div>
    </div>
  {% endif %}
</div>

{% if runners_up %}
  <h2>Positions 4–10</h2>
  <table>
    <thead><tr><th>#</th><th>Racer</th><th>Country</th><th>Fastest</th></tr></thead>
    <tbody>
      {% for r in runners_up %}
        <tr>
          <td>{{ r.rank }}</td>
          <td>{{ r.username }}</td>
          <td>{{ r.countryCode|default('') }}</td>
          <td>{{ format_lap(r.fastestLapTime) }}</td>
        </tr>
      {% endfor %}
    </tbody>
  </table>
{% endif %}
{% endblock %}
```

- [ ] **Step 2: Commit**

```bash
git add lib/lambdas/pdf_api/templates/podium.html
git commit -m "feat(pdf): add podium template"
```

---

## Task 6: Copy Default Logo Asset

**Files:**
- Create: `lib/lambdas/pdf_api/templates/static/deepracer-logo.png`

- [ ] **Step 1: Copy logo**

```bash
cp website/public/logo.png lib/lambdas/pdf_api/templates/static/deepracer-logo.png
```

- [ ] **Step 2: Commit**

```bash
git add lib/lambdas/pdf_api/templates/static/deepracer-logo.png
git commit -m "feat(pdf): bundle DeepRacer logo asset for templates"
```

---

## Task 7: Render Module + Template Rendering Tests

`render.py` wraps Jinja2 and WeasyPrint behind one function. Render tests use Jinja2 only (no WeasyPrint needed) so they can run in CI without the native layer.

**Files:**
- Create: `lib/lambdas/pdf_api/render.py`
- Create: `lib/lambdas/pdf_api/test_render.py`

- [ ] **Step 1: Write failing tests**

```python
# lib/lambdas/pdf_api/test_render.py
"""
Template rendering tests — Jinja2 only, no WeasyPrint dependency.

Verifies that fixture event + race data results in correctly-populated
HTML. PDF byte output is not tested here — that's covered by a live
integration test once the Lambda layer is built.
"""
import datetime as dt
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
            "podium": _fixture_tracks()[0]["racers"][:2]  # only 2 racers in fixture
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
```

- [ ] **Step 2: Run tests — expect failure**

Run: `cd lib/lambdas/pdf_api && python3 -m pytest test_render.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'render'`

- [ ] **Step 3: Implement render.py**

```python
# lib/lambdas/pdf_api/render.py
"""
Thin wrapper around Jinja2 + WeasyPrint.

- `render_html(template_name, context)` is unit-testable — pure Jinja2,
   no WeasyPrint or native libs required.
- `render_pdf(template_name, context)` imports WeasyPrint lazily so
   this module can be imported by tests that don't need a PDF rendered.
"""
import os

from jinja2 import Environment, FileSystemLoader, select_autoescape

_TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "templates")

_env = Environment(
    loader=FileSystemLoader(_TEMPLATE_DIR),
    autoescape=select_autoescape(["html"]),
)


def render_html(template_name: str, context: dict) -> str:
    """Render a Jinja2 template to HTML. No PDF, no WeasyPrint."""
    tpl = _env.get_template(template_name)
    return tpl.render(**context)


def render_pdf(template_name: str, context: dict) -> bytes:
    """Render a Jinja2 template all the way to PDF bytes."""
    from weasyprint import HTML  # lazy import — needs the native layer

    html = render_html(template_name, context)
    return HTML(string=html, base_url=_TEMPLATE_DIR).write_pdf()
```

- [ ] **Step 4: Install test deps and run**

Run: `.venv/bin/pip install jinja2`
Run: `cd lib/lambdas/pdf_api && python3 -m pytest test_render.py -v`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/lambdas/pdf_api/render.py lib/lambdas/pdf_api/test_render.py
git commit -m "feat(pdf): add render module with Jinja2/WeasyPrint split and template tests"
```

---

## Task 8: PDF Lambda Handler

AppSync resolver with one mutation and a `PdfType` discriminator. Reads event + race data from DynamoDB, fetches username + country from Cognito (with fallback for deleted users), computes summaries, renders PDF, uploads to S3, returns pre-signed URL.

**Files:**
- Create: `lib/lambdas/pdf_api/index.py`

- [ ] **Step 1: Implement the handler**

```python
# lib/lambdas/pdf_api/index.py
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
        # track info doesn't roll up into ranked; single-track fallback
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
```

- [ ] **Step 2: Verify syntax**

Run: `python3 -c "import ast; ast.parse(open('lib/lambdas/pdf_api/index.py').read()); print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add lib/lambdas/pdf_api/index.py
git commit -m "feat(pdf): add Lambda handler with AppSync resolver for four PDF types"
```

---

## Task 9: WeasyPrint Lambda Layer

WeasyPrint needs native libs (cairo, pango, gdk-pixbuf, glib) that aren't pip-installable. Build the layer from a custom Dockerfile using the SAM build image and dnf-install the Amazon Linux 2023 versions of the libs, then pip-install WeasyPrint and bundle its Python deps.

**Files:**
- Create: `lib/lambda_layers/weasyprint/Dockerfile`
- Create: `lib/lambda_layers/weasyprint/requirements.txt`
- Create: `lib/lambda_layers/weasyprint/README.md`

- [ ] **Step 1: Create requirements.txt**

```
weasyprint==62.3
jinja2==3.1.4
```

- [ ] **Step 2: Create Dockerfile**

```dockerfile
# lib/lambda_layers/weasyprint/Dockerfile
# Builds a Lambda layer with WeasyPrint + its native dependencies.
# Amazon Linux 2023 (SAM build image) ships cairo/pango/gdk-pixbuf in dnf.
FROM public.ecr.aws/sam/build-python3.12:latest-arm64

RUN dnf install -y \
    cairo \
    cairo-gobject \
    pango \
    gdk-pixbuf2 \
    glib2 \
    fontconfig \
    freetype \
    libffi \
    libjpeg-turbo \
    libpng \
    && dnf clean all

# Bundle the native libs into the layer's /opt/lib so they're loadable at
# runtime (Lambda adds /opt/lib to LD_LIBRARY_PATH automatically).
WORKDIR /asset-output
RUN mkdir -p python/lib lib && \
    cp -P /usr/lib64/libcairo* lib/ && \
    cp -P /usr/lib64/libpango* lib/ && \
    cp -P /usr/lib64/libgdk_pixbuf* lib/ && \
    cp -P /usr/lib64/libgobject* lib/ && \
    cp -P /usr/lib64/libglib* lib/ && \
    cp -P /usr/lib64/libgio* lib/ && \
    cp -P /usr/lib64/libfontconfig* lib/ && \
    cp -P /usr/lib64/libfreetype* lib/ && \
    cp -P /usr/lib64/libffi* lib/ && \
    cp -P /usr/lib64/libjpeg* lib/ && \
    cp -P /usr/lib64/libpng* lib/ && \
    cp -P /usr/lib64/libharfbuzz* lib/ 2>/dev/null || true && \
    cp -P /usr/lib64/libfribidi* lib/ 2>/dev/null || true && \
    cp -P /usr/lib64/libthai* lib/ 2>/dev/null || true && \
    cp -P /usr/lib64/libdatrie* lib/ 2>/dev/null || true

COPY requirements.txt .
RUN pip install --no-cache-dir --target python -r requirements.txt
```

- [ ] **Step 3: Create README**

```markdown
# WeasyPrint Lambda Layer

Custom Lambda layer for the PDF feature. Unlike pure-Python layers
(`helper_functions`, `appsync_helpers`), WeasyPrint needs native
dependencies (cairo, pango, gdk-pixbuf, glib, fontconfig) that aren't
pip-installable — hence the custom Dockerfile.

## How the build works

1. Starts from `public.ecr.aws/sam/build-python3.12:latest-arm64` so the
   resulting .so files match Lambda ARM64 runtime.
2. `dnf install`s the system libraries WeasyPrint links against.
3. Copies the shared-object files into `/asset-output/lib/` — Lambda
   adds `/opt/lib` to `LD_LIBRARY_PATH`, so WeasyPrint finds them at
   runtime.
4. `pip install`s WeasyPrint + Jinja2 into `/asset-output/python/` where
   the Lambda runtime can import them.

## Size

~60-80MB — well within Lambda's 250MB unzipped layer limit.
```

- [ ] **Step 4: Commit**

```bash
git add lib/lambda_layers/weasyprint/
git commit -m "feat(pdf): add WeasyPrint Lambda layer Dockerfile and requirements"
```

---

## Task 10: RaceResultsPdf CDK Construct

**Files:**
- Create: `lib/constructs/race-results-pdf.ts`

- [ ] **Step 1: Create the construct**

```typescript
// lib/constructs/race-results-pdf.ts
import { DockerImage, Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { IBucket } from 'aws-cdk-lib/aws-s3';
import {
  CodeFirstSchema,
  Directive,
  EnumType,
  GraphqlType,
  ObjectType,
  ResolvableField,
} from 'awscdk-appsync-utils';
import { NagSuppressions } from 'cdk-nag';
import { Construct } from 'constructs';
import { StandardLambdaPythonFunction } from './standard-lambda-python-function';

export interface RaceResultsPdfProps {
  appsyncApi: {
    schema: CodeFirstSchema;
    api: appsync.GraphqlApi;
    noneDataSource: appsync.NoneDataSource;
  };
  lambdaConfig: {
    runtime: lambda.Runtime;
    architecture: lambda.Architecture;
    bundlingImage: DockerImage;
    layersConfig: {
      powerToolsLogLevel: string;
      helperFunctionsLayer: lambda.ILayerVersion;
      powerToolsLayer: lambda.ILayerVersion;
    };
  };
  userPoolId: string;
  userPoolArn: string;
  raceTable: dynamodb.ITable;
  eventsTable: dynamodb.ITable;
  logsBucket: IBucket;
}

export class RaceResultsPdf extends Construct {
  constructor(scope: Construct, id: string, props: RaceResultsPdfProps) {
    super(scope, id);

    // ---------- S3 bucket ----------
    const pdfBucket = new s3.Bucket(this, 'PdfBucket', {
      encryption: s3.BucketEncryption.S3_MANAGED,
      serverAccessLogsBucket: props.logsBucket,
      serverAccessLogsPrefix: 'access-logs/race-results-pdf/',
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    pdfBucket.addLifecycleRule({ enabled: true, expiration: Duration.days(1) });

    // ---------- WeasyPrint layer ----------
    const weasyprintLayer = new lambda.LayerVersion(this, 'WeasyPrintLayer', {
      code: lambda.Code.fromDockerBuild('lib/lambda_layers/weasyprint'),
      compatibleArchitectures: [props.lambdaConfig.architecture],
      compatibleRuntimes: [props.lambdaConfig.runtime],
      description: 'WeasyPrint + native deps (cairo, pango, gdk-pixbuf) for PDF rendering',
    });

    // ---------- Lambda ----------
    const pdfLambda = new StandardLambdaPythonFunction(this, 'pdfLambda', {
      entry: 'lib/lambdas/pdf_api/',
      description: 'Race results PDF generator',
      index: 'index.py',
      handler: 'lambda_handler',
      timeout: Duration.minutes(2),
      runtime: props.lambdaConfig.runtime,
      memorySize: 512,
      architecture: props.lambdaConfig.architecture,
      bundling: { image: props.lambdaConfig.bundlingImage },
      layers: [
        weasyprintLayer,
        props.lambdaConfig.layersConfig.helperFunctionsLayer,
        props.lambdaConfig.layersConfig.powerToolsLayer,
      ],
      environment: {
        PDF_BUCKET: pdfBucket.bucketName,
        RACE_TABLE: props.raceTable.tableName,
        EVENTS_TABLE: props.eventsTable.tableName,
        USER_POOL_ID: props.userPoolId,
        URL_EXPIRY_SECONDS: '3600',
        POWERTOOLS_SERVICE_NAME: 'pdf_api',
      },
    });

    pdfBucket.grantReadWrite(pdfLambda);
    props.raceTable.grantReadData(pdfLambda);
    props.eventsTable.grantReadData(pdfLambda);
    pdfLambda.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['cognito-idp:ListUsers'],
        resources: [props.userPoolArn],
      })
    );

    // ---------- AppSync schema ----------
    const pdfTypeEnum = new EnumType('PdfType', {
      definition: ['ORGANISER_SUMMARY', 'PODIUM', 'RACER_CERTIFICATE', 'RACER_CERTIFICATES_BULK'],
    });
    props.appsyncApi.schema.addType(pdfTypeEnum);

    const pdfResultType = new ObjectType('PdfGenerationResult', {
      definition: {
        downloadUrl: GraphqlType.string({ isRequired: true }),
        filename: GraphqlType.string({ isRequired: true }),
        expiresAt: GraphqlType.awsDateTime({ isRequired: true }),
      },
      directives: [Directive.cognito('admin', 'operator', 'commentator', 'racer')],
    });
    props.appsyncApi.schema.addType(pdfResultType);

    const pdfDataSource = props.appsyncApi.api.addLambdaDataSource('PdfDataSource', pdfLambda);
    NagSuppressions.addResourceSuppressions(
      pdfDataSource,
      [
        {
          id: 'AwsSolutions-IAM5',
          reason: 'Suppress wildcard that covers Lambda aliases in resource path',
          appliesTo: [{ regex: '/^Resource::(.+):\\*$/g' }],
        },
      ],
      true
    );

    props.appsyncApi.schema.addMutation(
      'generateRaceResultsPdf',
      new ResolvableField({
        args: {
          eventId: GraphqlType.id({ isRequired: true }),
          type: pdfTypeEnum.attribute({ isRequired: true }),
          userId: GraphqlType.id(),
          trackId: GraphqlType.id(),
        },
        returnType: pdfResultType.attribute(),
        dataSource: pdfDataSource,
        directives: [Directive.cognito('admin', 'operator', 'commentator', 'racer')],
      })
    );
  }
}
```

- [ ] **Step 2: Verify CDK compiles**

Run: `npm run build`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/constructs/race-results-pdf.ts
git commit -m "feat(pdf): add RaceResultsPdf CDK construct"
```

---

## Task 11: Wire into App Stack

**Files:**
- Modify: `lib/drem-app-stack.ts`

- [ ] **Step 1: Add import**

Find the block of construct imports (`import { Statistics } from './constructs/statistics';`) and append:

```typescript
import { RaceResultsPdf } from './constructs/race-results-pdf';
```

- [ ] **Step 2: Instantiate after the Statistics construct**

Find the `new Statistics(this, 'Statistics', {...})` block and add directly after it:

```typescript
    new RaceResultsPdf(this, 'RaceResultsPdf', {
      appsyncApi: appsyncResources,
      lambdaConfig: lambdaConfig,
      userPoolId: userPool.userPoolId,
      userPoolArn: userPool.userPoolArn,
      raceTable: raceManager.raceTable,
      eventsTable: eventsManager.eventsTable,
      logsBucket: props.logsBucket,
    });
```

- [ ] **Step 3: Verify**

Run: `npm run build && npm test`
Expected: compiles, all 5 CDK tests pass.

- [ ] **Step 4: Commit**

```bash
git add lib/drem-app-stack.ts
git commit -m "feat(pdf): wire RaceResultsPdf construct into DeepracerEventManagerStack"
```

---

## Task 12: Frontend GraphQL Mutation

**Files:**
- Modify: `website/src/graphql/mutations.ts`

- [ ] **Step 1: Add mutation**

Append to `mutations.ts`:

```typescript
export const generateRaceResultsPdf = /* GraphQL */ `
    mutation GenerateRaceResultsPdf(
        $eventId: ID!
        $type: PdfType!
        $userId: ID
        $trackId: ID
    ) {
        generateRaceResultsPdf(eventId: $eventId, type: $type, userId: $userId, trackId: $trackId) {
            downloadUrl
            filename
            expiresAt
        }
    }
`;
```

- [ ] **Step 2: Commit**

```bash
git add website/src/graphql/mutations.ts
git commit -m "feat(pdf): add generateRaceResultsPdf GraphQL mutation"
```

---

## Task 13: Frontend Hook

**Files:**
- Create: `website/src/hooks/usePdfApi.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useCallback, useState } from 'react';
import { graphqlMutate } from '../graphql/graphqlHelpers';
import { generateRaceResultsPdf } from '../graphql/mutations';

export type PdfType = 'ORGANISER_SUMMARY' | 'PODIUM' | 'RACER_CERTIFICATE' | 'RACER_CERTIFICATES_BULK';

export interface PdfGenerationResult {
  downloadUrl: string;
  filename: string;
  expiresAt: string;
}

export function usePdfApi() {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(
    async (args: { eventId: string; type: PdfType; userId?: string; trackId?: string }) => {
      setGenerating(true);
      setError(null);
      try {
        const response = await graphqlMutate<{ generateRaceResultsPdf: PdfGenerationResult }>(
          generateRaceResultsPdf,
          args
        );
        return response.generateRaceResultsPdf;
      } catch (err: any) {
        console.error('PDF generation failed:', err);
        const message = err?.errors?.[0]?.message || err.message || 'PDF generation failed';
        setError(message);
        return null;
      } finally {
        setGenerating(false);
      }
    },
    []
  );

  return { generate, generating, error };
}
```

- [ ] **Step 2: Commit**

```bash
git add website/src/hooks/usePdfApi.ts
git commit -m "feat(pdf): add usePdfApi hook for PDF generation"
```

---

## Task 14: Frontend Download Button on Race Admin

Add a "Download PDF" dropdown on the race admin page. Behind the scenes it calls the hook, shows a spinner, then opens `downloadUrl` in a new tab.

**Files:**
- Modify: `website/src/admin/race-admin/raceAdmin.tsx`

- [ ] **Step 1: Find the action bar**

Open `website/src/admin/race-admin/raceAdmin.tsx` and locate the page's action bar / header (search for `Header` or `actions` near the top of the JSX). We'll add the PDF dropdown there.

- [ ] **Step 2: Add import**

Near the other CloudScape imports:

```typescript
import { ButtonDropdown } from '@cloudscape-design/components';
```

Near the other hook imports:

```typescript
import { usePdfApi } from '../../hooks/usePdfApi';
```

- [ ] **Step 3: Use the hook in the component**

Inside the `RaceAdmin` component (find the function body), add:

```typescript
  const { generate, generating } = usePdfApi();
  const { t } = useTranslation(); // if not already present
  const selectedEvent = useSelectedEventContext();

  const onDownloadPdf = async (type: 'ORGANISER_SUMMARY' | 'PODIUM' | 'RACER_CERTIFICATES_BULK') => {
    if (!selectedEvent?.eventId) return;
    const result = await generate({ eventId: selectedEvent.eventId, type });
    if (result) {
      window.open(result.downloadUrl, '_blank', 'noopener');
    }
  };
```

- [ ] **Step 4: Render the dropdown**

In the JSX where Header actions are placed (typically via `Header actions={...}` or `SpaceBetween` near the top of the page), add:

```tsx
<ButtonDropdown
  loading={generating}
  disabled={!selectedEvent?.eventId}
  items={[
    { id: 'summary', text: t('pdf.organiser-summary') },
    { id: 'podium', text: t('pdf.podium') },
    { id: 'certificates', text: t('pdf.bulk-certificates') },
  ]}
  onItemClick={({ detail }) => {
    if (detail.id === 'summary') onDownloadPdf('ORGANISER_SUMMARY');
    else if (detail.id === 'podium') onDownloadPdf('PODIUM');
    else if (detail.id === 'certificates') onDownloadPdf('RACER_CERTIFICATES_BULK');
  }}
>
  {t('pdf.download-pdf')}
</ButtonDropdown>
```

- [ ] **Step 5: Verify**

Run: `cd website && npm run build`
Expected: compiles (ignore pre-existing `config.json` missing-file errors).

- [ ] **Step 6: Commit**

```bash
git add website/src/admin/race-admin/raceAdmin.tsx
git commit -m "feat(pdf): add Download PDF dropdown to race admin page"
```

---

## Task 15: i18n Keys

**Files:**
- Modify: `website/public/locales/en/translation.json`

- [ ] **Step 1: Add keys**

Find the `"stats.laps": "Laps",` line and add below it:

```json
  "pdf.download-pdf": "Download PDF",
  "pdf.organiser-summary": "Organiser summary",
  "pdf.podium": "Podium",
  "pdf.bulk-certificates": "Certificates (all racers, zip)",
  "pdf.certificate": "Certificate",
  "pdf.generating": "Generating PDF…",
  "pdf.generation-failed": "PDF generation failed. Please try again.",
```

- [ ] **Step 2: Commit**

```bash
git add website/public/locales/en/translation.json
git commit -m "feat(pdf): add i18n keys for PDF download UI"
```

---

## Task 16: Verification

- [ ] **Step 1: Run Python unit tests**

Run: `cd lib/lambdas/pdf_api && python3 -m pytest -v`
Expected: all tests pass.

- [ ] **Step 2: CDK build + tests**

Run: `npm run build && npm test`
Expected: CDK compiles, all existing tests pass.

- [ ] **Step 3: Deploy to a dev stack**

Run: `make pipeline.deploy` (or `make manual.deploy` for direct deploy).
Wait for the pipeline to complete.

- [ ] **Step 4: Live integration test — organiser summary**

Run `make local.run`, log in as admin, navigate to Race Admin, select an event with races, click Download PDF → Organiser summary. Verify:
- PDF downloads with the expected filename
- DeepRacer logo appears in header
- Event name, date, country, sponsor render
- KPI row populates with real numbers
- Leaderboard table shows all racers, correctly ranked by fastest lap

- [ ] **Step 5: Live integration test — podium**

Click Download PDF → Podium. Verify:
- Top 3 racers appear on gold/silver/bronze podium with names and times
- Positions 4–10 appear in the footer table

- [ ] **Step 6: Live integration test — bulk certificates**

Click Download PDF → Certificates. Verify:
- A .zip downloads
- Contains one PDF per racer
- Each certificate shows the correct racer name, rank, fastest lap

- [ ] **Step 7: Verify S3 lifecycle**

In the AWS console, open the PDF bucket and confirm the lifecycle rule shows 1-day expiration.

---

## Notes

### What this delivers
- Three PDF types on demand via one AppSync mutation
- Reusable CDK construct (`RaceResultsPdf`) and Lambda layer (`weasyprint`) that later features can depend on
- Template/render module that's pure Python + Jinja2 and testable without WeasyPrint

### What this defers
- Company logo + colour scheme + field customisation — task #52 (white-labelling). Templates already read from a `brand` context object so #52 swaps in a runtime config lookup rather than rewriting templates.
- Per-racer certificate button (racer self-service UI) — the Lambda supports it, but the UI hook is added when the public racer stats page (#33) lands.
- Async generation for very large events (>100 racers bulk zip) — YAGNI until we see a timeout.

### Known redesign risks
- **PR #171 (avatar + highlight colour)** — certificates could show the racer's avatar and use their highlight colour for accents
- **#29 (overlay redesign)** — branding patterns in overlays may settle on different styling that we should match here
- **#52 (white-labelling)** — will replace the hardcoded DeepRacer defaults with tenant-configurable values
