# avataaars → @vierweb/avataaars Migration (website) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Post-QA update (2026-05-22):** Shipped as **migration only**. The `highlightColour`-on-avatar work (Tasks 2–3 + the Task 4 treatment) was implemented, QA'd, and **dropped** — the circle fill washed out for near-white palette colours and a ring fought `@vierweb`'s geometry. Reverted to the default avatar; kept only a small TopNav alignment nudge (`marginTop: -8px` + `translateX(-5px)`). Tasks 2–4 below are retained as a record of what was explored.

**Goal:** Replace the unmaintained `avataaars` library with the maintained `@vierweb/avataaars` fork in the **main website**, eliminating the React 18 deprecated-lifecycle warnings while keeping racers' avatars visually identical.

**Architecture:** `@vierweb/avataaars` is an API-compatible, functional-component rewrite (React ≥18, MIT, zero runtime deps, ships TS types). The migration is a dependency swap + import change + delete of a now-redundant type shim. A new pure helper resolves the highlight colour (with a default fallback) and is passed to the library's `backgroundColor` prop as the **baseline** circle treatment; the final visual treatment (background fill vs ring) is confirmed at a manual visual checkpoint, per the spec.

**Tech Stack:** React 18.3, TypeScript, Vite, Vitest (node env, `.test.ts` pure-function unit tests), CloudScape, Amplify.

**Spec:** `docs/superpowers/specs/2026-05-21-avataaars-migration-design.md`

**Branch / base:** `feat/avatar-vierweb-migration`, **stacked on `feat/store-refresh-hygiene` (#239)**. The `highlightColour` wiring depends on the `userProfile` store introduced in #239 (absent on `upstream/main`). This branch already contains the design-spec commit. Merges after #239.

**Out of scope (documented fast-follows, NOT in this plan):** the leaderboard migration (needs a responsive-pixel-size rework) and the highlight treatment on leaderboard/overlay.

---

## File structure

| File | Action | Responsibility |
|------|--------|----------------|
| `website/package.json` | Modify | Swap the avatar dependency. |
| `website/src/components/AvatarDisplay.tsx` | Modify | Import from the new library; accept `highlightColour`; pass circle background. |
| `website/src/components/avatarHighlight.ts` | Create | Pure helper: resolve effective circle background colour (default fallback). |
| `website/src/components/avatarHighlight.test.ts` | Create | Unit test for the helper (node env, matches `src/**/*.test.ts`). |
| `website/src/types/avataaars.d.ts` | Delete | Redundant — the new library ships its own types. |
| `website/src/components/topNav.tsx` | Modify | Pass the stored `highlightColour` to the mini-avatar. |
| `website/src/admin/user-profile/AvatarBuilder.tsx` | Modify | Pass `highlightColour` to both preview avatars (live feedback). |

> **Testing note:** the website `vitest.config.ts` runs `environment: 'node'` and includes only `src/**/*.test.ts` — there is **no** component/DOM test infrastructure, and all existing tests are pure-function unit tests. This plan follows that pattern: unit-test the new pure helper, and gate the rendering/import change with `npm run build` (type-check + Vite build) + the existing test suite + a manual visual smoke check. Introducing jsdom component tests is intentionally out of scope.

---

## Task 1: Swap the library (core migration, no behaviour change)

Avatars must look **identical** after this task; only the implementation changes. This task is independently shippable.

**Files:**
- Modify: `website/package.json` (the `"avataaars"` dependency line)
- Modify: `website/src/components/AvatarDisplay.tsx:1` (the import)
- Delete: `website/src/types/avataaars.d.ts`

- [ ] **Step 1: Swap the dependency in `website/package.json`**

Find the line in `dependencies`:

```json
    "avataaars": "^2.0.0",
```

Replace it with:

```json
    "@vierweb/avataaars": "^3.1.0",
```

- [ ] **Step 2: Install**

Run (from `website/`): `npm install`
Expected: installs `@vierweb/avataaars`, removes `avataaars`. (`package-lock.json` is gitignored, so no lock file to commit.)

- [ ] **Step 3: Update the import in `AvatarDisplay.tsx`**

Change line 1 from:

```tsx
import Avatar from 'avataaars';
```

to:

```tsx
import Avatar from '@vierweb/avataaars';
```

Make no other changes in this file in this task. The existing props pass-through (`avatarStyle`, numeric `style={{ width, height }}`, spread config) and `PlaceholderSilhouette` are all API-compatible with the new library.

- [ ] **Step 4: Delete the now-redundant type shim**

Run (from `website/`): `git rm src/types/avataaars.d.ts`
The new library ships its own TypeScript types, so this `declare module 'avataaars'` shim is no longer needed (and no longer matches the import).

- [ ] **Step 5: Type-check + build**

Run (from `website/`): `npm run build`
Expected: PASS — TypeScript resolves `@vierweb/avataaars`'s bundled types; Vite build succeeds. If it fails with "Cannot find module '@vierweb/avataaars' or its corresponding type declarations", re-run `npm install` and confirm the package name is exactly `@vierweb/avataaars`.

- [ ] **Step 6: Run the existing test suite (regression gate)**

Run (from `website/`): `npm test`
Expected: PASS — all existing unit tests still green (none touch avatars; this confirms no collateral breakage).

- [ ] **Step 7: Manual smoke — avatars render + warning gone**

Run (from `website/`): `npm start`, open `http://localhost:3000`, sign in.
Verify:
- The TopNav mini-avatar and the profile **AvatarBuilder** preview render (avatar for a configured user, grey silhouette otherwise) and look the same as before.
- Open the browser dev console, navigate so `AvatarBuilder`/`TopNav` mount and unmount (e.g. to the profile page and back). **Confirm there is no `Warning: ... UNSAFE_componentWillMount` / legacy-context deprecation warning** — this is the core success criterion.

- [ ] **Step 8: Commit**

```bash
git add website/package.json website/src/components/AvatarDisplay.tsx
git rm --cached website/src/types/avataaars.d.ts 2>/dev/null; git add -A website/src/types
git commit -m "refactor(avatar): migrate website to @vierweb/avataaars (#68)

Drop-in swap of the unmaintained avataaars lib for the maintained
@vierweb/avataaars fork (React 18+, functional components, deprecated
lifecycle removed). Avatars render identically; no avatarConfig change.
Delete the now-redundant avataaars type shim."
```

---

## Task 2: Resolve + apply the highlight colour (baseline: circle background)

Add a pure helper for the highlight colour and pass it to the avatar's `backgroundColor`. This is the **baseline** treatment; the visual checkpoint (Task 4) confirms it or flags a switch to a ring.

**Files:**
- Create: `website/src/components/avatarHighlight.ts`
- Test: `website/src/components/avatarHighlight.test.ts`
- Modify: `website/src/components/AvatarDisplay.tsx`

- [ ] **Step 1: Write the failing test**

Create `website/src/components/avatarHighlight.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { effectiveCircleBackground, DEFAULT_CIRCLE_BACKGROUND } from './avatarHighlight';

describe('effectiveCircleBackground', () => {
  it('falls back to the default when no colour is provided', () => {
    expect(effectiveCircleBackground(undefined)).toBe(DEFAULT_CIRCLE_BACKGROUND);
    expect(effectiveCircleBackground(null)).toBe(DEFAULT_CIRCLE_BACKGROUND);
  });

  it('falls back to the default for empty or whitespace-only input', () => {
    expect(effectiveCircleBackground('')).toBe(DEFAULT_CIRCLE_BACKGROUND);
    expect(effectiveCircleBackground('   ')).toBe(DEFAULT_CIRCLE_BACKGROUND);
  });

  it('returns the highlight colour when set', () => {
    expect(effectiveCircleBackground('#FF0000')).toBe('#FF0000');
  });

  it('trims surrounding whitespace', () => {
    expect(effectiveCircleBackground('  #00FF00  ')).toBe('#00FF00');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `website/`): `npx vitest run src/components/avatarHighlight.test.ts`
Expected: FAIL — `Cannot find module './avatarHighlight'`.

- [ ] **Step 3: Implement the helper**

Create `website/src/components/avatarHighlight.ts`:

```ts
/**
 * The classic avataaars circle background (pale blue). Matches the
 * @vierweb/avataaars default, so an avatar with no highlight colour looks
 * exactly as it did before this feature.
 */
export const DEFAULT_CIRCLE_BACKGROUND = '#65C9FF';

/**
 * Resolve the colour to use for the avatar's circle background.
 * Returns the racer's highlight colour when set (non-empty), else the default.
 */
export function effectiveCircleBackground(highlightColour?: string | null): string {
  const trimmed = highlightColour?.trim();
  return trimmed ? trimmed : DEFAULT_CIRCLE_BACKGROUND;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run (from `website/`): `npx vitest run src/components/avatarHighlight.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Add the `highlightColour` prop to `AvatarDisplay` and pass the background**

In `website/src/components/AvatarDisplay.tsx`:

Add the import after the `Avatar` import:

```tsx
import { effectiveCircleBackground } from './avatarHighlight';
```

Add the prop to `AvatarDisplayProps` (after `avatarStyle`):

```tsx
  /** Racer highlight colour (hex). Tints the avatar's circle background; falls back to the default. */
  highlightColour?: string | null;
```

Add `highlightColour` to the destructured params:

```tsx
export const AvatarDisplay: React.FC<AvatarDisplayProps> = ({
  avatarConfig,
  size = 40,
  avatarStyle = 'Circle',
  highlightColour,
}) => {
```

In the `return` that renders the `Avatar` (the non-placeholder branch), add the `backgroundColor` prop **after** the config spread so it cannot be overridden:

```tsx
  return (
    <Avatar
      avatarStyle={avatarStyle}
      style={{ width: size, height: size }}
      {...(parsed as Record<string, string>)}
      backgroundColor={effectiveCircleBackground(highlightColour)}
    />
  );
```

(The placeholder silhouette branch is unchanged — the highlight colour applies only when an avatar is rendered.)

- [ ] **Step 6: Type-check + build**

Run (from `website/`): `npm run build`
Expected: PASS.

- [ ] **Step 7: Run the test suite**

Run (from `website/`): `npm test`
Expected: PASS (existing tests + the 4 new helper tests).

- [ ] **Step 8: Commit**

```bash
git add website/src/components/avatarHighlight.ts website/src/components/avatarHighlight.test.ts website/src/components/AvatarDisplay.tsx
git commit -m "feat(avatar): tint avatar circle with racer highlightColour (#68)

AvatarDisplay accepts an optional highlightColour and passes it to the
@vierweb backgroundColor prop (default #65C9FF when unset). Baseline
treatment pending the visual checkpoint."
```

---

## Task 3: Wire `highlightColour` into the portal call sites

The `userProfile` store (from #239) already carries `highlightColour`; pass it to the avatars.

**Files:**
- Modify: `website/src/components/topNav.tsx` (~line 194 and ~line 403)
- Modify: `website/src/admin/user-profile/AvatarBuilder.tsx` (line 180 and line 214)

- [ ] **Step 1: TopNav — read the stored highlight colour**

In `website/src/components/topNav.tsx`, just after line 194:

```tsx
  const userAvatarConfig = state.userProfile?.avatarConfig ?? null;
```

add:

```tsx
  const userHighlightColour = state.userProfile?.highlightColour ?? null;
```

- [ ] **Step 2: TopNav — pass it to the mini-avatar**

Change the `AvatarDisplay` usage (line ~403) from:

```tsx
            <AvatarDisplay avatarConfig={userAvatarConfig} size={24} />
```

to:

```tsx
            <AvatarDisplay avatarConfig={userAvatarConfig} highlightColour={userHighlightColour} size={24} />
```

- [ ] **Step 3: AvatarBuilder — header preview**

In `website/src/admin/user-profile/AvatarBuilder.tsx`, change the header preview (line ~180) from:

```tsx
            <AvatarDisplay
                avatarConfig={isConfigured ? (config as unknown as Record<string, string>) : null}
                size={40}
            />
```

to:

```tsx
            <AvatarDisplay
                avatarConfig={isConfigured ? (config as unknown as Record<string, string>) : null}
                highlightColour={highlightColour || null}
                size={40}
            />
```

- [ ] **Step 4: AvatarBuilder — large preview**

Change the large preview (line ~214) from:

```tsx
                        <AvatarDisplay
                            avatarConfig={config as unknown as Record<string, string>}
                            size={200}
                        />
```

to:

```tsx
                        <AvatarDisplay
                            avatarConfig={config as unknown as Record<string, string>}
                            highlightColour={highlightColour || null}
                            size={200}
                        />
```

(`highlightColour` is already local component state in `AvatarBuilder`, set from the store/profile and updated by the colour picker — so the preview updates live.)

- [ ] **Step 5: Type-check + build**

Run (from `website/`): `npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add website/src/components/topNav.tsx website/src/admin/user-profile/AvatarBuilder.tsx
git commit -m "feat(avatar): pass highlightColour to portal avatars (#68)

TopNav reads the stored highlightColour; AvatarBuilder passes its
highlightColour to both previews for live feedback."
```

---

## Task 4: Visual checkpoint + treatment decision

Manual verification (no unit test). This is the deliberate "look at it" moment for the highlight treatment per the spec.

**Files:** none unless the treatment changes (see decision step).

- [ ] **Step 1: Run the app**

Run (from `website/`): `npm start`, open `http://localhost:3000`, sign in.

- [ ] **Step 2: Verify the highlight background + live feedback**

On the profile page, pick highlight colours in the AvatarBuilder. Confirm:
- The large preview and the collapsed header preview update **live** as the colour changes.
- The TopNav mini-avatar reflects the saved colour.
- With no highlight colour set, the circle is the default `#65C9FF` (unchanged from today).

- [ ] **Step 3: Legibility across the palette in light AND dark mode**

Cycle through palette extremes — at minimum `#FFFFFF` (white), `#FFFF00` (yellow), `#FF0000` (red) — and toggle dark mode via the TopNav settings. Judge whether the circle-background fill is legible at all three sizes (24px TopNav, 40px header, 200px preview). Note especially whether near-white fills (`#FFFFFF`) read acceptably.

- [ ] **Step 4: Re-confirm the lifecycle warning is gone**

With the dev console open, mount/unmount `TopNav` + `AvatarBuilder` (navigate around). Confirm **no** `UNSAFE_componentWillMount` / legacy-context deprecation warnings.

- [ ] **Step 5: Treatment decision**

Decide with the reviewer:
- **If the background fill reads well** across the palette in both modes → keep it. Done; no code change.
- **If it reads poorly** (e.g. white/very-light fills wash out) → the background fill is rejected in favour of a **ring/border** treatment. A correct ring needs to align to the avatar's bottom-anchored circle geometry and needs visual iteration, so capture it as a **fast-follow** task (a small ring-treatment spec) rather than forcing it here. Record the decision in the spec's follow-ups and the project task list.

- [ ] **Step 6: Commit (only if a tweak was made)**

If Step 3–5 produced a small adjustment (e.g. clamping a near-white value to the default), commit it:

```bash
git add website/src/components/avatarHighlight.ts website/src/components/avatarHighlight.test.ts
git commit -m "fix(avatar): keep highlight circle legible across palette (#68)"
```

Otherwise no commit.

---

## Self-Review

**Spec coverage:**
- Dependency swap to `@vierweb/avataaars@^3.1.0` → Task 1. ✓
- Import change in `AvatarDisplay.tsx` → Task 1 Step 3. ✓
- Delete `avataaars.d.ts` type shim → Task 1 Step 4. ✓
- No `avatarConfig` / data migration → nothing changes the stored config; not touched anywhere. ✓
- `highlightColour` prop on `AvatarDisplay` (treatment-agnostic) → Task 2 Step 5. ✓
- Treatment options (background vs ring) + decision deferred to rendered output → baseline background in Task 2; decision at Task 4 Step 5. ✓
- Wire `highlightColour` from TopNav + AvatarBuilder (live preview) → Task 3. ✓
- Legibility across palette in light/dark; "only when avatar present" → Task 4 Step 3 + Task 2 Step 5 (placeholder branch untouched). ✓
- Smoke criterion: `UNSAFE_componentWillMount` warning gone → Task 1 Step 7 + Task 4 Step 4. ✓
- Build/type-check + existing suite as regression gate → Tasks 1/2/3. ✓
- Leaderboard out of scope → stated in header; no leaderboard tasks. ✓

**Placeholder scan:** No "TBD/TODO/handle edge cases" placeholders. The one deferred decision (ring vs background) is an explicit, justified checkpoint with a concrete baseline already implemented — not an unfinished step. Each code step contains complete code.

**Type/name consistency:** `effectiveCircleBackground(highlightColour?: string | null): string` and `DEFAULT_CIRCLE_BACKGROUND` are defined in Task 2 Step 3 and used consistently in the test (Step 1) and `AvatarDisplay` (Step 5). The `highlightColour?: string | null` prop name matches across `AvatarDisplay`, TopNav (`userHighlightColour`), and AvatarBuilder (`highlightColour || null`). The `backgroundColor` prop name matches `@vierweb/avataaars`'s API (verified in its source).
