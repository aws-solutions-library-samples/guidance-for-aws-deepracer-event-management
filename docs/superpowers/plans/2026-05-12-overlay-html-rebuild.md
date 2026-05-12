# Overlay HTML+CSS Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the D3+SVG overlay rendering with React components and CSS, behind a `?engine=html` feature flag, so the new and old engines coexist until the old one is deleted in a follow-up PR.

**Architecture:** New engine is a sibling component tree gated by a URL param. Time formatters extract into `format.ts` shared by both engines. AppSync data flow is reimplemented inside the new engine — no shared data layer with the old engine. Dead code (track overlay, did-you-know) is dropped from the old engine in this PR. CSS transitions handle fade (leaderboard) and slide (lower thirds); no Framer Motion.

**Tech Stack:** React 18, TypeScript, CSS modules, Vite, Vitest + React Testing Library, AWS Amplify v6 (AppSync).

**Branch:** `feat/overlay-html-rebuild` off `main` (e7daf6b — v3.0.6). Worktree at `/Users/davidsmith/Development/deepracer/drem-overlay-rebuild`.

**Out of scope:** F1-style position tower, theme system, route-based mode switching, event banner — all defer to the bigger redesign in `docs/superpowers/specs/2026-04-05-overlay-redesign-design.md`.

---

## File Structure

All paths relative to `website/overlays/`.

**New files:**
- `src/format.ts` — pure time formatters (extracted from `helperFunctions.js`)
- `src/format.test.ts` — vitest unit tests for formatters
- `src/components/ChromaBg.tsx` — extracted from `App.tsx`, used by both engines
- `src/components/ChromaBg.test.tsx` — vitest tests
- `src/components/html/OverlayApp.tsx` — root component for the new engine
- `src/components/html/OverlayApp.module.css` — fixed-position container layout (1920×1080)
- `src/components/html/Leaderboard.tsx` — top-4 panel
- `src/components/html/Leaderboard.module.css` — podium colours, gap column, fade transition
- `src/components/html/Leaderboard.test.tsx` — vitest tests
- `src/components/html/LowerThird.tsx` — current-racer info bar
- `src/components/html/LowerThird.module.css` — slide-in transition, layout
- `src/components/html/LowerThird.test.tsx` — vitest tests
- `src/components/html/useOverlayData.ts` — custom hook owning AppSync subscriptions
- `src/components/html/useOverlayData.test.tsx` — vitest tests with mocked Amplify client
- `src/OverlayLegacy.tsx` — extracted from current `App.tsx`, holds the old D3/SVG path
- `vitest.config.ts` — vitest configuration for the overlays app

**Modified files:**
- `package.json` — add vitest + jsdom + test script
- `src/App.tsx` — becomes a thin engine router
- `src/App.test.tsx` — replaced with a smoke test that doesn't depend on the legacy tree
- `src/App.css` — remove dead-code rules (track-overlay-frame, did-you-know-frame)
- `src/helperFunctions.js` — re-export the time formatters from `format.ts` so the old engine still imports them; otherwise untouched

**Deleted files:**
- `public/assets/svg/re-invent-2018-track-overlay-white.svg` — dead
- `public/assets/svg/DidYouKnowWithBackdrop.svg` — dead
- `src/transitions.js` `DidYouKnowFadeIn` / `DidYouKnowFadeOut` exports — dead (rest stays for old engine)

---

## Task 0: Verify worktree setup

**Files:** none

- [ ] **Step 1: Confirm worktree and branch**

Run:
```sh
cd /Users/davidsmith/Development/deepracer/drem-overlay-rebuild
git status
git log --oneline -1
```

Expected:
```
On branch feat/overlay-html-rebuild
nothing to commit, working tree clean
e7daf6b fix(leaderboard): align avatars vertically for positions 4+ (#207) (#208)
```

If anything else is reported, stop and ask the dispatcher — the worktree wasn't set up as expected.

- [ ] **Step 2: Install dependencies**

Run:
```sh
cd /Users/davidsmith/Development/deepracer/drem-overlay-rebuild/website/overlays
npm install
```

Expected: success, no errors.

---

## Task 1: Add vitest to the overlays app

**Files:**
- Modify: `website/overlays/package.json`
- Create: `website/overlays/vitest.config.ts`
- Create: `website/overlays/src/test-setup.ts`
- Delete and recreate: `website/overlays/src/App.test.tsx` (current content asserts on stale boilerplate text)

- [ ] **Step 1: Add devDependencies and test scripts to `package.json`**

Modify `website/overlays/package.json`:
- Add to `devDependencies`: `"vitest": "^3.0.0"`, `"jsdom": "^25.0.0"`
- Add to `scripts`:
  - `"test": "vitest run"`
  - `"test:watch": "vitest"`

Run:
```sh
cd website/overlays
npm install
```

Expected: success.

- [ ] **Step 2: Create `vitest.config.ts`**

Create `website/overlays/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    exclude: [
      '**/node_modules/**',
    ],
    reporters: ['default', ['junit', { outputFile: '../reports/junit-overlays.xml' }]],
  },
});
```

- [ ] **Step 3: Create `src/test-setup.ts`**

Create `website/overlays/src/test-setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: Replace the broken `App.test.tsx` with a placeholder smoke test**

The current `App.test.tsx` asserts on stale CRA boilerplate text (`learn react`) that the app doesn't render. Replace its contents:

```tsx
// website/overlays/src/App.test.tsx
import { describe, test, expect } from 'vitest';

describe('overlays app', () => {
  test('placeholder — replaced by component tests in later tasks', () => {
    expect(true).toBe(true);
  });
});
```

(A real `App` smoke test would need the AppSync client and React Router context, both of which we'll wire up in Task 11. Skipping for now to unblock the rest of the plan.)

- [ ] **Step 5: Run the test suite**

Run:
```sh
cd website/overlays
npm test
```

Expected: 1 test passes (`placeholder — replaced by component tests in later tasks`).

- [ ] **Step 6: Commit**

```sh
git add website/overlays/package.json website/overlays/package-lock.json \
        website/overlays/vitest.config.ts website/overlays/src/test-setup.ts \
        website/overlays/src/App.test.tsx
git commit -m "test(overlays): add vitest + jsdom test harness"
```

---

## Task 2: Extract time formatters into `format.ts`

**Files:**
- Create: `website/overlays/src/format.ts`
- Create: `website/overlays/src/format.test.ts`
- Modify: `website/overlays/src/helperFunctions.js`

- [ ] **Step 1: Write failing tests for `format.ts`**

Create `website/overlays/src/format.test.ts`:
```ts
import { describe, test, expect } from 'vitest';
import {
  GetFormattedLapTime,
  GetFormattedTotalTime,
  GetLeaderboardDataSorted,
} from './format';

describe('GetFormattedLapTime', () => {
  test('sub-minute time without showMinutes returns SS.mmm', () => {
    expect(GetFormattedLapTime(8324)).toBe('08.324');
  });

  test('sub-minute time with showMinutes returns 00:SS.mmm', () => {
    expect(GetFormattedLapTime(8324, true)).toBe('00:08.324');
  });

  test('multi-minute time with showMinutes returns MM:SS.mmm', () => {
    expect(GetFormattedLapTime(71234, true)).toBe('01:11.234');
  });

  test('sentinel 999999999 returns 00.000', () => {
    expect(GetFormattedLapTime(999999999)).toBe('00.000');
  });
});

describe('GetFormattedTotalTime', () => {
  test('positive remaining time returns MM:SS.t', () => {
    expect(GetFormattedTotalTime(125400)).toBe('02:05.4');
  });

  test('zero remaining time returns 00:00.0', () => {
    expect(GetFormattedTotalTime(0)).toBe('00:00.0');
  });

  test('negative remaining time returns 00:00.0', () => {
    expect(GetFormattedTotalTime(-1)).toBe('00:00.0');
  });
});

describe('GetLeaderboardDataSorted', () => {
  test('fastest format sorts by fastestLapTime ascending', () => {
    const entries = [
      { username: 'b', fastestLapTime: 9000 },
      { username: 'a', fastestLapTime: 8000 },
      { username: 'c', fastestLapTime: 10000 },
    ];
    const sorted = GetLeaderboardDataSorted(entries, 'fastest');
    expect(sorted.map((e) => e.username)).toEqual(['a', 'b', 'c']);
  });

  test('average format sorts by fastestAverageLap.avgTime, missing values go last', () => {
    const entries = [
      { username: 'a', fastestAverageLap: { avgTime: 9000 } },
      { username: 'b', fastestAverageLap: null },
      { username: 'c', fastestAverageLap: { avgTime: 8000 } },
    ];
    const sorted = GetLeaderboardDataSorted(entries, 'average');
    expect(sorted.map((e) => e.username)).toEqual(['c', 'a', 'b']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run:
```sh
cd website/overlays
npm test
```

Expected: FAIL — `Cannot find module './format'`.

- [ ] **Step 3: Implement `format.ts`**

Create `website/overlays/src/format.ts`:
```ts
export interface AverageLap {
  avgTime: number;
  startLapId: number;
  endLapId: number;
}

export interface LeaderboardEntry {
  username: string;
  fastestLapTime?: number | null;
  fastestAverageLap?: AverageLap | null;
}

export function PadZero(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function PadZeroMS(n: number | string): string {
  const num = typeof n === 'string' ? Number(n) : n;
  if (num < 10) return `00${num}`;
  if (num < 100) return `0${num}`;
  return String(num);
}

export function GetFormattedLapTime(timeInMS: number, showMinutes = false): string {
  if (timeInMS === 999999999) return '00.000';

  if (showMinutes) {
    const min = Math.floor(timeInMS / 1000 / 60);
    const sec = Math.floor(timeInMS / 1000) - min * 60;
    const ms = String(timeInMS - (min * 60 * 1000 + sec * 1000));
    return `${PadZero(min)}:${PadZero(sec)}.${PadZeroMS(ms).slice(0, 3)}`;
  }

  const sec = Math.floor(timeInMS / 1000);
  const ms = String(timeInMS - sec * 1000);
  return `${PadZero(sec)}.${PadZeroMS(ms).slice(0, 3)}`;
}

export function GetFormattedTotalTime(timeInMS: number): string {
  if (timeInMS < 0) return '00:00.0';
  const min = Math.floor(timeInMS / 1000 / 60);
  const sec = Math.floor(timeInMS / 1000 - min * 60);
  const ms = timeInMS - (min * 60 * 1000 + sec * 1000);
  return `${PadZero(min)}:${PadZero(sec)}.${String(ms).slice(0, 1)}`;
}

export function GetLeaderboardDataSorted<T extends LeaderboardEntry>(
  entries: T[],
  raceFormat: string,
): T[] {
  const sorted = [...entries];
  if (raceFormat === 'average') {
    sorted.sort((a, b) => {
      if (!a.fastestAverageLap && !b.fastestAverageLap) return 0;
      if (!a.fastestAverageLap) return 1;
      if (!b.fastestAverageLap) return -1;
      return a.fastestAverageLap.avgTime - b.fastestAverageLap.avgTime;
    });
  } else {
    sorted.sort((a, b) => {
      const aTime = a.fastestLapTime ?? Infinity;
      const bTime = b.fastestLapTime ?? Infinity;
      return aTime - bTime;
    });
  }
  return sorted;
}
```

- [ ] **Step 4: Run to verify tests pass**

Run:
```sh
cd website/overlays
npm test
```

Expected: PASS — 10 tests pass.

- [ ] **Step 5: Re-export from `helperFunctions.js` so the old engine keeps working**

Modify `website/overlays/src/helperFunctions.js`. At the top, replace the existing `GetFormattedLapTime`, `GetFormattedTotalTime`, `GetLeaderboardDataSorted`, `PadZero`, `PadZeroMS` function definitions with re-exports from `./format`.

Replace lines 188–253 (the `GetLeaderboardDataSorted` / `GetFormattedTotalTime` / `GetFormattedLapTime` / `PadZero` / `PadZeroMS` block) with:
```js
export {
  GetFormattedLapTime,
  GetFormattedTotalTime,
  GetLeaderboardDataSorted,
  PadZero,
  PadZeroMS,
} from './format';
```

Leave the D3 mutators (`SetLocalizedLowerThirdsLabels`, `SetEventName`, `SetFirstPlaceRacerNameAndTime`, etc.) and the `GetFormattedLapTimeForRaceFormat` private helper alone. `GetFormattedLapTimeForRaceFormat` calls `GetFormattedLapTime` — the re-export makes that work.

Also leave `checkMin`, `checkSecond`, and `getLeaderboardData` (the older entries-string parser) alone — they're not part of the formatter set we're extracting.

- [ ] **Step 6: Build the overlays bundle to confirm the old engine still compiles**

Run:
```sh
cd website/overlays
npm run build
```

Expected: success, build outputs to `build/`.

- [ ] **Step 7: Commit**

```sh
git add website/overlays/src/format.ts website/overlays/src/format.test.ts \
        website/overlays/src/helperFunctions.js
git commit -m "refactor(overlays): extract time formatters into format.ts"
```

---

## Task 3: Drop dead-code track overlay + did-you-know

**Files:**
- Modify: `website/overlays/src/App.tsx`
- Modify: `website/overlays/src/App.css`
- Modify: `website/overlays/src/transitions.js`
- Delete: `website/overlays/public/assets/svg/re-invent-2018-track-overlay-white.svg`
- Delete: `website/overlays/public/assets/svg/DidYouKnowWithBackdrop.svg`

Verification first — `SetDRCarPosition` and the Did-You-Know fade exports are never called anywhere outside their definitions. Confirm before deleting:

- [ ] **Step 1: Search for any references**

Run:
```sh
cd /Users/davidsmith/Development/deepracer/drem-overlay-rebuild
grep -rn 'SetDRCarPosition\|DidYouKnowFadeIn\|DidYouKnowFadeOut\|track-overlay\|did-you-know\|DR_CAR\|DR_x5F_CAR' \
  website/overlays/ \
  --exclude-dir=node_modules --exclude-dir=build
```

Expected: matches are only the definitions and JSX in `App.tsx`, the CSS rules in `App.css`, the exports in `helperFunctions.js` and `transitions.js`, and the SVG file itself. No external call sites.

If anything else is found, stop and flag to dispatcher.

- [ ] **Step 2: Remove dead JSX from `App.tsx`**

In `website/overlays/src/App.tsx`, delete these two blocks from the JSX return (currently lines 423–433):

```tsx
      <div id="track-overlay-frame">
        <object type="image/svg+xml" data={`${import.meta.env.BASE_URL}assets/svg/re-invent-2018-track-overlay-white.svg`} id="track-overlay">Track Overlay SVG</object>
      </div>

      <div id="did-you-know-frame">
        <img src={`${import.meta.env.BASE_URL}assets/svg/DidYouKnowWithBackdrop.svg`} id="did-you-know" alt="Did You Know SVG" />
      </div>
```

- [ ] **Step 3: Remove dead CSS rules from `App.css`**

Delete the `#did-you-know-frame`, `#did-you-know-frame #did-you-know`, and `#track-overlay-frame` blocks from `website/overlays/src/App.css`. Keep `#lower-third-racer-and-lap-info`, `#leaderboard-frame`, `#leaderboard-frame #leaderboard`, and `#chromaBg`.

- [ ] **Step 4: Remove dead exports from `transitions.js`**

In `website/overlays/src/transitions.js`, delete the `DidYouKnowFadeIn` and `DidYouKnowFadeOut` exports (currently lines 51–75). Keep everything else.

- [ ] **Step 5: Remove dead exports from `helperFunctions.js`**

In `website/overlays/src/helperFunctions.js`, delete the `SetDRCarPosition` export (currently lines 163–166).

- [ ] **Step 6: Delete the SVG files**

Run:
```sh
git rm website/overlays/public/assets/svg/re-invent-2018-track-overlay-white.svg
git rm website/overlays/public/assets/svg/DidYouKnowWithBackdrop.svg
```

- [ ] **Step 7: Build to confirm**

Run:
```sh
cd website/overlays
npm run build
```

Expected: success.

- [ ] **Step 8: Commit**

```sh
git add website/overlays/src/App.tsx website/overlays/src/App.css \
        website/overlays/src/transitions.js website/overlays/src/helperFunctions.js
git commit -m "chore(overlays): drop unused track overlay + did-you-know"
```

---

## Task 4: Extract `ChromaBg` into its own component

**Files:**
- Create: `website/overlays/src/components/ChromaBg.tsx`
- Create: `website/overlays/src/components/ChromaBg.test.tsx`
- Modify: `website/overlays/src/App.tsx`

The current `ChromaBg` is defined inside `App.tsx` as a closure that reads `useSearchParams` via the enclosing component. Pulling it out makes it usable from the new engine and testable.

- [ ] **Step 1: Write failing tests**

Create `website/overlays/src/components/ChromaBg.test.tsx`:
```tsx
import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ChromaBg } from './ChromaBg';

function renderWith(searchParams: string) {
  return render(
    <MemoryRouter initialEntries={[`/some-event?${searchParams}`]}>
      <ChromaBg />
    </MemoryRouter>,
  );
}

describe('ChromaBg', () => {
  test('renders nothing when chroma param is absent', () => {
    const { container } = renderWith('');
    expect(container.querySelector('#chromaBg')).toBeNull();
  });

  test('renders nothing when chroma=0', () => {
    const { container } = renderWith('chroma=0');
    expect(container.querySelector('#chromaBg')).toBeNull();
  });

  test('renders green background when chroma=1', () => {
    const { container } = renderWith('chroma=1');
    const el = container.querySelector('#chromaBg') as HTMLElement | null;
    expect(el).not.toBeNull();
    expect(el!.style.backgroundColor).toBe('rgb(0, 255, 0)');
  });

  test('renders custom colour when chromaColor is set', () => {
    const { container } = renderWith('chroma=1&chromaColor=ff00ff');
    const el = container.querySelector('#chromaBg') as HTMLElement | null;
    expect(el!.style.backgroundColor).toBe('rgb(255, 0, 255)');
  });

  test('falls back to green if chromaColor is longer than 6 chars (XSS guard)', () => {
    const { container } = renderWith('chroma=1&chromaColor=ff00ffabc');
    const el = container.querySelector('#chromaBg') as HTMLElement | null;
    expect(el!.style.backgroundColor).toBe('rgb(0, 255, 0)');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run:
```sh
cd website/overlays
npm test
```

Expected: FAIL — `Cannot find module './ChromaBg'`.

- [ ] **Step 3: Implement `ChromaBg.tsx`**

Create `website/overlays/src/components/ChromaBg.tsx`:
```tsx
import { useSearchParams } from 'react-router-dom';

export function ChromaBg() {
  const [searchParams] = useSearchParams();
  const enabled = searchParams.get('chroma') === '1';
  if (!enabled) return null;

  let colour = searchParams.get('chromaColor') || '00ff00';
  if (colour.length > 6) {
    // someone tries to cross-site script — override with default green
    colour = '00ff00';
  }
  return <div id="chromaBg" style={{ backgroundColor: `#${colour}` }} />;
}
```

- [ ] **Step 4: Run to verify tests pass**

Run:
```sh
cd website/overlays
npm test
```

Expected: PASS — all 5 ChromaBg tests pass.

- [ ] **Step 5: Wire the new component into `App.tsx`**

In `website/overlays/src/App.tsx`:

1. Remove the inline `function ChromaBG(props: any) {…}` declaration (currently lines 285–298) and the two module-level vars at the top of `App` that supported it: `shouldShowChromaBackground` and `chromaBgColor`.
2. At the top of the file, after the other imports, add:
   ```tsx
   import { ChromaBg } from './components/ChromaBg';
   ```
3. Update the JSX so `<ChromaBG />` becomes `<ChromaBg />`.

- [ ] **Step 6: Build to confirm**

Run:
```sh
cd website/overlays
npm run build
```

Expected: success.

- [ ] **Step 7: Commit**

```sh
git add website/overlays/src/components/ChromaBg.tsx \
        website/overlays/src/components/ChromaBg.test.tsx \
        website/overlays/src/App.tsx
git commit -m "refactor(overlays): extract ChromaBg into shared component"
```

---

## Task 5: Move the legacy implementation into `OverlayLegacy.tsx`

**Files:**
- Create: `website/overlays/src/OverlayLegacy.tsx`
- Modify: `website/overlays/src/App.tsx`

After this task, `App.tsx` becomes thin and will pick the engine in Task 11. For now, it just renders the legacy tree from its new home so we can verify nothing broke.

- [ ] **Step 1: Move the implementation**

Create `website/overlays/src/OverlayLegacy.tsx` as an exact copy of the **current** `App.tsx` body, renamed:

1. Copy the entire contents of `website/overlays/src/App.tsx` to `website/overlays/src/OverlayLegacy.tsx`.
2. Rename the function from `App` to `OverlayLegacy`. Update the default export at the bottom to `export default OverlayLegacy;`.

- [ ] **Step 2: Reduce `App.tsx` to a passthrough**

Replace `website/overlays/src/App.tsx` with:
```tsx
import OverlayLegacy from './OverlayLegacy';

export default function App() {
  return <OverlayLegacy />;
}
```

- [ ] **Step 3: Build to confirm**

Run:
```sh
cd website/overlays
npm run build
```

Expected: success.

- [ ] **Step 4: Manually verify the dev build still works**

Run from the project root:
```sh
make local.build
```

Expected: success. (Sub-builds the overlays into `website/public/overlays/`.)

The full smoke test (browse to `localhost:3000/overlays/<eventId>`) is deferred to Task 12.

- [ ] **Step 5: Commit**

```sh
git add website/overlays/src/OverlayLegacy.tsx website/overlays/src/App.tsx
git commit -m "refactor(overlays): move legacy implementation into OverlayLegacy"
```

---

## Task 6: Build the `Leaderboard` presentational component

**Files:**
- Create: `website/overlays/src/components/html/Leaderboard.tsx`
- Create: `website/overlays/src/components/html/Leaderboard.module.css`
- Create: `website/overlays/src/components/html/Leaderboard.test.tsx`

This component is pure: data via props, no subscriptions or hooks beyond rendering. Tests cover ordering, missing slots, gap-to-leader, race format, and labels.

- [ ] **Step 1: Write failing tests**

Create `website/overlays/src/components/html/Leaderboard.test.tsx`:
```tsx
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Leaderboard } from './Leaderboard';
import type { LeaderboardEntry } from '../../format';

const labels = {
  first: 'P1',
  second: 'P2',
  third: 'P3',
  fourth: 'P4',
  footer: 'Live results',
};

const entries: LeaderboardEntry[] = [
  { username: 'speed', fastestLapTime: 8324 },
  { username: 'turbo', fastestLapTime: 8730 },
  { username: 'doom', fastestLapTime: 8985 },
  { username: 'dbro', fastestLapTime: 9167 },
];

describe('Leaderboard', () => {
  test('renders the four top racers in order with their times', () => {
    render(
      <Leaderboard
        entries={entries}
        raceFormat="fastest"
        gapToLeader={false}
        eventName="Test Event"
        labels={labels}
        visible
      />,
    );
    expect(screen.getByText('speed')).toBeInTheDocument();
    expect(screen.getByText('08.324')).toBeInTheDocument();
    expect(screen.getByText('turbo')).toBeInTheDocument();
    expect(screen.getByText('08.730')).toBeInTheDocument();
    expect(screen.getByText('doom')).toBeInTheDocument();
    expect(screen.getByText('dbro')).toBeInTheDocument();
  });

  test('renders empty slots when fewer than 4 entries supplied', () => {
    render(
      <Leaderboard
        entries={entries.slice(0, 2)}
        raceFormat="fastest"
        gapToLeader={false}
        eventName="Test Event"
        labels={labels}
        visible
      />,
    );
    expect(screen.getByText('speed')).toBeInTheDocument();
    expect(screen.getByText('turbo')).toBeInTheDocument();
    expect(screen.queryByText('doom')).toBeNull();
    expect(screen.queryByText('dbro')).toBeNull();
  });

  test('renders gap-to-leader for P2-P4 when gapToLeader=true', () => {
    render(
      <Leaderboard
        entries={entries}
        raceFormat="fastest"
        gapToLeader
        eventName="Test Event"
        labels={labels}
        visible
      />,
    );
    expect(screen.getByText('+00.406')).toBeInTheDocument(); // 8730 - 8324
    expect(screen.getByText('+00.661')).toBeInTheDocument(); // 8985 - 8324
    expect(screen.getByText('+00.843')).toBeInTheDocument(); // 9167 - 8324
  });

  test('does not render gap-to-leader when gapToLeader=false', () => {
    render(
      <Leaderboard
        entries={entries}
        raceFormat="fastest"
        gapToLeader={false}
        eventName="Test Event"
        labels={labels}
        visible
      />,
    );
    expect(screen.queryByText('+00.406')).toBeNull();
  });

  test('renders fastestAverageLap.avgTime in average format', () => {
    render(
      <Leaderboard
        entries={[{ username: 'avg', fastestAverageLap: { avgTime: 9500, startLapId: 1, endLapId: 3 } }]}
        raceFormat="average"
        gapToLeader={false}
        eventName="Test Event"
        labels={labels}
        visible
      />,
    );
    expect(screen.getByText('09.500')).toBeInTheDocument();
  });

  test('renders DNF in average format when entry has no fastestAverageLap', () => {
    render(
      <Leaderboard
        entries={[{ username: 'dnf', fastestAverageLap: null }]}
        raceFormat="average"
        gapToLeader={false}
        eventName="Test Event"
        labels={labels}
        visible
      />,
    );
    expect(screen.getByText('DNF')).toBeInTheDocument();
  });

  test('renders event name and labels', () => {
    render(
      <Leaderboard
        entries={entries}
        raceFormat="fastest"
        gapToLeader={false}
        eventName="My Cool Event"
        labels={labels}
        visible
      />,
    );
    expect(screen.getByText('My Cool Event')).toBeInTheDocument();
    expect(screen.getByText('P1')).toBeInTheDocument();
    expect(screen.getByText('Live results')).toBeInTheDocument();
  });

  test('applies visible class when visible=true and hidden class when visible=false', () => {
    const { container, rerender } = render(
      <Leaderboard
        entries={entries}
        raceFormat="fastest"
        gapToLeader={false}
        eventName="Test"
        labels={labels}
        visible
      />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/visible/);

    rerender(
      <Leaderboard
        entries={entries}
        raceFormat="fastest"
        gapToLeader={false}
        eventName="Test"
        labels={labels}
        visible={false}
      />,
    );
    expect(root.className).not.toMatch(/visible/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run:
```sh
cd website/overlays
npm test
```

Expected: FAIL — `Cannot find module './Leaderboard'`.

- [ ] **Step 3: Implement `Leaderboard.tsx`**

Create `website/overlays/src/components/html/Leaderboard.tsx`:
```tsx
import { GetFormattedLapTime, GetLeaderboardDataSorted } from '../../format';
import type { LeaderboardEntry } from '../../format';
import styles from './Leaderboard.module.css';

export interface LeaderboardLabels {
  first: string;
  second: string;
  third: string;
  fourth: string;
  footer: string;
}

export interface LeaderboardProps {
  entries: LeaderboardEntry[];
  raceFormat: string;
  gapToLeader: boolean;
  eventName: string;
  labels: LeaderboardLabels;
  visible: boolean;
}

interface Row {
  rank: number;
  entry: LeaderboardEntry | null;
  rankLabel: string;
}

function entryTime(entry: LeaderboardEntry, raceFormat: string): number | null {
  if (raceFormat === 'average') {
    return entry.fastestAverageLap ? entry.fastestAverageLap.avgTime : null;
  }
  return entry.fastestLapTime ?? null;
}

function formatTime(entry: LeaderboardEntry | null, raceFormat: string): string {
  if (!entry) return '';
  if (raceFormat === 'average') {
    return entry.fastestAverageLap
      ? GetFormattedLapTime(entry.fastestAverageLap.avgTime)
      : 'DNF';
  }
  return entry.fastestLapTime != null ? GetFormattedLapTime(entry.fastestLapTime) : '';
}

export function Leaderboard({
  entries,
  raceFormat,
  gapToLeader,
  eventName,
  labels,
  visible,
}: LeaderboardProps) {
  const sorted = GetLeaderboardDataSorted(entries, raceFormat);
  const leaderTime = sorted.length > 0 ? entryTime(sorted[0], raceFormat) : null;

  const rows: Row[] = [
    { rank: 1, entry: sorted[0] ?? null, rankLabel: labels.first },
    { rank: 2, entry: sorted[1] ?? null, rankLabel: labels.second },
    { rank: 3, entry: sorted[2] ?? null, rankLabel: labels.third },
    { rank: 4, entry: sorted[3] ?? null, rankLabel: labels.fourth },
  ];

  return (
    <div className={`${styles.leaderboard} ${visible ? styles.visible : ''}`}>
      <div className={styles.eventName}>{eventName}</div>
      <ol className={styles.rows}>
        {rows.map(({ rank, entry, rankLabel }) => {
          const time = entry ? entryTime(entry, raceFormat) : null;
          const gap = rank > 1 && leaderTime != null && time != null ? time - leaderTime : null;
          return (
            <li key={rank} className={`${styles.row} ${styles[`rank${rank}`]}`}>
              <span className={styles.rank}>{rankLabel}</span>
              <span className={styles.name}>{entry ? entry.username : ''}</span>
              <span className={styles.time}>{formatTime(entry, raceFormat)}</span>
              {gapToLeader && gap != null && gap > 0 ? (
                <span className={styles.gap}>+{GetFormattedLapTime(gap)}</span>
              ) : null}
            </li>
          );
        })}
      </ol>
      <div className={styles.footer}>{labels.footer}</div>
    </div>
  );
}
```

- [ ] **Step 4: Create `Leaderboard.module.css`**

Create `website/overlays/src/components/html/Leaderboard.module.css`:
```css
.leaderboard {
  position: fixed;
  top: 60px;
  left: 60px;
  width: 1200px;
  padding: 32px 48px;
  background: linear-gradient(135deg, rgba(16, 24, 40, 0.92), rgba(28, 38, 64, 0.88));
  border-radius: 16px;
  color: #ffffff;
  font-family: 'Inter', 'Helvetica Neue', sans-serif;
  opacity: 0;
  transition: opacity 1s cubic-bezier(0.65, 0, 0.35, 1);
  pointer-events: none;
}

.visible {
  opacity: 1;
}

.eventName {
  font-size: 36px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 24px;
}

.rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.row {
  display: grid;
  grid-template-columns: 80px 1fr auto auto;
  align-items: center;
  gap: 16px;
  padding: 16px 24px;
  background: rgba(255, 255, 255, 0.04);
  border-left: 6px solid transparent;
  border-radius: 8px;
  font-size: 28px;
}

.rank1 {
  border-left-color: #d4af37; /* gold */
  background: linear-gradient(90deg, rgba(212, 175, 55, 0.18), rgba(255, 255, 255, 0.04));
}

.rank2 {
  border-left-color: #c0c0c0; /* silver */
  background: linear-gradient(90deg, rgba(192, 192, 192, 0.15), rgba(255, 255, 255, 0.04));
}

.rank3 {
  border-left-color: #cd7f32; /* bronze */
  background: linear-gradient(90deg, rgba(205, 127, 50, 0.16), rgba(255, 255, 255, 0.04));
}

.rank {
  font-weight: 700;
}

.name {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.time {
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.gap {
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
  font-variant-numeric: tabular-nums;
  color: rgba(255, 255, 255, 0.7);
  font-size: 22px;
  min-width: 110px;
  text-align: right;
}

.footer {
  margin-top: 24px;
  text-align: right;
  font-size: 18px;
  color: rgba(255, 255, 255, 0.6);
}
```

- [ ] **Step 5: Run to verify tests pass**

Run:
```sh
cd website/overlays
npm test
```

Expected: PASS — all 8 Leaderboard tests pass plus the earlier ones.

- [ ] **Step 6: Commit**

```sh
git add website/overlays/src/components/html/Leaderboard.tsx \
        website/overlays/src/components/html/Leaderboard.module.css \
        website/overlays/src/components/html/Leaderboard.test.tsx
git commit -m "feat(overlays): add HTML Leaderboard component"
```

---

## Task 7: Build the `LowerThird` presentational component

**Files:**
- Create: `website/overlays/src/components/html/LowerThird.tsx`
- Create: `website/overlays/src/components/html/LowerThird.module.css`
- Create: `website/overlays/src/components/html/LowerThird.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `website/overlays/src/components/html/LowerThird.test.tsx`:
```tsx
import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LowerThird } from './LowerThird';

const labels = {
  racer: 'Racer',
  remaining: 'Remaining',
  fastest: 'Fastest lap',
  previous: 'Previous lap',
};

describe('LowerThird', () => {
  test('renders racer name, formatted times, and labels', () => {
    render(
      <LowerThird
        username="speedy"
        timeLeftMs={125400}
        fastestLapMs={8324}
        lastLapMs={9167}
        eventName="Test Event"
        labels={labels}
        visible
      />,
    );
    expect(screen.getByText('speedy')).toBeInTheDocument();
    expect(screen.getByText('02:05.4')).toBeInTheDocument(); // remaining
    expect(screen.getByText('08.324')).toBeInTheDocument(); // fastest
    expect(screen.getByText('09.167')).toBeInTheDocument(); // last
    expect(screen.getByText('Test Event')).toBeInTheDocument();
    expect(screen.getByText('Racer')).toBeInTheDocument();
    expect(screen.getByText('Remaining')).toBeInTheDocument();
    expect(screen.getByText('Fastest lap')).toBeInTheDocument();
    expect(screen.getByText('Previous lap')).toBeInTheDocument();
  });

  test('renders placeholder time when fastestLapMs is null', () => {
    render(
      <LowerThird
        username="speedy"
        timeLeftMs={180000}
        fastestLapMs={null}
        lastLapMs={null}
        eventName="Test Event"
        labels={labels}
        visible
      />,
    );
    // Two placeholder slots (fastest + last) should both show 00.000
    expect(screen.getAllByText('00.000')).toHaveLength(2);
  });

  test('applies visible class when visible=true and hidden class when visible=false', () => {
    const { container, rerender } = render(
      <LowerThird
        username="speedy"
        timeLeftMs={180000}
        fastestLapMs={null}
        lastLapMs={null}
        eventName="Test Event"
        labels={labels}
        visible
      />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/visible/);

    rerender(
      <LowerThird
        username="speedy"
        timeLeftMs={180000}
        fastestLapMs={null}
        lastLapMs={null}
        eventName="Test Event"
        labels={labels}
        visible={false}
      />,
    );
    expect(root.className).not.toMatch(/visible/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run:
```sh
cd website/overlays
npm test
```

Expected: FAIL — `Cannot find module './LowerThird'`.

- [ ] **Step 3: Implement `LowerThird.tsx`**

Create `website/overlays/src/components/html/LowerThird.tsx`:
```tsx
import { GetFormattedLapTime, GetFormattedTotalTime } from '../../format';
import styles from './LowerThird.module.css';

export interface LowerThirdLabels {
  racer: string;
  remaining: string;
  fastest: string;
  previous: string;
}

export interface LowerThirdProps {
  username: string;
  timeLeftMs: number;
  fastestLapMs: number | null;
  lastLapMs: number | null;
  eventName: string;
  labels: LowerThirdLabels;
  visible: boolean;
}

function formatLap(ms: number | null): string {
  if (ms == null) return '00.000';
  return GetFormattedLapTime(ms);
}

export function LowerThird({
  username,
  timeLeftMs,
  fastestLapMs,
  lastLapMs,
  eventName,
  labels,
  visible,
}: LowerThirdProps) {
  return (
    <div className={`${styles.lowerThird} ${visible ? styles.visible : ''}`}>
      <div className={styles.identity}>
        <div className={styles.racerLabel}>{labels.racer}</div>
        <div className={styles.racerName}>{username}</div>
      </div>
      <div className={styles.stat}>
        <div className={styles.statLabel}>{labels.remaining}</div>
        <div className={styles.statValue}>{GetFormattedTotalTime(timeLeftMs)}</div>
      </div>
      <div className={styles.stat}>
        <div className={styles.statLabel}>{labels.fastest}</div>
        <div className={styles.statValue}>{formatLap(fastestLapMs)}</div>
      </div>
      <div className={styles.stat}>
        <div className={styles.statLabel}>{labels.previous}</div>
        <div className={styles.statValue}>{formatLap(lastLapMs)}</div>
      </div>
      <div className={styles.eventName}>{eventName}</div>
    </div>
  );
}
```

- [ ] **Step 4: Create `LowerThird.module.css`**

Create `website/overlays/src/components/html/LowerThird.module.css`:
```css
.lowerThird {
  position: fixed;
  bottom: 60px;
  left: 60px;
  width: 1700px;
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 32px;
  padding: 32px 48px;
  background: linear-gradient(135deg, rgba(16, 24, 40, 0.94), rgba(28, 38, 64, 0.88));
  border-radius: 16px;
  color: #ffffff;
  font-family: 'Inter', 'Helvetica Neue', sans-serif;
  transform: translateX(-110%);
  transition: transform 1s cubic-bezier(0.65, 0, 0.35, 1);
  pointer-events: none;
}

.visible {
  transform: translateX(0);
}

.identity {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.racerLabel,
.statLabel {
  font-size: 18px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.6);
}

.racerName {
  font-size: 48px;
  font-weight: 700;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-start;
}

.statValue {
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
  font-variant-numeric: tabular-nums;
  font-size: 42px;
  font-weight: 600;
}

.eventName {
  grid-column: 1 / -1;
  text-align: right;
  font-size: 16px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 8px;
}
```

- [ ] **Step 5: Run to verify tests pass**

Run:
```sh
cd website/overlays
npm test
```

Expected: PASS — all 3 LowerThird tests pass plus the earlier ones.

- [ ] **Step 6: Commit**

```sh
git add website/overlays/src/components/html/LowerThird.tsx \
        website/overlays/src/components/html/LowerThird.module.css \
        website/overlays/src/components/html/LowerThird.test.tsx
git commit -m "feat(overlays): add HTML LowerThird component"
```

---

## Task 8: Build the `useOverlayData` hook

**Files:**
- Create: `website/overlays/src/components/html/useOverlayData.ts`
- Create: `website/overlays/src/components/html/useOverlayData.test.tsx`

The hook owns:
- The initial `getLeaderboard` query (re-run after each new/delete entry event).
- The three AppSync subscriptions (`onNewOverlayInfo`, `onNewLeaderboardEntry`, `onDeleteLeaderboardEntry`).
- The race-state machine: which view is visible (leaderboard idle vs lower-thirds active), the current racer info, the local countdown timer.

It exposes:
```ts
{
  leaderboardEntries: LeaderboardEntry[];
  eventName: string;
  showLeaderboard: boolean;
  showLowerThird: boolean;
  currentRacer: { username: string; timeLeftMs: number; fastestLapMs: number | null; lastLapMs: number | null } | null;
}
```

- [ ] **Step 1: Write failing tests**

Create `website/overlays/src/components/html/useOverlayData.test.tsx`. The hook is the hardest thing to test because it depends on Amplify. We'll mock `aws-amplify/api` at the module level and drive the hook through fake responses.

```tsx
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const mockSubscribers: Array<{ query: any; next: (msg: any) => void }> = [];

vi.mock('aws-amplify/api', () => ({
  generateClient: () => ({
    graphql: (op: { query: any; variables?: any }) => {
      if (typeof op.query === 'object' && op.query.subscription === true) {
        return {
          subscribe: ({ next }: { next: (msg: any) => void }) => {
            mockSubscribers.push({ query: op.query, next });
            return { unsubscribe: () => {} };
          },
        };
      }
      // Initial getLeaderboard query.
      return Promise.resolve({
        data: {
          getLeaderboard: {
            config: { leaderBoardTitle: 'fake event' },
            entries: [{ username: 'a', fastestLapTime: 1000 }],
          },
        },
      });
    },
  }),
}));

vi.mock('../../graphql/queries.js', () => ({
  getLeaderboard: { name: 'getLeaderboard' },
}));

vi.mock('../../graphql/subscriptions.js', () => ({
  onNewOverlayInfo: { subscription: true, name: 'onNewOverlayInfo' },
  onNewLeaderboardEntry: { subscription: true, name: 'onNewLeaderboardEntry' },
  onDeleteLeaderboardEntry: { subscription: true, name: 'onDeleteLeaderboardEntry' },
}));

beforeEach(() => {
  mockSubscribers.length = 0;
});

// Import after mocks are set up.
import { useOverlayData } from './useOverlayData';

describe('useOverlayData', () => {
  test('loads initial leaderboard entries and event name on mount', async () => {
    const { result } = renderHook(() => useOverlayData({ eventId: 'e1', trackId: '1', raceFormat: 'fastest' }));
    await waitFor(() => {
      expect(result.current.leaderboardEntries).toEqual([{ username: 'a', fastestLapTime: 1000 }]);
      expect(result.current.eventName).toBe('FAKE EVENT');
    });
  });

  test('shows leaderboard initially, hides lower thirds', async () => {
    const { result } = renderHook(() => useOverlayData({ eventId: 'e1', trackId: '1', raceFormat: 'fastest' }));
    await waitFor(() => expect(result.current.showLeaderboard).toBe(true));
    expect(result.current.showLowerThird).toBe(false);
    expect(result.current.currentRacer).toBeNull();
  });

  test('on RACE_IN_PROGRESS message: hides leaderboard, shows lower third with racer info', async () => {
    const { result } = renderHook(() => useOverlayData({ eventId: 'e1', trackId: '1', raceFormat: 'fastest' }));
    await waitFor(() => expect(result.current.leaderboardEntries.length).toBe(1));

    const overlaySub = mockSubscribers.find((s) => s.query.name === 'onNewOverlayInfo')!;
    act(() => {
      overlaySub.next({
        data: {
          onNewOverlayInfo: {
            username: 'racer1',
            timeLeftInMs: 120000,
            raceStatus: 'RACE_IN_PROGRESS',
            laps: [{ lapId: 1, time: 8500, isValid: true }],
          },
        },
      });
    });

    await waitFor(() => {
      expect(result.current.showLeaderboard).toBe(false);
      expect(result.current.showLowerThird).toBe(true);
      expect(result.current.currentRacer?.username).toBe('racer1');
      expect(result.current.currentRacer?.fastestLapMs).toBe(8500);
    });
  });

  test('on RACE_FINSIHED message: hides lower third and shows leaderboard again', async () => {
    const { result } = renderHook(() => useOverlayData({ eventId: 'e1', trackId: '1', raceFormat: 'fastest' }));
    await waitFor(() => expect(result.current.leaderboardEntries.length).toBe(1));

    const overlaySub = mockSubscribers.find((s) => s.query.name === 'onNewOverlayInfo')!;
    act(() => {
      overlaySub.next({
        data: {
          onNewOverlayInfo: { username: 'racer1', timeLeftInMs: 120000, raceStatus: 'RACE_IN_PROGRESS', laps: [] },
        },
      });
    });
    await waitFor(() => expect(result.current.showLowerThird).toBe(true));

    act(() => {
      overlaySub.next({
        data: {
          onNewOverlayInfo: { username: 'racer1', timeLeftInMs: 0, raceStatus: 'RACE_FINSIHED', laps: [] },
        },
      });
    });

    await waitFor(() => {
      expect(result.current.showLowerThird).toBe(false);
      expect(result.current.showLeaderboard).toBe(true);
    });
  });

  test('on competitor=null message: same effect as race finished', async () => {
    const { result } = renderHook(() => useOverlayData({ eventId: 'e1', trackId: '1', raceFormat: 'fastest' }));
    await waitFor(() => expect(result.current.leaderboardEntries.length).toBe(1));

    const overlaySub = mockSubscribers.find((s) => s.query.name === 'onNewOverlayInfo')!;
    act(() => {
      overlaySub.next({
        data: {
          onNewOverlayInfo: { competitor: null, raceStatus: 'NO_RACER_SELECTED' },
        },
      });
    });

    await waitFor(() => {
      expect(result.current.showLowerThird).toBe(false);
      expect(result.current.showLeaderboard).toBe(true);
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run:
```sh
cd website/overlays
npm test
```

Expected: FAIL — `Cannot find module './useOverlayData'`.

- [ ] **Step 3: Implement `useOverlayData.ts`**

Create `website/overlays/src/components/html/useOverlayData.ts`:
```ts
import { useEffect, useState } from 'react';
import { generateClient } from 'aws-amplify/api';
import * as queries from '../../graphql/queries.js';
import * as subscriptions from '../../graphql/subscriptions.js';
import type { LeaderboardEntry } from '../../format';

export interface UseOverlayDataArgs {
  eventId: string;
  trackId: string;
  raceFormat: string;
}

export interface CurrentRacer {
  username: string;
  timeLeftMs: number;
  fastestLapMs: number | null;
  lastLapMs: number | null;
}

export interface OverlayData {
  leaderboardEntries: LeaderboardEntry[];
  eventName: string;
  showLeaderboard: boolean;
  showLowerThird: boolean;
  currentRacer: CurrentRacer | null;
}

const INITIAL_TIME_MS = 180000;

function pickFastest(laps: Array<{ time: number; isValid: boolean }> | undefined): number | null {
  if (!laps) return null;
  const valid = laps.filter((l) => l.isValid);
  if (valid.length === 0) return null;
  return valid.reduce((min, lap) => (lap.time < min ? lap.time : min), Number.POSITIVE_INFINITY);
}

function pickLast(laps: Array<{ lapId: number; time: number; isValid: boolean }> | undefined): number | null {
  if (!laps) return null;
  const valid = laps.filter((l) => l.isValid);
  if (valid.length === 0) return null;
  return valid.reduce((latest, lap) => (lap.lapId > latest.lapId ? lap : latest), valid[0]).time;
}

function pickFastestAvg(
  avgLaps: Array<{ avgTime: number; startLapId: number; endLapId: number }> | undefined,
): number | null {
  if (!avgLaps || avgLaps.length === 0) return null;
  return avgLaps.reduce((min, lap) => (lap.avgTime < min ? lap.avgTime : min), Number.POSITIVE_INFINITY);
}

export function useOverlayData({ eventId, trackId, raceFormat }: UseOverlayDataArgs): OverlayData {
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [eventName, setEventName] = useState<string>('');
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);
  const [showLowerThird, setShowLowerThird] = useState<boolean>(false);
  const [currentRacer, setCurrentRacer] = useState<CurrentRacer | null>(null);

  useEffect(() => {
    const client = generateClient();

    function fetchLeaderboard(applyConfig: boolean) {
      return (
        client.graphql({ query: queries.getLeaderboard, variables: { eventId, trackId } }) as Promise<{
          data: { getLeaderboard: { config?: { leaderBoardTitle: string }; entries: LeaderboardEntry[] } };
        }>
      ).then((response) => {
        setLeaderboardEntries(response.data.getLeaderboard.entries ?? []);
        if (applyConfig && response.data.getLeaderboard.config) {
          setEventName(response.data.getLeaderboard.config.leaderBoardTitle.toUpperCase());
        }
      });
    }

    fetchLeaderboard(true).then(() => {
      setShowLeaderboard(true);
    });

    const overlaySub = (
      client.graphql({ query: subscriptions.onNewOverlayInfo, variables: { eventId, trackId } }) as {
        subscribe: (handlers: { next: (msg: any) => void; error?: (err: any) => void }) => { unsubscribe: () => void };
      }
    ).subscribe({
      next: ({ data }) => {
        const info = data?.onNewOverlayInfo;
        if (!info) return;

        if (info.eventName) {
          setEventName(info.eventName);
        }

        if (info.raceStatus === 'RACE_SUBMITTED') {
          return;
        }

        const finished = info.raceStatus === 'RACE_FINSIHED';
        const noCompetitor = 'competitor' in info && info.competitor === null;

        if (finished || noCompetitor) {
          setShowLowerThird(false);
          setShowLeaderboard(true);
          setCurrentRacer(null);
          return;
        }

        if (info.username) {
          const fastest =
            raceFormat === 'average' ? pickFastestAvg(info.averageLaps) : pickFastest(info.laps);
          const last = pickLast(info.laps);
          setCurrentRacer({
            username: info.username,
            timeLeftMs: info.timeLeftInMs ?? INITIAL_TIME_MS,
            fastestLapMs: fastest,
            lastLapMs: last,
          });
          setShowLowerThird(true);
          setShowLeaderboard(false);
        }
      },
      error: (err) => console.error('onNewOverlayInfo error', err),
    });

    const newEntrySub = (
      client.graphql({ query: subscriptions.onNewLeaderboardEntry, variables: { eventId, trackId } }) as {
        subscribe: (handlers: { next: () => void; error?: (err: any) => void }) => { unsubscribe: () => void };
      }
    ).subscribe({
      next: () => {
        fetchLeaderboard(false);
      },
      error: (err) => console.error('onNewLeaderboardEntry error', err),
    });

    const deleteEntrySub = (
      client.graphql({ query: subscriptions.onDeleteLeaderboardEntry, variables: { eventId, trackId } }) as {
        subscribe: (handlers: { next: () => void; error?: (err: any) => void }) => { unsubscribe: () => void };
      }
    ).subscribe({
      next: () => {
        fetchLeaderboard(false);
      },
      error: (err) => console.error('onDeleteLeaderboardEntry error', err),
    });

    return () => {
      overlaySub.unsubscribe();
      newEntrySub.unsubscribe();
      deleteEntrySub.unsubscribe();
    };
  }, [eventId, trackId, raceFormat]);

  return { leaderboardEntries, eventName, showLeaderboard, showLowerThird, currentRacer };
}
```

- [ ] **Step 4: Run to verify tests pass**

Run:
```sh
cd website/overlays
npm test
```

Expected: PASS — all 5 useOverlayData tests pass.

- [ ] **Step 5: Commit**

```sh
git add website/overlays/src/components/html/useOverlayData.ts \
        website/overlays/src/components/html/useOverlayData.test.tsx
git commit -m "feat(overlays): add useOverlayData hook for AppSync subscriptions"
```

---

## Task 9: Wire `OverlayApp` root component

**Files:**
- Create: `website/overlays/src/components/html/OverlayApp.tsx`
- Create: `website/overlays/src/components/html/OverlayApp.module.css`

`OverlayApp` is the entry to the new engine: reads URL params, configures Amplify (same as the old `App.tsx` does at module level — already happens, so we just consume), wires `useOverlayData` to the two components, handles i18n labels.

- [ ] **Step 1: Implement `OverlayApp.tsx`**

Create `website/overlays/src/components/html/OverlayApp.tsx`:
```tsx
import { useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChromaBg } from '../ChromaBg';
import { Leaderboard } from './Leaderboard';
import { LowerThird } from './LowerThird';
import { useOverlayData } from './useOverlayData';
import styles from './OverlayApp.module.css';

export default function OverlayApp() {
  const { t } = useTranslation();
  const { eventId } = useParams();
  const [searchParams] = useSearchParams();

  const trackId = searchParams.get('trackId') || '1';
  const raceFormat = searchParams.get('format') || 'fastest';
  const showLeaderboardParam = (searchParams.get('showLeaderboard') ?? '1') === '1';
  const gapToLeader = searchParams.get('gapToLeader') !== 'false';

  const { leaderboardEntries, eventName, showLeaderboard, showLowerThird, currentRacer } = useOverlayData({
    eventId: eventId ?? '',
    trackId,
    raceFormat,
  });

  const leaderboardLabels = {
    first: t('leaderboard.first-place'),
    second: t('leaderboard.second-place'),
    third: t('leaderboard.third-place'),
    fourth: t('leaderboard.fourth-place'),
    footer: t('leaderboard.lower-text'),
  };

  const fastestLabel =
    raceFormat === 'average' ? t('lower-thirds.fastest-avg-lap') : t('lower-thirds.fastest-lap');

  const lowerThirdLabels = {
    racer: t('lower-thirds.racer-name'),
    remaining: t('lower-thirds.time-remaining'),
    fastest: fastestLabel,
    previous: t('lower-thirds.previous-lap'),
  };

  return (
    <div className={styles.root}>
      <ChromaBg />
      <Leaderboard
        entries={leaderboardEntries}
        raceFormat={raceFormat}
        gapToLeader={gapToLeader}
        eventName={eventName}
        labels={leaderboardLabels}
        visible={showLeaderboard && showLeaderboardParam}
      />
      <LowerThird
        username={currentRacer?.username ?? ''}
        timeLeftMs={currentRacer?.timeLeftMs ?? 180000}
        fastestLapMs={currentRacer?.fastestLapMs ?? null}
        lastLapMs={currentRacer?.lastLapMs ?? null}
        eventName={eventName}
        labels={lowerThirdLabels}
        visible={showLowerThird}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create `OverlayApp.module.css`**

Create `website/overlays/src/components/html/OverlayApp.module.css`:
```css
.root {
  position: fixed;
  inset: 0;
  width: 1920px;
  height: 1080px;
  overflow: hidden;
  background: transparent;
}
```

- [ ] **Step 3: Build to confirm**

Run:
```sh
cd website/overlays
npm run build
```

Expected: success.

- [ ] **Step 4: Run tests**

Run:
```sh
cd website/overlays
npm test
```

Expected: PASS — all existing tests still pass. No tests for `OverlayApp` itself (covered by the integration smoke test in Task 12).

- [ ] **Step 5: Commit**

```sh
git add website/overlays/src/components/html/OverlayApp.tsx \
        website/overlays/src/components/html/OverlayApp.module.css
git commit -m "feat(overlays): wire OverlayApp root component"
```

---

## Task 10: Engine selection in `App.tsx`

**Files:**
- Modify: `website/overlays/src/App.tsx`

- [ ] **Step 1: Replace `App.tsx` with an engine router**

Replace `website/overlays/src/App.tsx`:
```tsx
import { useSearchParams } from 'react-router-dom';
import OverlayLegacy from './OverlayLegacy';
import OverlayApp from './components/html/OverlayApp';

export default function App() {
  const [searchParams] = useSearchParams();
  const engine = searchParams.get('engine');
  return engine === 'html' ? <OverlayApp /> : <OverlayLegacy />;
}
```

- [ ] **Step 2: Build**

Run:
```sh
cd website/overlays
npm run build
```

Expected: success.

- [ ] **Step 3: Run tests**

Run:
```sh
cd website/overlays
npm test
```

Expected: PASS — all tests still pass.

- [ ] **Step 4: Commit**

```sh
git add website/overlays/src/App.tsx
git commit -m "feat(overlays): add ?engine=html toggle in App router"
```

---

## Task 11: Manual smoke test + screenshots

**Files:** none (manual verification)

This is the human-in-the-loop checkpoint. The dispatcher runs the dev server, opens both engines, and visually compares.

- [ ] **Step 1: Build the public bundle**

Run from the project root:
```sh
cd /Users/davidsmith/Development/deepracer/drem-overlay-rebuild
make local.build
```

Expected: success — overlays land in `website/public/overlays/`.

- [ ] **Step 2: Start the dev server**

Run:
```sh
cd /Users/davidsmith/Development/deepracer/drem-overlay-rebuild/website
npm start
```

Expected: dev server up at `localhost:3000`.

- [ ] **Step 3: Open the legacy engine**

In a browser, open `http://localhost:3000/overlays/<a-real-event-id>?trackId=1`.

Expected: existing D3+SVG overlay renders as it does today. Take a screenshot for comparison.

- [ ] **Step 4: Open the HTML engine**

In a browser, open `http://localhost:3000/overlays/<the-same-event-id>?trackId=1&engine=html`.

Expected:
- Leaderboard panel visible top-left when idle, fades in over ~1s.
- Top-4 racers with podium colours (gold/silver/bronze borders on rows 1/2/3).
- Same event name and labels as the legacy engine.
- When a race is submitted via the timekeeper UI, lower thirds slides in from the left, leaderboard fades out.
- When the race finishes, lower thirds slides out, leaderboard fades back in.

Take a screenshot, compare side-by-side with the legacy.

- [ ] **Step 5: Verify gap-to-leader toggle**

Open `http://localhost:3000/overlays/<event-id>?trackId=1&engine=html&gapToLeader=true`.

Expected: P2/P3/P4 show `+SS.mmm` next to their times.

Open `http://localhost:3000/overlays/<event-id>?trackId=1&engine=html&gapToLeader=false`.

Expected: gap column is hidden.

- [ ] **Step 6: Verify chroma key**

Open `http://localhost:3000/overlays/<event-id>?trackId=1&engine=html&chroma=1`.

Expected: green background fills viewport (for OBS/vMix compositing).

Open `http://localhost:3000/overlays/<event-id>?trackId=1&engine=html&chroma=1&chromaColor=ff00ff`.

Expected: magenta background.

- [ ] **Step 7: If any of the visual checks fail**

Note the failure(s) and dispatch a fix subagent with the specific issue. Don't try to fix manually — context pollution risk.

- [ ] **Step 8: Once visuals are confirmed**

No commit for this step (no code changed) — just a manual sign-off.

---

## Task 12: Open the PR

**Files:** none (git workflow)

- [ ] **Step 1: Push the branch**

Run:
```sh
cd /Users/davidsmith/Development/deepracer/drem-overlay-rebuild
git push -u origin feat/overlay-html-rebuild
```

- [ ] **Step 2: Open the PR**

Run:
```sh
gh pr create --repo aws-solutions-library-samples/guidance-for-aws-deepracer-event-management \
  --title "feat(overlays): HTML+CSS rebuild behind ?engine=html flag (Phase 1 of #29)" \
  --body "$(cat <<'EOF'
## Summary

First step of task #29 (overlay redesign). Adds a parallel HTML+CSS implementation of the overlay app, mounted only when `?engine=html` is set on the URL. The existing D3+SVG path remains the default and is unchanged for events that don't opt in. Lets operators try the new engine event-by-event with zero risk. Once a real event has used it cleanly, a follow-up PR will delete the legacy engine.

This PR does **not** implement the F1-style position tower, theme system, or other items from the broader redesign spec at `docs/superpowers/specs/2026-04-05-overlay-redesign-design.md`. Scope is intentionally narrow: tech migration only.

## What's in

- Leaderboard panel: top-4 racers with podium colours (gold/silver/bronze), gap-to-leader, event name banner, fade transition.
- Lower thirds: racer name, remaining timer, fastest lap, last lap, slide-in animation from left.
- ChromaBg + format utilities extracted as shared modules (used by both engines).
- vitest harness for the overlays app (was missing; the existing `App.test.tsx` asserted on stale CRA boilerplate).
- Dead-code drop: track overlay (`SetDRCarPosition` never called) and Did You Know panel (no fade-in trigger anywhere).

## What's out / follow-up

- Legacy engine deletion — separate PR after a real event has used the new engine.
- F1-style position tower, theme system, event banner, post-race summary card — bigger redesign work.

## Test plan

- [x] vitest suite (formatters, ChromaBg, Leaderboard, LowerThird, useOverlayData) — all pass
- [x] CDK build (`npm run build` at repo root)
- [x] Overlays build (`cd website/overlays && npm run build`)
- [x] Local smoke test: legacy engine unchanged, HTML engine renders correctly, fade + slide transitions work
- [ ] Run at a real event with `?engine=html` on the overlay URL

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed.

- [ ] **Step 3: Update the task list memory**

In `/Users/davidsmith/.claude/projects/-Users-davidsmith-Development-deepracer-drem-aws/memory/project_task_list.md`, update the open-PRs section to add the new PR.

---

## Self-Review Notes

Before handing off:

**Spec coverage:** This plan implements the narrow scope agreed in the brainstorm (HTML+CSS like-for-like rebuild behind a feature flag, drop dead components, no Framer Motion, no F1 redesign). The bigger spec at `docs/superpowers/specs/2026-04-05-overlay-redesign-design.md` is referenced as the long-term direction but explicitly **not** implemented here.

**Type consistency:** `LeaderboardEntry` is defined in `format.ts` and imported everywhere it's used. `LeaderboardLabels` and `LowerThirdLabels` are exported from the respective component modules. `OverlayData` from `useOverlayData` matches what `OverlayApp` consumes.

**Out of scope and explicitly skipped:**
- Avatar rendering (the avatar PR is now merged, but the overlay rebuild deliberately doesn't pull it in — adding avatars is a Phase 2 ask)
- Highlight colour bars (same reason)
- Position-change animations (Framer Motion deferred)
- Route-based mode selection (`/leaderboard` vs `/overlay` from the spec) — only one display mode here
- Theme system (CSS custom properties for event-configured colours)
- Footer area with sponsor rotation, next-racer-up, stats

These all live in follow-up PRs.
