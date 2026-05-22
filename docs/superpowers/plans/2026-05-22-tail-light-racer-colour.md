# Tail-light Racer Colour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the Timekeeper, set the assigned car's tail light to the racer's exact profile `highlightColour` on car-assignment, and a computed-complementary "stopped" colour + all-stop on race completion, with an operator swatch preview + override.

**Architecture:** Extend the existing `carSetTaillightColor` Lambda to accept a `#RRGGBB` hex (→ per-channel PWM) in addition to its named-colour presets. A pure frontend helper computes the racing/stop colours. The Timekeeper wizard fetches the racer's `highlightColour`, sends the colour via the existing `carsUpdateTaillightColor` on car-assignment, and sends the complementary colour + `carEmergencyStop` on race-complete.

**Tech Stack:** Python 3.12 Lambda (AWS Lambda Powertools), React + TypeScript + CloudScape, XState (existing race machine), Vitest (node-env unit tests), pytest (Lambda unit tests).

**Spec:** `docs/superpowers/specs/2026-05-22-tail-light-racer-colour-design.md`

**Branch:** `feat/timekeeper-taillight-racer-colour` (off `upstream/main`; the spec commit is already here).

---

## File structure

| File | Action | Responsibility |
|------|--------|----------------|
| `lib/lambdas/cars_function/taillight_colors.py` | Create | Pure colour palette + `hex_to_pwm` + `color_for` (no AWS imports → unit-testable). |
| `lib/lambdas/cars_function/test_taillight_colors.py` | Create | pytest for the pure colour logic. |
| `lib/lambdas/cars_function/index.py` | Modify | Use `color_for` in `carSetTaillightColor`; `availableTaillightColors` returns `PALETTE` keys. |
| `website/src/pages/timekeeper/support-functions/tailLightColour.ts` | Create | Pure helper: `resolveRacingColour`, `complementaryColour`, defaults. |
| `website/src/pages/timekeeper/support-functions/tailLightColour.test.ts` | Create | Vitest for the helper. |
| `website/src/pages/timekeeper/components/tailLightColourControl.tsx` | Create | Swatch preview + operator override palette. |
| `website/src/pages/timekeeper/timeKeeperWizard.tsx` | Modify | Fetch `highlightColour`; racing-colour state; car-assignment + race-complete triggers; mount the control. |

> **Testing note:** the project's website Vitest is node-env, `.test.ts` only (no component/DOM tests), and the wizard is `// @ts-nocheck`. So the **pure** helper (Task 2) and the **Lambda** logic (Task 1) are unit-tested; the wizard wiring + UI component (Tasks 3–4) are gated by `npm run build` (tsc type-checks `tailLightColour.ts` and `tailLightColourControl.tsx`, though not the `@ts-nocheck` wizard) plus a manual smoke test (Task 5).

---

## Task 1: Backend — hex-aware tail-light colour

Extract the palette + a hex→PWM converter into a pure module (testable without boto3/powertools), and route `carSetTaillightColor` through it.

**Files:**
- Create: `lib/lambdas/cars_function/taillight_colors.py`
- Create: `lib/lambdas/cars_function/test_taillight_colors.py`
- Modify: `lib/lambdas/cars_function/index.py` (`colors` dict at `:30`, `carSetTaillightColor` at `:255`, `availableTaillightColors` at `:337`)

- [ ] **Step 1: Write the failing test** — `lib/lambdas/cars_function/test_taillight_colors.py`

```python
from taillight_colors import hex_to_pwm, color_for, PALETTE, MAX_PWM


def test_hex_to_pwm_full_and_zero_channels():
    assert hex_to_pwm("#FF0000") == {"red_pwm": MAX_PWM, "green_pwm": 0, "blue_pwm": 0}
    assert hex_to_pwm("#00FF00") == {"red_pwm": 0, "green_pwm": MAX_PWM, "blue_pwm": 0}
    assert hex_to_pwm("#0000FF") == {"red_pwm": 0, "green_pwm": 0, "blue_pwm": MAX_PWM}
    assert hex_to_pwm("#FFFFFF") == {"red_pwm": MAX_PWM, "green_pwm": MAX_PWM, "blue_pwm": MAX_PWM}
    assert hex_to_pwm("#000000") == {"red_pwm": 0, "green_pwm": 0, "blue_pwm": 0}


def test_hex_to_pwm_accepts_lowercase_and_no_hash():
    assert hex_to_pwm("ff0000") == {"red_pwm": MAX_PWM, "green_pwm": 0, "blue_pwm": 0}


def test_color_for_routes_hex_and_named():
    assert color_for("#FF0000") == {"red_pwm": MAX_PWM, "green_pwm": 0, "blue_pwm": 0}
    assert color_for("blue") == PALETTE["blue"]
    assert color_for("BLUE") == PALETTE["blue"]


def test_color_for_falls_back_to_blue_on_bad_input():
    assert color_for("#ZZZZZZ") == PALETTE["blue"]
    assert color_for("nonsense") == PALETTE["blue"]
    assert color_for("") == PALETTE["blue"]
    assert color_for(None) == PALETTE["blue"]
```

- [ ] **Step 2: Run the test to verify it fails**

Run (in the Python venv from `make local.config.python`): `cd lib/lambdas/cars_function && python -m pytest test_taillight_colors.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'taillight_colors'`.

- [ ] **Step 3: Create the pure module** — `lib/lambdas/cars_function/taillight_colors.py`

```python
"""Car tail-light colour palette + hex→PWM conversion (pure, no AWS deps)."""

# Full-scale per-channel PWM the DeepRacer firmware uses (verified: the named
# presets below use this value for a fully-on channel).
MAX_PWM = 9999825

# Convenience named presets (used by the /admin/devices colour dropdown).
PALETTE = {
    "blue": {"blue_pwm": 9999825, "green_pwm": 0, "red_pwm": 0},
    "red": {"blue_pwm": 0, "green_pwm": 0, "red_pwm": 9999825},
    "marigold": {"blue_pwm": 0, "green_pwm": 5097950, "red_pwm": 9999825},
    "orchid purple": {"blue_pwm": 5019520, "green_pwm": 0, "red_pwm": 5019520},
    "sky blue": {"blue_pwm": 9999825, "green_pwm": 5646960, "red_pwm": 1176450},
    "green": {"blue_pwm": 0, "green_pwm": 9882180, "red_pwm": 4862660},
    "violet": {"blue_pwm": 9999825, "green_pwm": 0, "red_pwm": 9999825},
    "lime": {"blue_pwm": 0, "green_pwm": 9999825, "red_pwm": 9999825},
}


def hex_to_pwm(hex_str):
    """Convert a #RRGGBB hex colour to a {red_pwm, green_pwm, blue_pwm} dict.

    Raises ValueError/IndexError for malformed input (caller falls back).
    """
    h = hex_str.lstrip("#")
    if len(h) != 6:
        raise ValueError(f"expected 6 hex digits, got {hex_str!r}")
    r = int(h[0:2], 16)
    g = int(h[2:4], 16)
    b = int(h[4:6], 16)

    def scale(channel):
        return round(channel / 255 * MAX_PWM)

    return {"red_pwm": scale(r), "green_pwm": scale(g), "blue_pwm": scale(b)}


def color_for(selected):
    """Resolve a tail-light colour spec to PWM values.

    Accepts either a #RRGGBB hex string or a named preset (case-insensitive).
    Falls back to blue for anything unrecognised or malformed.
    """
    if selected and selected.startswith("#"):
        try:
            return hex_to_pwm(selected)
        except (ValueError, IndexError):
            return PALETTE["blue"]
    return PALETTE.get((selected or "").lower(), PALETTE["blue"])
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd lib/lambdas/cars_function && python -m pytest test_taillight_colors.py -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Wire `index.py` through the module**

In `lib/lambdas/cars_function/index.py`:

(a) **Delete** the inline `colors = { … }` dict (lines ~30–39) and **add** an import near the top imports (after line 4, `from typing import List`):

```python
from taillight_colors import PALETTE, color_for
```

(b) In `carSetTaillightColor` (`:255`), replace the colour lookup:

```python
        color = colors.get(selectedColor.lower())
        if color is None:
            color = colors.get("Blue")
```

with:

```python
        color = color_for(selectedColor)
```

(c) In `availableTaillightColors` (`:338`), change `return list(colors.keys())` to:

```python
    return list(PALETTE.keys())
```

- [ ] **Step 6: Confirm the existing tests + import still hold**

Run: `cd lib/lambdas/cars_function && python -m pytest -v`
Expected: PASS. (If `import index` is exercised elsewhere it needs `AWS_DEFAULT_REGION`; the new `test_taillight_colors.py` imports only the pure module, so it has no such dependency.)

- [ ] **Step 7: Commit**

```bash
git add lib/lambdas/cars_function/taillight_colors.py lib/lambdas/cars_function/test_taillight_colors.py lib/lambdas/cars_function/index.py
git commit -m "feat(cars): accept hex tail-light colour (#58 / #243)

Extract the tail-light palette + a hex->PWM converter into a pure,
unit-tested taillight_colors module. carSetTaillightColor now accepts a
#RRGGBB hex (exact RGB->PWM) as well as the named presets; /admin/devices
named-colour usage is unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Frontend pure colour helper

**Files:**
- Create: `website/src/pages/timekeeper/support-functions/tailLightColour.ts`
- Test: `website/src/pages/timekeeper/support-functions/tailLightColour.test.ts`

- [ ] **Step 1: Write the failing test** — `tailLightColour.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import {
  resolveRacingColour,
  complementaryColour,
  DEFAULT_RACING_COLOUR,
  DEFAULT_STOP_COLOUR,
} from './tailLightColour';

describe('resolveRacingColour', () => {
  it('prefers override, then highlight, then the default', () => {
    expect(resolveRacingColour('#FF0000', '#00FF00')).toBe('#00FF00');
    expect(resolveRacingColour('#FF0000', null)).toBe('#FF0000');
    expect(resolveRacingColour(null, null)).toBe(DEFAULT_RACING_COLOUR);
    expect(resolveRacingColour('', '')).toBe(DEFAULT_RACING_COLOUR);
  });
});

describe('complementaryColour', () => {
  it('returns blue when the racing colour is in the red range (#243 rule)', () => {
    expect(complementaryColour('#FF0000')).toBe('#0000FF');
  });

  it('rotates hue 180° for non-red colours', () => {
    expect(complementaryColour('#0000FF')).toBe('#FFFF00'); // blue → yellow
    expect(complementaryColour('#00FF00')).toBe('#FF00FF'); // green → magenta
  });

  it('returns the stop default for achromatic input', () => {
    expect(complementaryColour('#FFFFFF')).toBe(DEFAULT_STOP_COLOUR);
    expect(complementaryColour('#808080')).toBe(DEFAULT_STOP_COLOUR);
  });

  it('returns the stop default for malformed input', () => {
    expect(complementaryColour('nope')).toBe(DEFAULT_STOP_COLOUR);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd website && npx vitest run src/pages/timekeeper/support-functions/tailLightColour.test.ts`
Expected: FAIL — `Cannot find module './tailLightColour'`.

- [ ] **Step 3: Implement the helper** — `tailLightColour.ts`

```ts
/** Racer has no highlight colour → white while racing. */
export const DEFAULT_RACING_COLOUR = '#FFFFFF';
/** Fallback "stopped" colour (also used when the racing colour has no usable hue). */
export const DEFAULT_STOP_COLOUR = '#FF0000';

/** Colour to send to the car: operator override → racer highlight → default. */
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

interface Rgb { r: number; g: number; b: number; }
interface Hsl { h: number; s: number; l: number; }

function hexToRgb(hex: string): Rgb | null {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: Rgb): string {
  const hh = (n: number) => Math.round(n).toString(16).padStart(2, '0');
  return `#${hh(r)}${hh(g)}${hh(b)}`.toUpperCase();
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0, s = 0;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
  }
  return { h, s, l };
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  if (s === 0) { const v = l * 255; return { r: v, g: v, b: v }; }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const hn = h / 360;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: hue2rgb(p, q, hn + 1 / 3) * 255,
    g: hue2rgb(p, q, hn) * 255,
    b: hue2rgb(p, q, hn - 1 / 3) * 255,
  };
}

/**
 * Contrasting "stopped" colour for a racing colour.
 * - malformed / achromatic (white/grey/black) → DEFAULT_STOP_COLOUR
 * - racing hue in the red range (≥330° or ≤30°) → blue (#243: a green-ish
 *   complement reads poorly on stream)
 * - otherwise → 180° hue rotation at the same saturation/lightness
 */
export function complementaryColour(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return DEFAULT_STOP_COLOUR;
  const hsl = rgbToHsl(rgb);
  if (hsl.s < 0.1) return DEFAULT_STOP_COLOUR;
  if (hsl.h >= 330 || hsl.h <= 30) return '#0000FF';
  return rgbToHex(hslToRgb({ ...hsl, h: (hsl.h + 180) % 360 }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd website && npx vitest run src/pages/timekeeper/support-functions/tailLightColour.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add website/src/pages/timekeeper/support-functions/tailLightColour.ts website/src/pages/timekeeper/support-functions/tailLightColour.test.ts
git commit -m "feat(timekeeper): pure tail-light colour helper (#58 / #243)

resolveRacingColour (override > highlight > default) and complementaryColour
(180deg rotation, red-range->blue, achromatic->default stop)."
```

---

## Task 3: Timekeeper wiring — fetch colour, send on assignment + completion

**Files:**
- Modify: `website/src/pages/timekeeper/timeKeeperWizard.tsx`

- [ ] **Step 1: Add imports**

Change line 32 from `import { graphqlMutate } from '../../graphql/graphqlHelpers';` to:

```js
import { graphqlMutate, graphqlQuery } from '../../graphql/graphqlHelpers';
```

Add after the existing imports (e.g. after line 49):

```js
import { getRacerProfile } from '../../graphql/queries';
import { complementaryColour, resolveRacingColour } from './support-functions/tailLightColour';
```

- [ ] **Step 2: Expose the car commands + add colour state**

Change line 53 from `const { carFetchLogs } = useCarCmdApi();` to:

```js
const { carFetchLogs, carsUpdateTaillightColor, carEmergencyStop } = useCarCmdApi();
```

Add state near the other `useState` calls (e.g. after line 83, `const [startTime, setStartTime] = useState(undefined);`):

```js
  const [racerHighlightColour, setRacerHighlightColour] = useState(null);
  const [colourOverride, setColourOverride] = useState(null);
  const racingColour = resolveRacingColour(racerHighlightColour, colourOverride);
```

- [ ] **Step 3: Fetch the racer's highlight colour when the racer changes**

Replace the existing effect at lines 99–102:

```js
  useEffect(() => {
    console.log('username:', race.username);
    setSelectedModels([]);
  }, [race.username]);
```

with:

```js
  useEffect(() => {
    console.log('username:', race.username);
    setSelectedModels([]);
    setColourOverride(null);
    if (!race.username) {
      setRacerHighlightColour(null);
      return;
    }
    let cancelled = false;
    graphqlQuery(getRacerProfile, { username: race.username })
      .then((data) => {
        if (!cancelled) setRacerHighlightColour(data?.getRacerProfile?.highlightColour ?? null);
      })
      .catch(() => {
        if (!cancelled) setRacerHighlightColour(null);
      });
    return () => {
      cancelled = true;
    };
  }, [race.username]);
```

- [ ] **Step 4: Send the racing colour on car-assignment**

In `handleOnNavigate`, the final `else` branch (lines 264–269) currently performs the forward navigation. Replace it with:

```js
    } else {
      // Car-assignment trigger: advancing past the car-select step (index 1)
      // with cars chosen → light the tail light(s) in the racer's colour so the
      // car visibly shows "ready for this racer".
      if (activeStepIndex === 1 && detail.reason === 'next' && selectedCars.length > 0) {
        const InstanceIds = selectedCars.map((c) => c.InstanceId);
        carsUpdateTaillightColor(InstanceIds, racingColour);
      }
      setIsLoadingNextStep(false);
      setPreviousStepIndex(activeStepIndex);
      setActiveStepIndex(detail.requestedStepIndex);
      setErrorText('');
    }
```

- [ ] **Step 5: Send complementary + all-stop on race completion**

Replace `raceIsDoneHandler` (lines 210–214):

```js
  const raceIsDoneHandler = () => {
    setIsLoadingNextStep(false);
    setPreviousStepIndex(5);
    setActiveStepIndex(5);
  };
```

with:

```js
  const raceIsDoneHandler = () => {
    // Race over: switch the tail light to the contrasting "stopped" colour and
    // send an all-stop to the car.
    const InstanceIds = selectedCars.map((c) => c.InstanceId);
    if (InstanceIds.length > 0) {
      carsUpdateTaillightColor(InstanceIds, complementaryColour(racingColour));
      carEmergencyStop(InstanceIds);
    }
    setIsLoadingNextStep(false);
    setPreviousStepIndex(5);
    setActiveStepIndex(5);
  };
```

- [ ] **Step 6: Type-check + build**

Run: `cd website && npm run build`
Expected: PASS. (The wizard is `@ts-nocheck`, so this mainly confirms the imports resolve and `tailLightColour.ts` type-checks; the next task adds the type-checked UI component.)

- [ ] **Step 7: Commit**

```bash
git add website/src/pages/timekeeper/timeKeeperWizard.tsx
git commit -m "feat(timekeeper): send racer colour to car on assign + stop colour on finish (#58 / #243)

Fetch the racer's highlightColour, send it (exact hex) to the assigned
car when advancing past the car-select step, and on race completion send
the complementary stop colour plus carEmergencyStop."
```

---

## Task 4: Swatch preview + operator override UI

**Files:**
- Create: `website/src/pages/timekeeper/components/tailLightColourControl.tsx`
- Modify: `website/src/pages/timekeeper/timeKeeperWizard.tsx` (mount it in the car-select step)

- [ ] **Step 1: Create the control** — `tailLightColourControl.tsx`

```tsx
import React from 'react';
import FormField from '@cloudscape-design/components/form-field';
import { resolveRacingColour } from '../support-functions/tailLightColour';

// The colours racers can pick as their profile highlight (mirrors AvatarBuilder).
// Convenience swatches only — the backend now accepts any exact RGB.
const SWATCHES = [
  '#0000FF', '#1E8FFF', '#800080', '#673ab7', '#FF00FF', '#e91e63',
  '#FF0090', '#FF0000', '#FF8200', '#FFFF00', '#00FF00', '#417505', '#FFFFFF',
];

interface TailLightColourControlProps {
  racerHighlightColour?: string | null;
  override: string | null;
  setOverride: (colour: string | null) => void;
}

const dot = (colour: string, selected: boolean): React.CSSProperties => ({
  width: 22,
  height: 22,
  borderRadius: '50%',
  border: 'none',
  background: colour,
  cursor: 'pointer',
  padding: 0,
  boxShadow: selected ? '0 0 0 3px #0972d3' : '0 0 0 1px rgba(0,0,0,0.25)',
});

export const TailLightColourControl: React.FC<TailLightColourControlProps> = ({
  racerHighlightColour,
  override,
  setOverride,
}) => {
  const racingColour = resolveRacingColour(racerHighlightColour, override);
  const source = override ? 'override' : racerHighlightColour ? "racer's profile colour" : 'default (white)';
  return (
    <FormField
      label="Car tail-light colour"
      description="Sent to the assigned car when you continue. Defaults to the racer's profile colour — click a swatch to override, or ✕ to revert."
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: racingColour,
              boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
            }}
          />
          <span style={{ fontSize: 13, opacity: 0.8 }}>{source}</span>
        </span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            title="Use the racer's colour"
            onClick={() => setOverride(null)}
            style={{
              ...dot('transparent', override === null),
              fontSize: 14,
              lineHeight: '22px',
            }}
          >
            ✕
          </button>
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              onClick={() => setOverride(c)}
              style={dot(c, override === c)}
            />
          ))}
        </div>
      </div>
    </FormField>
  );
};
```

- [ ] **Step 2: Mount it in the car-select step**

In `timeKeeperWizard.tsx`, add the import after the other `./components/*` imports (e.g. after line 42, `import { CarSelector } from './components/carSelector';`):

```js
import { TailLightColourControl } from './components/tailLightColourControl';
```

Replace the car-select step `content` (lines 452–462) — the `<CarSelector … />` — by wrapping it with the control in the already-imported `SpaceBetween`:

```jsx
              content: (
                <SpaceBetween size="m">
                  <CarSelector
                    query={{
                      tokens: [
                        { propertyKey: 'fleetName', value: selectedTrack.fleetId, operator: '=' },
                      ],
                      operation: 'and',
                    }}
                    selectedCars={selectedCars}
                    setSelectedCars={setSelectedCars}
                  />
                  <TailLightColourControl
                    racerHighlightColour={racerHighlightColour}
                    override={colourOverride}
                    setOverride={setColourOverride}
                  />
                </SpaceBetween>
              ),
```

- [ ] **Step 3: Type-check + build**

Run: `cd website && npm run build`
Expected: PASS (the control is type-checked TSX).

- [ ] **Step 4: Run the website test suite (regression)**

Run: `cd website && npm test`
Expected: PASS (existing tests + the new `tailLightColour` tests; no tests removed).

- [ ] **Step 5: Commit**

```bash
git add website/src/pages/timekeeper/components/tailLightColourControl.tsx website/src/pages/timekeeper/timeKeeperWizard.tsx
git commit -m "feat(timekeeper): tail-light colour swatch + operator override (#58 / #243)

Show the resolved car colour and let the operator override it (or revert
to the racer's profile colour) in the car-select step."
```

---

## Task 5: Manual smoke test + verification

No code unless an issue is found. This is the human checkpoint, and it covers the one design risk (firmware tolerance for arbitrary PWM).

**Files:** none (unless a fix is needed).

- [ ] **Step 1: Run the app**

Run: `cd website && npm start` → `localhost:3000`, open the Timekeeper wizard (`/admin/timekeeper-wizard`), with a real car in the fleet if available.

- [ ] **Step 2: Verify assignment colour**

Pick a racer who has a profile highlight colour, select their car, and continue past the car step. Confirm: the swatch shows the racer's colour, and (real car) the tail light turns that colour. Try the override swatches + ✕ revert.

- [ ] **Step 3: Verify completion colour + stop**

Run a race to completion. Confirm: the tail light switches to the complementary "stopped" colour and the car receives the all-stop.

- [ ] **Step 4: Verify edge cases**

Racer with no highlight colour → swatch shows white (racing) and the car stops red. Offline car → no crash (command best-effort).

- [ ] **Step 5: Confirm arbitrary-PWM works on hardware**

This is the gating risk in the spec — confirm the firmware shows the exact colour for a non-preset hex (e.g. `#673ab7`). If it doesn't, fall back to nearest-preset mapping (out-of-scope alternative; flag for follow-up).

---

## Self-Review

**Spec coverage:**
- Exact RGB→PWM → Task 1 (`hex_to_pwm` + `color_for`). ✓
- Trigger on car assignment → Task 3 Step 4 (leaving car-select step). ✓
- Computed-complementary stop colour + all-stop → Task 2 (`complementaryColour`) + Task 3 Step 5 (`carEmergencyStop`). ✓
- Swatch preview + operator override → Task 4. ✓
- `highlightColour` via `getRacerProfile` → Task 3 Step 3. ✓
- Edge cases (no colour → white/red; achromatic → default stop; offline best-effort) → Task 2 helper + Task 5 Step 4. ✓
- Backward-compatible `/admin/devices` named colours → Task 1 (`color_for` named path) + named-colour test. ✓
- Testing (pure helper + Lambda unit tests; build + manual for wiring) → Tasks 1, 2, 3, 4, 5. ✓
- Firmware-PWM risk → Task 5 Step 5. ✓

**Placeholder scan:** No TBD/TODO; every code step has complete code; the only conditional ("if firmware doesn't accept arbitrary PWM, fall back…") is the spec's named risk with a concrete contingency, not an unfinished step.

**Type/name consistency:** `resolveRacingColour(highlightColour?, override?)`, `complementaryColour(hex)`, `DEFAULT_RACING_COLOUR`, `DEFAULT_STOP_COLOUR` are defined in Task 2 and used identically in Tasks 3–4. `color_for` / `hex_to_pwm` / `PALETTE` / `MAX_PWM` defined in Task 1 and used consistently. `carsUpdateTaillightColor(InstanceIds, hex)` and `carEmergencyStop(InstanceIds)` match the verified `useCarsApi.ts` signatures. `racerHighlightColour` / `colourOverride` / `racingColour` state names are consistent across Task 3 and Task 4's props.
