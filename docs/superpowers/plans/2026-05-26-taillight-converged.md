# Converged Tail-light Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Converge the two #243 tail-light implementations (#245 + #258) onto one: a palette locked to the 8 hardware-validated presets, #245's hex→PWM backend + wizard UX + tests, #258's classic-page integration, and a fixed-white stop.

**Architecture:** Built on top of #245 (`feat/taillight-converged`). The shared `TAIL_LIGHT_COLOURS` palette is curated to exactly the 8 colours the backend `colors` dict supports, so every racer/override choice is hardware-renderable (no wash-out, no approximation). Colours are sent via #245's existing hex→PWM path; a defensive nearest-palette snap covers legacy profiles holding a now-removed hex. Stop colour is a fixed `#FFFFFF`. Both the Timekeeper wizard and the classic `racePage`/`racePageLite` trigger the behaviour.

**Tech Stack:** React + CloudScape + i18next (frontend); vitest; Python (cars_function hex→PWM, unchanged) + pytest; AppSync GraphQL (`carSetTaillightColor` accepts `#RRGGBB`, `carEmergencyStop`).

**Spec:** `docs/superpowers/specs/2026-05-26-taillight-converged-design.md`. **Branch:** `feat/taillight-converged` (off #245). Close #258 once merged.

---

## File structure

- `website/src/constants/tailLightColours.ts` — **modify.** `TAIL_LIGHT_COLOURS` → the 8 preset hexes. Shared by avatar picker + Timekeeper override; curating it constrains both.
- `website/src/pages/timekeeper/support-functions/tailLightColour.ts` — **modify.** Add `nearestPaletteColour` + `STOP_COLOUR`; remove `complementaryColour`; add async profile helpers (`setTaillightFromProfile`, `setTaillightColour`, `stopCar`) for the classic pages.
- `website/src/pages/timekeeper/support-functions/tailLightColour.test.ts` — **modify.** Test the snap + stop; drop `complementaryColour` tests.
- `website/src/pages/timekeeper/timeKeeperWizard.tsx` — **modify.** Stop = `STOP_COLOUR`; racing colour wrapped in `nearestPaletteColour`.
- `website/src/pages/timekeeper/pages/racePage.tsx` + `racePageLite.tsx` — **modify.** Classic-page integration (port of #258's wiring, hex helpers).
- `lib/lambdas/cars_function/test_taillight_colors.py` — **modify.** Guard that each palette hex maps to the backend dict PWM.

---

## Task 1: Lock the palette to the 8 presets

**Files:** Modify `website/src/constants/tailLightColours.ts`

- [ ] **Step 1: Replace the palette array**

Replace the `TAIL_LIGHT_COLOURS` export with exactly the 8 backend-dict hexes:

```ts
/**
 * The DeepRacer car tail-light colour palette (hex), offered in the racer
 * profile highlight picker and the Timekeeper colour override.
 *
 * These are exactly the 8 colours the car firmware renders cleanly — they
 * match the `colors` dict in lib/lambdas/cars_function/index.py (hex→PWM
 * reproduces the dict's PWM). Colours that wash out on the diffused RGB LED
 * (e.g. #673ab7) and white (#FFFFFF, reserved as the stop signal) are
 * deliberately excluded. Order: blue, red, marigold, orchid purple, sky blue,
 * green, violet (magenta), lime (yellow).
 */
export const TAIL_LIGHT_COLOURS = [
  '#0000FF', '#FF0000', '#FF8200', '#800080',
  '#1E90FF', '#7CFC00', '#FF00FF', '#FFFF00',
];
```

- [ ] **Step 2: Type-check**

Run: `cd website && npx tsc --noEmit`
Expected: exit 0 (the avatar picker and override consume the array unchanged; only its contents changed).

- [ ] **Step 3: Commit**

```bash
git add website/src/constants/tailLightColours.ts
git commit -m "feat(timekeeper): lock tail-light palette to the 8 hardware presets (#243)"
```

---

## Task 2: Palette snap + fixed white stop + async profile helpers

**Files:** Modify `website/src/pages/timekeeper/support-functions/tailLightColour.ts`; Test `website/src/pages/timekeeper/support-functions/tailLightColour.test.ts`

Context: this file currently exports `DEFAULT_RACING_COLOUR='#FFFFFF'`, `DEFAULT_STOP_COLOUR='#FF0000'`, `resolveRacingColour(highlight, override)`, and `complementaryColour(hex)` (with hex→rgb→hsl helpers). The converged design drops `complementaryColour` (stop is fixed white) and adds a nearest-palette snap + async helpers for the classic pages.

- [ ] **Step 1: Rewrite the test file (TDD — write the target tests first)**

Replace the entire contents of `tailLightColour.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import {
  resolveRacingColour,
  nearestPaletteColour,
  DEFAULT_RACING_COLOUR,
  STOP_COLOUR,
} from './tailLightColour';
import { TAIL_LIGHT_COLOURS } from '../../../constants/tailLightColours';

describe('resolveRacingColour', () => {
  it('prefers override, then highlight, then the default', () => {
    expect(resolveRacingColour('#FF0000', '#00FF00')).toBe('#00FF00');
    expect(resolveRacingColour('#FF0000', null)).toBe('#FF0000');
    expect(resolveRacingColour(null, null)).toBe(DEFAULT_RACING_COLOUR);
    expect(resolveRacingColour('', '')).toBe(DEFAULT_RACING_COLOUR);
  });
});

describe('STOP_COLOUR', () => {
  it('is fixed white', () => {
    expect(STOP_COLOUR).toBe('#FFFFFF');
  });
});

describe('nearestPaletteColour', () => {
  it('returns a palette colour unchanged (distance 0)', () => {
    for (const c of TAIL_LIGHT_COLOURS) {
      expect(nearestPaletteColour(c).toUpperCase()).toBe(c.toUpperCase());
    }
  });

  it('snaps an out-of-palette hex to the nearest palette colour', () => {
    // #673ab7 (deep purple, dropped) is nearest to orchid purple #800080.
    expect(nearestPaletteColour('#673ab7').toUpperCase()).toBe('#800080');
    // a near-red snaps to red.
    expect(nearestPaletteColour('#e01010').toUpperCase()).toBe('#FF0000');
  });

  it('returns a palette colour for malformed input (falls back, never throws)', () => {
    expect(TAIL_LIGHT_COLOURS).toContain(nearestPaletteColour('nope'));
    expect(TAIL_LIGHT_COLOURS).toContain(nearestPaletteColour(''));
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd website && npx vitest run src/pages/timekeeper/support-functions/tailLightColour.test.ts`
Expected: FAIL — `nearestPaletteColour` / `STOP_COLOUR` not exported (and `complementaryColour` import removed).

- [ ] **Step 3: Rewrite `tailLightColour.ts`**

Replace the entire file with (keep `resolveRacingColour`; replace `complementaryColour`/`DEFAULT_STOP_COLOUR` with `STOP_COLOUR` + `nearestPaletteColour`; add the async helpers):

```ts
import { graphqlQuery } from '../../../graphql/graphqlHelpers';
import { getRacerProfile } from '../../../graphql/queries';
import { carSetTaillightColor, carEmergencyStop } from '../../../graphql/mutations';
import { TAIL_LIGHT_COLOURS } from '../../../constants/tailLightColours';

/** Racer has no highlight colour → white while racing. */
export const DEFAULT_RACING_COLOUR = '#FFFFFF';
/** Fixed "stopped" colour, sent on race end (distinct from any racing colour). */
export const STOP_COLOUR = '#FFFFFF';

/**
 * Colour to send to the car: operator override → racer highlight → default.
 * All inputs are expected to be `#RRGGBB` hex strings (or null/empty).
 */
export function resolveRacingColour(
  highlightColour?: string | null,
  override?: string | null
): string {
  return (
    (override && override.trim()) ||
    (highlightColour && highlightColour.trim()) ||
    DEFAULT_RACING_COLOUR
  );
}

function hexToRgb(hex: string): [number, number, number] | null {
  let h = (hex || '').trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * Snap an arbitrary hex to the nearest hardware-validated palette colour
 * (RGB Euclidean). An in-palette colour returns itself (distance 0); malformed
 * input falls back to the first palette colour (never throws). This is a
 * defensive layer for legacy profiles holding a hex that was dropped from the
 * palette (e.g. #673ab7) — the picker only offers palette colours, so new
 * picks are always exact.
 */
export function nearestPaletteColour(hex: string): string {
  const target = hexToRgb(hex);
  if (!target) return TAIL_LIGHT_COLOURS[0];
  let nearest = TAIL_LIGHT_COLOURS[0];
  let min = Infinity;
  for (const c of TAIL_LIGHT_COLOURS) {
    const rgb = hexToRgb(c)!;
    const d =
      (target[0] - rgb[0]) ** 2 + (target[1] - rgb[1]) ** 2 + (target[2] - rgb[2]) ** 2;
    if (d < min) {
      min = d;
      nearest = c;
    }
  }
  return nearest;
}

/**
 * Fetch the racer's profile, resolve + snap their highlight colour to a palette
 * hex, and set it on the car. Returns the colour applied + the stop colour, or
 * null if the racer has no highlight colour. Used by the classic race pages.
 */
export async function setTaillightFromProfile(
  carInstanceId: string,
  username: string
): Promise<{ raceColour: string; stopColour: string } | null> {
  try {
    const data = await graphqlQuery<{ getRacerProfile: { highlightColour?: string | null } | null }>(
      getRacerProfile,
      { username }
    );
    const hex = data?.getRacerProfile?.highlightColour;
    if (!hex) return null;
    const raceColour = nearestPaletteColour(resolveRacingColour(hex, null));
    await graphqlQuery(carSetTaillightColor, { resourceIds: [carInstanceId], selectedColor: raceColour });
    return { raceColour, stopColour: STOP_COLOUR };
  } catch (err) {
    console.error('Failed to set taillight colour from profile:', err);
    return null;
  }
}

/** Set a specific hex colour on the car (used for the stop colour + reverts). */
export async function setTaillightColour(carInstanceId: string, colour: string): Promise<void> {
  try {
    await graphqlQuery(carSetTaillightColor, { resourceIds: [carInstanceId], selectedColor: colour });
  } catch (err) {
    console.error('Failed to set taillight colour:', err);
  }
}

/** Emergency-stop the car (sent on race end). */
export async function stopCar(carInstanceId: string): Promise<void> {
  try {
    await graphqlQuery(carEmergencyStop, { resourceIds: [carInstanceId] });
  } catch (err) {
    console.error('Failed to emergency stop car:', err);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd website && npx vitest run src/pages/timekeeper/support-functions/tailLightColour.test.ts`
Expected: PASS (resolveRacingColour 1, STOP_COLOUR 1, nearestPaletteColour 3).

- [ ] **Step 5: Commit**

```bash
git add website/src/pages/timekeeper/support-functions/tailLightColour.ts website/src/pages/timekeeper/support-functions/tailLightColour.test.ts
git commit -m "feat(timekeeper): nearest-palette snap + fixed white stop + profile helpers (#243)"
```

---

## Task 3: Wizard — fixed-white stop + palette snap

**Files:** Modify `website/src/pages/timekeeper/timeKeeperWizard.tsx`

Context: the wizard imports `{ complementaryColour, resolveRacingColour }` from `./support-functions/tailLightColour`, computes `const racingColour = resolveRacingColour(racerHighlightColour, colourOverride);`, sends `carsUpdateTaillightColor(InstanceIds, racingColour)` on the car-step forward-nav, and on race finish sends `carsUpdateTaillightColor(InstanceIds, complementaryColour(racingColour))` + `carEmergencyStop(InstanceIds)`.

- [ ] **Step 1: Update the import**

Replace:
```ts
import { complementaryColour, resolveRacingColour } from './support-functions/tailLightColour';
```
with:
```ts
import { resolveRacingColour, nearestPaletteColour, STOP_COLOUR } from './support-functions/tailLightColour';
```

- [ ] **Step 2: Snap the racing colour**

Replace:
```ts
  const racingColour = resolveRacingColour(racerHighlightColour, colourOverride);
```
with:
```ts
  const racingColour = nearestPaletteColour(resolveRacingColour(racerHighlightColour, colourOverride));
```

- [ ] **Step 3: Fixed-white stop on race finish**

Replace the race-finish send:
```ts
      carsUpdateTaillightColor(InstanceIds, complementaryColour(racingColour));
      carEmergencyStop(InstanceIds);
```
with:
```ts
      carsUpdateTaillightColor(InstanceIds, STOP_COLOUR);
      carEmergencyStop(InstanceIds);
```

(The forward-nav send `carsUpdateTaillightColor(InstanceIds, racingColour)` is unchanged — `racingColour` is now snapped.)

- [ ] **Step 4: Build**

Run: `cd website && npm run build`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add website/src/pages/timekeeper/timeKeeperWizard.tsx
git commit -m "feat(timekeeper): wizard sends snapped racing colour + white stop (#243)"
```

---

## Task 4: Classic-page integration (racePage + racePageLite)

**Files:** Modify `website/src/pages/timekeeper/pages/racePage.tsx` and `website/src/pages/timekeeper/pages/racePageLite.tsx`

Context: #258 added the classic-page tail-light wiring (on car-select set from profile + colour-dot indicator; on race end set stop + emergency stop). Reuse that exact wiring **but call the hex helpers from Task 2** (not #258's named-colour helpers). Fetch #258's diff for the precise structural placement: `gh pr diff 258 --repo aws-solutions-library-samples/guidance-for-aws-deepracer-event-management -- website/src/pages/timekeeper/pages/racePage.tsx website/src/pages/timekeeper/pages/racePageLite.tsx`.

Apply to **both** files (they mirror each other — `currentCar` state, an `endRace` handler in the state machine, a car `Select`).

- [ ] **Step 1: Add the import + state**

Add the import (path is `../support-functions/tailLightColour` from the pages dir):
```ts
import { setTaillightFromProfile, setTaillightColour, stopCar } from '../support-functions/tailLightColour';
```
Add near the other `useState`/`useRef` declarations:
```ts
  const [taillightColourName, setTaillightColourName] = useState<string | null>(null);
  const stopColourRef = useRef<string | null>(null);
```
(Ensure `useRef` is in the React import.)

- [ ] **Step 2: Set the tail-light on car selection**

In the car `Select`'s `onChange` (where `currentCar` is updated — `const car = detail.selectedOption.value;`), after the existing `setCurrentCar(...)`, add: revert the previous car if a stop colour was pending, then apply the new racer's colour:
```ts
                if (currentCar?.InstanceId && stopColourRef.current) {
                  setTaillightColour(currentCar.InstanceId, stopColourRef.current);
                }
                if (car?.InstanceId && raceInfo.username) {
                  setTaillightFromProfile(car.InstanceId, raceInfo.username).then((result) => {
                    if (result) {
                      stopColourRef.current = result.stopColour;
                      setTaillightColourName(result.raceColour);
                    }
                  });
                }
```

- [ ] **Step 3: Stop colour + emergency stop on race end**

In the state machine's `endRace` action, before/with the existing teardown, add:
```ts
        if (currentCar?.InstanceId) {
          if (stopColourRef.current) {
            setTaillightColour(currentCar.InstanceId, stopColourRef.current);
            stopColourRef.current = null;
          }
          stopCar(currentCar.InstanceId);
        }
```

- [ ] **Step 4: Colour-dot indicator**

Next to the "Current car:" display, add a dot when a colour is set (CloudScape-friendly inline element):
```tsx
                {taillightColourName && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      marginLeft: 8,
                      backgroundColor: taillightColourName,
                      boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
                    }}
                    title={`Tail-light: ${taillightColourName}`}
                  />
                )}
```

- [ ] **Step 5: Build**

Run: `cd website && npm run build`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add website/src/pages/timekeeper/pages/racePage.tsx website/src/pages/timekeeper/pages/racePageLite.tsx
git commit -m "feat(timekeeper): tail-light from profile on classic race pages (#243, from #258)"
```

---

## Task 5: Backend palette↔dict guard test

**Files:** Modify `lib/lambdas/cars_function/test_taillight_colors.py`

Context: the converged frontend sends the 8 palette hexes via the hex→PWM path (`taillight_colors.py` `hex_to_pwm`). This test guards that each palette hex maps to the backend `colors` dict's PWM — so the palette and the dict can't silently drift. `hex_to_pwm(hex)` returns a dict/tuple of `{red_pwm, green_pwm, blue_pwm}` (confirm the exact shape by reading `lib/lambdas/cars_function/taillight_colors.py`).

- [ ] **Step 1: Add the guard test**

Append to `lib/lambdas/cars_function/test_taillight_colors.py` (adjust `hex_to_pwm`'s return-shape access to match the actual implementation):

```python
def test_palette_hexes_map_to_backend_dict_pwm():
    """The 8 frontend palette hexes must reproduce the backend colors-dict PWM."""
    from taillight_colors import hex_to_pwm

    # Mirror of website/src/constants/tailLightColours.ts (the 8 presets) and
    # the colors dict in index.py. If the palette/dict drift, this fails.
    expected = {
        "#0000FF": {"red_pwm": 0, "green_pwm": 0, "blue_pwm": 9999825},          # blue
        "#FF0000": {"red_pwm": 9999825, "green_pwm": 0, "blue_pwm": 0},          # red
        "#FF8200": {"red_pwm": 9999825, "green_pwm": 5097950, "blue_pwm": 0},    # marigold
        "#800080": {"red_pwm": 5019520, "green_pwm": 0, "blue_pwm": 5019520},    # orchid purple
        "#1E90FF": {"red_pwm": 1176450, "green_pwm": 5646960, "blue_pwm": 9999825},  # sky blue
        "#7CFC00": {"red_pwm": 4862660, "green_pwm": 9882180, "blue_pwm": 0},    # green
        "#FF00FF": {"red_pwm": 9999825, "green_pwm": 0, "blue_pwm": 9999825},    # violet/magenta
        "#FFFF00": {"red_pwm": 9999825, "green_pwm": 9999825, "blue_pwm": 0},    # lime/yellow
    }
    for hex_value, dict_pwm in expected.items():
        pwm = hex_to_pwm(hex_value)
        assert pwm["red_pwm"] == dict_pwm["red_pwm"], hex_value
        assert pwm["green_pwm"] == dict_pwm["green_pwm"], hex_value
        assert pwm["blue_pwm"] == dict_pwm["blue_pwm"], hex_value
```

If `hex_to_pwm` returns a tuple `(r, g, b)` rather than a dict, adapt the assertions accordingly (read the implementation first). If the rounding differs by ±1 from the dict values, use `abs(pwm[...] - dict_pwm[...]) <= 1` and note it in a comment.

- [ ] **Step 2: Run the test**

Run: `cd lib/lambdas/cars_function && python3 -m pytest test_taillight_colors.py -v` (use the project venv if the bare shim lacks deps)
Expected: PASS (existing tests + the new guard).

- [ ] **Step 3: Commit**

```bash
git add lib/lambdas/cars_function/test_taillight_colors.py
git commit -m "test(cars): guard tail-light palette hexes map to the backend dict PWM (#243)"
```

---

## Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Frontend build + tests**

Run: `cd website && npm run build && npx vitest run`
Expected: build exit 0; vitest all green (incl. the updated `tailLightColour.test.ts`).

- [ ] **Step 2: Backend tests**

Run: `cd lib/lambdas/cars_function && python3 -m pytest -v`
Expected: PASS.

- [ ] **Step 3: CDK build**

Run (repo root): `npm run build`
Expected: exit 0.

- [ ] **Step 4: Sanity grep — no leftover `complementaryColour` references**

Run: `grep -rn "complementaryColour" website/src`
Expected: no matches (it was removed; the wizard no longer imports it).

- [ ] **Step 5: Manual real-car check (human, post-deploy)**

- Avatar picker shows exactly the 8 colours (no white, no deep purple).
- Each of the 8 renders distinctly on the car; `#FFFFFF` stop is visible on race end and distinct from the racing colour.
- A legacy profile holding `#673ab7` snaps to orchid purple (`#800080`) — renders cleanly, not washed.
- Both the wizard car-step and the classic race-page car-select trigger the colour; race end stops + whitens.

---

## After all tasks

Dispatch the final whole-implementation review, then `superpowers:finishing-a-development-branch`. On merge, **close #258** (superseded). Follow-ups (out of scope, tracked): operator override on the classic pages; car-console palette cleanup (separate repo).
