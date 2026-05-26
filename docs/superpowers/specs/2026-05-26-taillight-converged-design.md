# Tail-light from racer profile — converged design (#245 ⊕ #258)

**Date:** 2026-05-26
**Status:** Design agreed (Dave + Steve + real-car findings on LGW99). Supersedes the parallel PRs #245 (Dave) and #258 (Steve); converges on top of **#245**, closes **#258**.
**Closes:** #243.

## Background

#243 asks for the car tail-light to reflect the racer's profile highlight colour. Two parallel implementations were built and compared (`taillight-245-vs-258.md`):

- **#245** (`feat/timekeeper-taillight-racer-colour`): exact hex→PWM backend, Timekeeper **wizard** integration, operator override + live preview, full tests, computed-complementary stop colour.
- **#258** (`feat/taillight-colour`): nearest-of-8 named presets, **classic** `racePage`/`racePageLite` integration, fixed-white stop, colour-dot indicator, no tests.

Real-car testing (LGW99, 2026-05-25) settled the open questions:
1. Firmware **accepts** arbitrary PWM (`set_led_state` → `error=0`); #245's hex→PWM is correct.
2. The diffused RGB LED **cannot render** arbitrary colours — `#673ab7` (3 channels lit) washes to white/faint. The AWS car console does the same ⇒ hardware limitation. Pure/saturated colours render vividly.
3. The computed-complementary stop for a red racer is **blue**, which collides with the DeepRacer's default tail-light ⇒ a useless "stopped" signal.

## Converged decisions

1. **Racing colour — lock the palette to the 8 hardware presets.** Constrain the avatar highlight picker (and the Timekeeper override) to exactly the 8 colours the backend's `colors` dict supports. Every choice is then a hardware-validated colour — **zero approximation, zero wash-out, at the source**. Sent via #245's hex→PWM path (the 8 palette hexes reproduce the dict PWM exactly).
2. **Stop colour — fixed white (`#FFFFFF`)**, via the hex path (all channels max). Drop the computed-complementary logic (finding 3). White stays **out of the picker** (reserved as the stop signal).
3. **UI coverage — both** the Timekeeper **wizard** (#245) and the **classic** `racePage`/`racePageLite` (#258). Independent code paths, both in the nav, both need it.
4. **Defensive snap for legacy profiles.** Existing profiles may hold an out-of-palette hex (e.g. Trackboss's `#673ab7`, now dropped). Before sending, snap any colour not in the palette to the **nearest palette hex** (RGB Euclidean), so old profiles still render well until the racer re-picks. New picks are always exact (distance 0).

## The 8-colour palette (canonical, from the backend `colors` dict)

| Name (backend) | PWM (r/g/b of 9999825) | Hex |
|---|---|---|
| blue | 0 / 0 / max | `#0000FF` |
| red | max / 0 / 0 | `#FF0000` |
| marigold | max / 5097950 / 0 | `#FF8200` |
| orchid purple | 5019520 / 0 / 5019520 | `#800080` |
| sky blue | 1176450 / 5646960 / max | `#1E90FF` |
| green | 4862660 / 9882180 / 0 | `#7CFC00` |
| violet *(actually magenta)* | max / 0 / max | `#FF00FF` |
| lime *(actually yellow)* | max / max / 0 | `#FFFF00` |

`TAIL_LIGHT_COLOURS` becomes exactly these 8 (order: blue, red, marigold, orchid purple, sky blue, green, violet, lime). **Dropped** from the current 13: `#673ab7` (wash), `#e91e63`, `#FF0090` (pinks, not presets), `#417505` (dark green, not a preset), `#FFFFFF` (→ stop, reserved). **Aligned** to exact dict hex: `#1E8FFF`→`#1E90FF`, `#00FF00`→`#7CFC00`.

The backend name/colour mismatches ("violet"=magenta, "lime"=yellow) are cosmetic naming in the Lambda dict; the hex values are authoritative and unchanged.

## Architecture & components

Convergence lands on **#245's** structure (hex→PWM backend, wizard integration, override control, tests) and adds #258's classic-page integration + the palette lock + the white stop.

1. **`website/src/constants/tailLightColours.ts`** — `TAIL_LIGHT_COLOURS` curated to the 8 hexes above. Shared by the avatar picker and the Timekeeper override, so both are constrained at once.

2. **`website/src/pages/timekeeper/support-functions/tailLightColour.ts`**
   - Keep `resolveRacingColour(highlight, override)` (override → highlight → default).
   - **Add** `nearestPaletteColour(hex)` — RGB Euclidean snap to the nearest `TAIL_LIGHT_COLOURS` entry; returns a palette **hex**. In-palette input returns itself (distance 0).
   - **Replace** stop handling: export `STOP_COLOUR = '#FFFFFF'`; **remove** `complementaryColour` (and its tests).
   - The colour actually sent = `nearestPaletteColour(resolveRacingColour(...))`.

3. **`website/src/pages/timekeeper/timeKeeperWizard.tsx`** (existing #245 wiring) — send `nearestPaletteColour(racingColour)`; on race finish send `STOP_COLOUR` + emergency stop (replacing `complementaryColour(racingColour)`). Override control + preview unchanged.

4. **`website/src/pages/timekeeper/pages/racePage.tsx` + `racePageLite.tsx`** — **new** classic-page integration (behaviour ported from #258, but calling #245's `tailLightColour.ts` helpers + hex path, not #258's named-colour helpers): on car-select set the tail-light from the racer's profile (snapped hex) + show the colour-dot indicator; on car-swap revert the old car; on race end send `STOP_COLOUR` + emergency stop. Operator override stays a **wizard-only** feature for now (out of scope here).

5. **`website/src/admin/user-profile/AvatarBuilder.tsx`** — no change beyond the shared constant; curating `TAIL_LIGHT_COLOURS` automatically limits the picker to the 8 and removes white.

6. **Backend (`lib/lambdas/cars_function/`)** — **no change.** #245's hex→PWM already handles the 8 palette hexes and `#FFFFFF` (white). We do **not** add `"white"` to the named `colors` dict (that was the #258/named-path approach; we're on the hex path).

## Testing

- `tailLightColour.test.ts`: `nearestPaletteColour` snaps an out-of-palette hex (`#673ab7`) to the nearest of the 8, returns an in-palette hex unchanged; `resolveRacingColour` precedence unchanged; `STOP_COLOUR === '#FFFFFF'`. Remove `complementaryColour` tests.
- `taillight_colors.py` tests (hex→PWM) — unchanged; add a check that each of the 8 palette hexes maps to the backend dict's PWM (guards future palette/dict drift).
- Build + lint: website build, vitest, CDK build.
- Manual (real car): each of the 8 renders distinctly; `#FFFFFF` stop is visible (distinct from default); legacy `#673ab7` profile snaps to a sensible neighbour; both wizard and classic flows trigger correctly.

## Out of scope / follow-ups

- **Operator override on the classic pages** — wizard-only for now.
- **Car-console palette cleanup** — the same wash-out colours should be dropped from the DeepRacer car console (separate repo); tracked separately.
- **New HTML overlay engine** — unrelated (tail-light is a Timekeeper feature, not an overlay).

## Delivery

Single converged PR on top of #245 (`feat/taillight-converged`). Close #258 once merged.
