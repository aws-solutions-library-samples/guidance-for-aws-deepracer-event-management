# Design: Set car tail-light colour from racer profile during a race

**Date:** 2026-05-22
**Status:** Drafted (pending review)
**Task:** Backlog #58 · Upstream issue **#243** (StevenAskwith)
**Branch:** `feat/timekeeper-taillight-racer-colour` (off `upstream/main`)

## Problem / motivation

Racers pick a highlight colour in their avatar profile. Today (time-trial racing) only **one car is on track at a time**, so the immediate value isn't disambiguating cars already racing — it's the **pre-race "this car is ready for this racer" signal**: assigning a car to a racer lights it up in that racer's colour, which helps staging and car handoff.

This pays off most once **race management with a queue (backlog #40, racer queuing)** lands — cars being prepped for upcoming racers, each showing its racer's colour, lets operators and pit crew organise the queue at a glance. (At multi-car events / on stream it also makes cars identifiable, but that's secondary for now.) Switching to a contrasting colour on race-complete gives a clear "stopped" signal. The **on-assignment trigger** (rather than on-race-start) is the crux of this — it's what makes "ready for this racer" visible *before* the race.

## Goals

1. When the operator assigns a car to a racer in the Timekeeper, set that car's tail light to the racer's **exact** `highlightColour`.
2. On race completion, switch the tail light to a **contrasting** colour and send an all-stop to the car.
3. Let the operator **see** (swatch) and **override** the colour before it's sent.

## Non-goals

- Changing the colour mid-race / flashing/animated colours (firmware reliability + stream distraction — explicitly out, per #243).
- Queue-and-retry for offline cars (best-effort fire-and-forget for v1).
- Touching the `/admin/devices` tail-light flow (it keeps using named colours).

## Decisions (settled in brainstorming)

| Decision | Choice |
|----------|--------|
| Colour fidelity | **Exact RGB→PWM** — the car shows the racer's actual hex, not a nearest-of-8 preset |
| Trigger | **On car assignment** in the Timekeeper car picker (pre-race "ready" confirmation) |
| Stop colour | **Computed complementary** (180° hue; red-range → blue) + all-stop |
| Operator UX | **Colour swatch preview** + **manual override** |
| Offline car | Best-effort (SSM command fails silently, as today) |

## Verified existing infrastructure

- **Lambda** `lib/lambdas/cars_function/index.py`:
  - `carSetTaillightColor(resourceIds, selectedColor)` (`:255`) → looks up `colors[selectedColor.lower()]` (8 named colours at `:30`, each `{red_pwm, green_pwm, blue_pwm}`) and emits `ros2 service call /servo_pkg/set_led_state … {red, green, blue}` via `callRosService` (SSM `send_command`). **Full-scale PWM = `9999825`** (verified: `blue`/`red` full = 9999825; `marigold` green `5097950` ≈ 0.51 → R255 G130 B0 = `#FF8200`).
  - `availableTaillightColors()` (`:337`) → `list(colors.keys())`.
  - `carEmergencyStop(resourceIds)` (`:279`) → `ros2 … enable_state {is_active: false}` — the **all-stop**.
- **Frontend** `website/src/hooks/useCarsApi.ts`: `carsUpdateTaillightColor(selectedCars, taillightColorId)` (`:400`, calls the `carSetTaillightColor` mutation), `getAvailableTaillightColors()` (`:424`). `useCarCmdApi` is already imported in `timeKeeperWizard.tsx`. (The `/admin/devices` `editCarsModal.tsx` is the only current consumer.)
- **Timekeeper** `src/pages/timekeeper/`: `timeKeeperWizard.tsx` holds `selectedCars` (→ `InstanceIds = selectedCars.map(i => i.InstanceId)`) and the racer config; `racerSelector.tsx` yields the racer's `username` + `sub` (not `highlightColour`); `support-functions/stateMachine.ts` has the `RaceIsOver` state (race-complete signal).
- **`highlightColour`** lives in the RacerProfile (DynamoDB), fetched via the `getRacerProfile(username)` query — the same path the avatar feature uses. It is **not** in the users store, so we fetch it when the racer is resolved.

## Architecture

### 1. Backend — make `carSetTaillightColor` hex-aware (only backend change)
In `cars_function/index.py`, `carSetTaillightColor(resourceIds, selectedColor)`: if `selectedColor` starts with `#`, parse the hex to RGB and convert each channel to PWM:

```
MAX_PWM = 9999825
pwm(channel) = round(int(channel_hex, 16) / 255 * MAX_PWM)
```

then build the same ros2 command from those PWM values. Otherwise fall through to the existing named-colour lookup. **Backward-compatible** — the GraphQL signature (`selectedColor: String`) is unchanged, and `/admin/devices` keeps sending names. Invalid/short hex → fall back to the existing default (`blue`).

### 2. Frontend — pure colour helper `website/src/pages/timekeeper/support-functions/tailLightColour.ts`
Pure, unit-tested (node-env `.test.ts`):
- `complementaryColour(hex): string` — convert hex→HSL, rotate hue +180°, back to hex. **Red-range rule:** if the racing hue is 330–30°, return a fixed **blue** (`#0000FF`) instead (green-ish complement is hard to read on stream — #243). **Achromatic** input (white/grey/black, i.e. saturation ≈ 0) → return `DEFAULT_STOP_COLOUR`.
- `DEFAULT_RACING_COLOUR = '#FFFFFF'` and `DEFAULT_STOP_COLOUR = '#FF0000'` — used when the racer has no `highlightColour` (white racing / red stopped, per #243).
- `resolveRacingColour(highlightColour?, override?): string` → `override || highlightColour || DEFAULT_RACING_COLOUR`.

### 3. Timekeeper wiring (`timeKeeperWizard.tsx` + the car-assignment step)
- When a racer is selected, fetch `getRacerProfile(username).highlightColour` (store it in wizard state).
- **On car assignment** (the step where `selectedCars` is set for the racer): compute `racingColour = resolveRacingColour(highlightColour, override)` and call `carsUpdateTaillightColor(InstanceIds, racingColour)`.
- **On `RaceIsOver`** (observe the XState machine transitioning to `RaceIsOver`): call `carsUpdateTaillightColor(InstanceIds, complementaryColour(racingColour))` then `carEmergencyStop(InstanceIds)`.

### 4. UI — swatch + override (in the car-assignment step)
- A **colour swatch** showing the resolved racing colour next to the car/racer assignment.
- An **operator override**: a small palette of swatches — the AvatarBuilder `TAIL_LIGHT_COLOURS` set (the 13 hex colours racers already pick from) — the operator can click to override the auto colour; clearing it reverts to the racer's colour. Override is wizard-local state and drives both the racing colour and (its) complementary stop colour. (Since the backend now takes exact RGB, this palette is just a convenience set, not a hardware constraint.)

## Data flow
racer picked (`racerSelector` → `username`) → `getRacerProfile(username).highlightColour` → `resolveRacingColour` (override wins) → swatch preview → **on assign**: `carsUpdateTaillightColor(InstanceIds, hex)` → race runs → **`RaceIsOver`**: `carsUpdateTaillightColor(complementary)` + `carEmergencyStop`.

## Edge cases
- **No `highlightColour`** → white racing, red stop (`DEFAULT_*`).
- **Achromatic racing colour** (incl. the white default) → stop colour = `DEFAULT_STOP_COLOUR` (no meaningful complement).
- **Offline car** → SSM command fails silently; acceptable, matches `/admin/devices`. No retry.
- **Two racers, same colour** → fine (visual aid, not a unique ID).
- **Operator override** → overrides racer colour; complementary computed from the override.

## Testing
- **`tailLightColour.test.ts`** (vitest, node): `complementaryColour` across hues incl. a red-range case (→ blue) and an achromatic case (→ default stop); `resolveRacingColour` precedence (override → highlight → default).
- **Backend** `lib/lambdas/cars_function/test_index.py` (new — first test in this lambda; follows the `lib/lambdas/*/test_*.py` pattern): hex→PWM conversion (e.g. `#FF0000` → red 9999825/green 0/blue 0; `#FF8200` ≈ marigold), invalid hex → default, named colour still works.
- **Manual smoke** (real car if available): assign car → tail light shows the racer's colour; complete race → complementary colour + car stops.

## Risks
- **Firmware tolerance for arbitrary PWM.** The 8 presets use intermediate PWM (e.g. `5097950`), strongly implying the firmware accepts any value in `0…9999825` — but this needs a **real-car smoke test** before merge, since it's the one assumption the design rests on.

## Open / deferred
- Offline queue-and-retry (#243 open question) — deferred.
- Reconciling the AvatarBuilder's 13-hex highlight picker vs the car's 8 named presets is now moot (we send exact RGB), but the picker palette is a reasonable source for the override swatches.
