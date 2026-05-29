# Design: Migrate off the unmaintained `avataaars` library (website)

**Date:** 2026-05-21
**Status:** Shipped — **migration only**. The highlight-on-avatar treatment described below was
explored during QA and **dropped** (see Post-QA outcome).
**Task:** Backlog #68 — migrate off the unmaintained `avataaars` library
**Branch:** `feat/avatar-vierweb-migration`, rebased onto `upstream/main` (which now includes #239, merged 2026-05-22).

## Post-QA outcome (2026-05-22)

The library migration shipped as designed (swap to `@vierweb/avataaars`, delete the type shim — the
`UNSAFE_componentWillMount` warning is gone, avatars render identically). The **highlight-colour-on-avatar**
idea (§4, §2a, §3 below) was implemented behind QA and then **dropped**: tinting the circle washed out
for near-white palette values, and a ring/border fought `@vierweb`'s internal geometry (it pads the box
and the circle sits low inside it, so a box-level ring haloed and overlapped the label). We reverted to
the default avataaars circle. The only extra change kept is a small **TopNav avatar alignment** nudge
(`marginTop: -8px` + `translateX(-5px)`) to re-centre the 24px avatar after the library swap. A
better-fitting highlight treatment could be revisited separately.

## Problem

The `avataaars` npm package (v2.0.0, last published ~5 years ago) is unmaintained and
built on legacy React class components using deprecated lifecycle methods. Under React 18
it logs `UNSAFE_componentWillMount` / legacy-context deprecation warnings in dev whenever an
`Avatar` mounts or unmounts. This became noticeable after the #63/#64 store-refresh work made
the TopNav mini-avatar and the profile `AvatarBuilder` mount/unmount more frequently.
Production builds strip the warnings, but the dependency is a long-term liability and blocks a
future React 19 upgrade.

DREM renders avataaars avatars in two apps:

- **Main website** (`website/`) — `AvatarDisplay.tsx` (used by `TopNav` and `AvatarBuilder`).
  This is where the warnings actually bite (frequent mount/unmount).
- **Leaderboard** (`website/leaderboard/`) — three components render `<Avatar>` directly.
  Avatars here are largely static.

The overlays app does **not** use avataaars (the HTML overlay engine renders identity its own way).

## Goals

1. Eliminate the deprecated-lifecycle React warnings from the **main website** avatar rendering.
2. Keep racers' existing avatars **visually identical** — no `avatarConfig` migration, no re-builds.
3. Open the door to React 19 in future.
4. **Bonus, in scope:** surface the racer's stored `highlightColour` on the portal avatar as a visual
   identity treatment. The exact treatment — a **ring/border** around the avatar vs the circle
   **background** fill via the library's `backgroundColor` prop — is decided during implementation
   against rendered output; a border is currently preferred for legibility across the vivid
   tail-light palette.

## Non-goals (documented fast-follows)

- **Leaderboard migration.** Deferred — the leaderboard sizes avatars responsively (em/vmin) via
  `:global(svg)` CSS, which is incompatible with the replacement's fixed-pixel + `all: initial`
  model. It needs a responsive-pixel-size rework (measure wrapper → pass px) and is a separate PR.
  The leaderboard stays on `avataaars` until then (two avatar libraries coexist temporarily — acceptable).
- Applying the highlight-colour treatment on the leaderboard/overlay.
- Adopting the replacement's optional hover/idle **animations** (separate UX decision).

## Chosen approach: drop-in swap to `@vierweb/avataaars`

Replace `avataaars` with **`@vierweb/avataaars@^3.1.0`** in the website only.

### Why this library

`@vierweb/avataaars` (repo: `donnybrilliant/avataaars`, npm `@vierweb/avataaars`, latest 3.1.0
published 2025-12-30) is a maintained fork that **keeps the exact avataaars look and public API**
while fixing precisely our issue. Verified from the published source + CHANGELOG:

- *"Removed all usage of deprecated React lifecycle methods"*; *"All deprecation warnings related to
  `UNSAFE_componentWillMount` and similar lifecycle methods"* fixed.
- `Selector` converted from class to **function component**; all components use modern
  `React.createContext()` / `useContext` (replacing the legacy `childContextTypes` context that
  triggered the warnings); `React.useId()` replaces `lodash.uniqueId`; `prop-types` dropped.
- `peerDependencies: react >=18.0.0` (works on our React **^18.3.1**, and React 19).
- **MIT**, **zero runtime dependencies**, ships its own TypeScript types.
- Migration guide: *"No code changes required. All existing props and API remain the same. Fully
  backward compatible at the API level."* Our config's 11 fields are all valid props; the component
  validates option values and silently falls back to defaults for anything unrecognised.

### Alternatives considered

- **`@gschoppe/avataaars`** — also a maintained fork, but `peerDependency: react ^19.0.0` (React 19
  **only**), which would drag a framework-major upgrade into this task. Rejected.
- **A different style library** (`react-nice-avatar`, DiceBear, `@bigheads/core`) — would force a new
  visual style and a lossy/forced `avatarConfig` migration (racers' avatars reset). Rejected: we want
  to preserve existing avatars.
- **Fork avataaars ourselves and fix the lifecycle** — works, but we'd own a dead codebase forever.
  `@vierweb` already did this work and maintains it.

## Detailed changes (website only)

### 1. Dependency
`website/package.json`: remove `"avataaars": "^2.0.0"`, add `"@vierweb/avataaars": "^3.1.0"`.

### 2. `src/components/AvatarDisplay.tsx`
- Change the import: `import Avatar from 'avataaars'` → `import Avatar from '@vierweb/avataaars'`.
- Add an optional, treatment-agnostic prop `highlightColour?: string | null` to `AvatarDisplayProps`.
  AvatarDisplay owns *how* the colour is surfaced (see §2a); call sites just supply the colour.
- The existing `parseConfig` logic, `PlaceholderSilhouette` (shown when no config), `avatarStyle`
  (`'Circle' | 'Transparent'`, both accepted by `@vierweb`), and numeric `style={{width,height}}`
  pass-through are unchanged.

### 2a. Highlight-colour treatment — decided during implementation
Two options, chosen once we can see them rendered across the palette in both colour modes:
- **Ring / border (preferred):** a wrapper-level coloured ring around the avatar (e.g. `box-shadow`
  or `border` on a container AvatarDisplay owns). Independent of the library, reads well in light
  **and** dark mode, and handles vivid/near-white palette values gracefully — a thin outline works
  where a fill wouldn't.
- **Circle background fill (alternative):** pass the colour to the library's `backgroundColor` prop
  (`<Avatar backgroundColor={highlightColour || '#65C9FF'} />`). `#65C9FF` is the library default and
  the classic avataaars blue, so unset = today's look. Renders only for `avatarStyle="Circle"` (the
  portal default). Downside: the vivid tail-light palette is hard to read as a full fill (esp. `#FFFFFF`).

Leading choice is the **ring**; the final call is made against rendered output during the smoke test.

### 3. Wire `highlightColour` into the portal call sites
- `src/components/topNav.tsx:403` — read `state.userProfile?.highlightColour` (already in the store,
  alongside the existing `avatarConfig` read at line 194) and pass it as `highlightColour`.
- `src/admin/user-profile/AvatarBuilder.tsx:180` & `:214` — pass the local `highlightColour` state to
  both previews, so the builder preview updates live as the racer picks a colour.

### 4. Delete the local type shim
Remove `src/types/avataaars.d.ts` — `@vierweb/avataaars` ships its own types. Confirm `npm run build`
type-checks with the import resolving to the library's types.

### Legibility consideration
The tail-light palette (`TAIL_LIGHT_COLOURS`) is vivid and includes `#FFFFFF` and other near-white
values that read poorly as a circle **fill** — the main reason the **ring** treatment (§2a) is
preferred. Whichever treatment is chosen: apply it only when an avatar is rendered (not the grey
placeholder silhouette), consistent with the existing "highlight shown only when avatar present" rule,
and confirm contrast across the full palette in both light and dark mode during the smoke test.

## Data / compatibility

**No data migration.** The stored `custom:avatarConfig` (Cognito) and `RacerProfile.avatarConfig`
(DynamoDB) are unchanged — same field names and values. `highlightColour` is already stored and
already in the `userProfile` store; no new persistence. Backend, GraphQL schema, the EventBridge
denormalisation Lambda, and the leaderboard/overlay data path are all untouched.

## Behavioural deltas to verify (smoke test)

1. The `UNSAFE_componentWillMount` / legacy-context warning is **gone** from the dev console when
   mounting/unmounting `TopNav` and `AvatarBuilder` (the core success criterion).
2. Avatars render correctly at the portal sizes: TopNav `24px`, builder header `40px`, builder
   preview `200px`.
3. The chosen highlight-colour treatment (§2a) reflects `highlightColour`, is absent/neutral when
   unset, and is legible across the full palette in light and dark mode.
4. The AvatarBuilder preview updates live when the highlight colour is changed.
5. `@vierweb` attaches a per-avatar `MutationObserver` (to `document.documentElement` + ancestors)
   when no `maskBackgroundColor` is passed. With only ~3 portal avatars this is negligible; no action
   needed. (On the leaderboard's many rows it would matter — handled in that fast-follow by passing
   `maskBackgroundColor`.)

## Testing

- Update/extend the `AvatarDisplay` vitest: renders an `@vierweb` `Avatar` given a config, renders the
  placeholder when config is null, and passes `backgroundColor` through (falling back to `#65C9FF`).
- `npm run build` (type-check + Vite build) passes after deleting the type shim.
- `npm test` (Vitest single pass) green.

## Risks

- **Single-maintainer fork (bus factor).** Mitigated by MIT license, zero runtime deps, and small
  size — we can vendor/fork it ourselves if it ever stalls.
- **Two avatar libraries coexist** (website on `@vierweb`, leaderboard on `avataaars`) until the
  leaderboard fast-follow. Acceptable and explicitly tracked.

## Follow-ups (separate specs/PRs)

1. **Leaderboard migration** — responsive-pixel-size wrapper (measure wrapper → pass numeric px),
   replace the `:global(svg)` sizing, pass `maskBackgroundColor` to suppress the per-avatar observer.
2. **Highlight colour on leaderboard/overlay** — reconcile with the existing "gradient bar beside the
   avatar" treatment.
3. Optionally evaluate the hover/idle animation props as a UX enhancement.
