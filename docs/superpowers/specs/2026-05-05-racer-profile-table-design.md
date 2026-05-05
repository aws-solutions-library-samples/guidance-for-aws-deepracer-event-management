# Racer Profile Table — Design Spec

**Date:** 2026-05-05
**Author:** Dave Smith (with Claude assistance)
**Branch this targets:** `feat/racer-avatar` (PR #171, currently a complete rework of)
**Replaces approach in:** PR #171's Cognito-custom-attribute storage; supersedes Steve Askwith's "Option D refresh button" proposal

## Problem

PR #171 stores racer avatar configuration and highlight colour as Cognito User Pool custom attributes (`custom:avatarConfig`, `custom:highlightColour`). When a racer finishes a race, the timekeeper publish chain reads those attributes from Cognito and snapshots them into the leaderboard entry. Subsequent profile edits don't propagate to historical entries — racers updating their avatar after racing see the old avatar on past leaderboards.

Steve Askwith proposed an admin "refresh profile" mutation (Option D) to update stale entries on demand. After review, this is the wrong shape for two reasons:

1. **Cognito attribute storage has architectural costs.** A User Pool has a hard 50-custom-attribute limit, slow propagation (minutes between write and read availability), no native query support, and treats avatar JSON as a 2 KB string blob. Adding more profile fields in future (sponsor, bio, team, etc.) hits these limits fast.
2. **A refresh button papers over the symptom.** The real fix is to have a single source of truth that's read live, not snapshotted-then-refreshed.

## Goal

Replace the Cognito-attribute storage of avatar/highlight with a dedicated DynamoDB `RacerProfile` table accessed via AppSync. Leaderboard entries reference the profile live at read time rather than snapshotting. Eliminate the staleness problem without bespoke refresh tooling.

## Scope

**In scope** (move out of Cognito → into `RacerProfile`):
- `avatarConfig` (AWSJSON of avataaars config)
- `highlightColour` (string)

**Out of scope** (stay in Cognito custom attrs):
- `countryCode` — pre-dates #171, users can't change it once set, no staleness problem to solve. The `leaderboard_entry_evb` Lambda continues to snapshot it at race-time.

**Out of scope (this iteration):**
- Migration tooling. PR #171 has not been merged upstream and is only deployed in fork dev/test environments. Existing avatar/highlight data in those Cognito pools is throwaway test data; environments will be torn down and redeployed fresh.
- Live profile-update propagation during a race (`onRacerProfileUpdated` subscription). YAGNI for v1 — the leaderboard's existing polling cadence picks up profile changes on the next render.
- Future profile fields (sponsor, bio, team). Schema is small and easy to extend later.

## Architecture

### New CDK construct: `lib/constructs/racer-profile.ts`

**DynamoDB table:** `RacerProfileTable`
- Partition key: `username` (string) — matches the `username` field already used on leaderboard entries.
- Attributes: `avatarConfig` (AWSJSON), `highlightColour` (string), `updatedAt` (ISO 8601 timestamp).
- No sort key, no GSIs needed for v1.
- Point-in-time recovery on (matches the project's pattern for user-data tables).

**AppSync schema additions:**
- Type `RacerProfile { username, avatarConfig, highlightColour, updatedAt }`.
- Input `RacerProfileInput { avatarConfig, highlightColour }`.
- Mutation `updateRacerProfile(input: RacerProfileInput!): RacerProfile` — `@aws_cognito_user_pools`. The `username` is taken from the Cognito identity, not the input — users only update their own profile.
- Mutation `updateRacerProfileForUser(username: String!, input: RacerProfileInput!): RacerProfile` — `@aws_cognito_user_pools(cognito_groups: ["admin"])`. Admin override.
- Query `getRacerProfile(username: String!): RacerProfile` — `@aws_cognito_user_pools @aws_api_key`. Public read so leaderboard, overlays, and the authenticated portal all work without separate auth code paths.

**Resolvers:** AppSync direct DDB resolvers (JS resolvers, not Lambda). The CRUD shape is simple enough that a Lambda would be unnecessary indirection. Lambda can be revisited if validation needs grow.

### Removed from `lib/constructs/idp.ts`
- `custom:avatarConfig`
- `custom:highlightColour`

### Kept in `lib/constructs/idp.ts`
- `custom:countryCode`

### Leaderboard live-join

Add `profile: RacerProfile` field on the existing `LeaderBoardEntry` GraphQL type. Resolved by an AppSync pipeline resolver that:
1. Returns the leaderboard entry (existing logic).
2. For each entry, runs a DDB GetItem on `RacerProfileTable` keyed by `entry.username`.
3. Inlines the result as `entry.profile`.

Same `profile` field on subscription payloads (`onNewLeaderboardEntry`, `onUpdateLeaderboardEntry`) so live race updates carry profile data inline — no second round-trip from subscriber clients.

### Removed from `LeaderBoardEntry` type and table
- `avatarConfig` column drops.
- `highlightColour` column drops.
- `countryCode` stays (still snapshotted at race-time from Cognito, since users can't change it).

### Simplified `lib/lambdas/leaderboard_entry_evb/`
- No longer reads `custom:avatarConfig` / `custom:highlightColour` from Cognito.
- Continues to read `username` and `custom:countryCode`.
- Mutation strings drop the avatar/highlight variables.

## Data flow

### Profile update (user editing own avatar)
1. User opens profile page; `AvatarBuilder.tsx` calls `getRacerProfile(identity.username)` on mount.
2. User edits avatar, clicks save.
3. Frontend calls `updateRacerProfile({ avatarConfig, highlightColour })`.
4. AppSync DDB resolver writes to `RacerProfileTable` keyed by the Cognito identity's username.
5. Mutation returns the updated record; frontend updates state from the response.

### Profile read (leaderboard render — public)
1. Browser/overlay calls `getLeaderboard(eventId, trackId)` over API key.
2. AppSync resolves entries; pipeline resolver runs DDB GetItem per entry on `RacerProfileTable`.
3. Single GraphQL response returns entries with `profile` inlined. Browser renders avatars from `entry.profile.avatarConfig`.

### Profile read (top nav mini avatar)
1. On mount, top nav calls `getRacerProfile(identity.username)` over Cognito auth.
2. Caches result in component state.
3. Falls back to silhouette (Steve's `AvatarDisplay` component) when no profile exists.

### Race-time entry creation (timekeeper finishes a race)
1. Same as today — `leaderboard_entry_evb` Lambda triggered.
2. Lambda reads Cognito for `username` and `custom:countryCode` only.
3. Writes leaderboard entry with `username`, `countryCode`, race data. No avatar/highlight fields.
4. Subscription fires; subscribers' clients receive the new entry; `profile` field is resolved server-side via the pipeline resolver, so subscribers see the new entry's avatar inline.

### Live profile update during a race
- Not handled in v1. If a user updates their avatar mid-race, existing rendered leaderboards won't reflect it until the next leaderboard refresh. Acceptable trade-off for v1 simplicity.

## Frontend changes

### `website/src/admin/user-profile/AvatarBuilder.tsx`
- Remove the call to the user-profile mutation that wrote `custom:avatarConfig` / `custom:highlightColour` to Cognito.
- Initial load: call `getRacerProfile(identity.username)` instead of reading Cognito attrs via `getCurrentUserAttributes()`.
- Save: call `updateRacerProfile({ avatarConfig, highlightColour })`.
- Steve's UX work (preview in collapsed `ExpandableSection` header, neutral bald-yellow default config, silhouette fallback) stays unchanged — only the data source changes underneath.

### `website/src/components/AvatarDisplay.tsx` (Steve's new shared component)
- Untouched at the component level. Takes a config prop, renders. Receives data from a different upstream source.

### `website/src/components/topNav.tsx` (Steve's mini-avatar work)
- Replace the `getCurrentUserAttributes()` call with `getRacerProfile(identity.username)`.
- Same `useMemo` dependency wiring.
- Same fallback to silhouette on null profile.

### `website/src/pages/timekeeper/components/racerSelector.tsx`
- Currently reads avatar/highlight from Cognito when timekeeper picks a racer; passes them into the race entry payload.
- After this rework: only reads `countryCode` (still in Cognito). Avatar/highlight don't need to be passed at race-time — they're live-joined when the leaderboard renders.
- Net simplification — fewer fields in the publish payload.

### `website/leaderboard/` and `website/overlays/`
- GraphQL queries/subscriptions get a new `profile { avatarConfig, highlightColour }` block on `LeaderBoardEntry`.
- Existing render code that reads `entry.avatarConfig` / `entry.highlightColour` becomes `entry.profile?.avatarConfig` / `entry.profile?.highlightColour`. Mechanical rename.
- Both apps' codegen regenerates against the new schema.

### `website/src/hooks/useAuth.ts`
- The avatar/highlight fields exposed via `useAuth()` change source: were Cognito-attr-derived, become `getRacerProfile`-query-derived. Same shape externally; consumers don't change.

## Testing

- New `lib/constructs/racer-profile.test.ts`: assertion-style test (matching the existing `deepracer-event-manager.test.ts` pattern) that the construct creates a DDB table with the right key shape and the AppSync types/resolvers attach to the API.
- Update `LeaderBoardEntry` snapshot/assertion tests if any reference `avatarConfig`/`highlightColour` directly on the entry — they now live under `entry.profile`.
- Frontend: existing tests for `AvatarBuilder.tsx` get their mocks updated (mock `updateRacerProfile` mutation instead of the Cognito-attr update path).
- No new Lambda → no new Lambda unit tests for v1.

## Error handling

### Leaderboard live-join failure modes
- **Profile not found** (user has never set one): pipeline resolver returns `profile: null`. `AvatarDisplay` already falls back to the silhouette. No extra handling needed.
- **DDB GetItem error** (transient): pipeline resolver returns `profile: null` with a partial-error in the GraphQL response. Leaderboard renders affected rows with silhouettes. Visible in client error logs; not silent.
- **DDB outage**: leaderboard query fails for the affected entries. Acceptable — DDB outages are rare and brief; users see an error and retry, no recovery logic needed at the resolver level.

### Profile update failure
- Mutation errors surface to the AvatarBuilder save handler, which already shows a CloudScape error notification. No new UX needed.

## Migration

PR #171 has not been merged upstream and is only deployed in fork dev/test environments. Avatar and highlight data in those Cognito pools is throwaway test data.

**Removing `custom:avatarConfig` and `custom:highlightColour` from `lib/constructs/idp.ts` will fail CFN deploy** on any User Pool that has those attributes defined — Cognito rejects custom-attribute removal even when no users have data set.

Approach: tear down and redeploy any environment with #171 deployed. Concretely: `make drem.clean` + `make pipeline.deploy` in dev/test accounts. Since #171 is only in Dave's dev/test accounts, blast radius is small.

## Branch hygiene

Current `feat/racer-avatar` has 8 commits ahead of main:
- `834e260`, `021ab49`, `31147a4`, `739e57c` — feature commits
- `8979b23`, `2163a7c` — original Docker/pipeline fixes
- `5a7a923` — Steve's WebsiteTests/PostDeployTests `--legacy-peer-deps` and approval-gate fixes
- `b5b2eaf` — Steve's UX commit (preview in header, silhouette default, mini avatar in nav)
- `219fa56` — rebase-artefact fix for the Dockerfile FROM line

Approach: **reset and rebuild**. `git reset --hard main` on `feat/racer-avatar`, then build the new design from scratch as ~6 fresh commits:
1. RacerProfile CDK construct + AppSync schema + tests
2. Remove `custom:avatarConfig` / `custom:highlightColour` from idp.ts
3. Leaderboard pipeline-resolver join + remove `avatarConfig`/`highlightColour` from `LeaderBoardEntry` type
4. Simplify `leaderboard_entry_evb` Lambda
5. Frontend rework — AvatarBuilder, useAuth, timekeeper racerSelector, leaderboard/overlays codegen
6. Cherry-pick Steve's UX commit (`b5b2eaf`) on top, with the data-source swap applied

Pipeline test fixes from `5a7a923` (`--legacy-peer-deps` in WebsiteTests / PostDeployTests, approval-gate dependency) belong in their own commit on top — they're independent of the data-model change.

## Out of scope (explicit non-goals)

- Migration tooling for production data. None exists.
- Live profile-update subscriptions (`onRacerProfileUpdated`). Future enhancement.
- Schema extensibility beyond the current 3 fields. The `RacerProfileInput` type is small and easy to extend in a future iteration.
- Removing `custom:countryCode` from Cognito. Stays where it is.

## Success criteria

- `make test.cdk` passes; new construct test green.
- `make test.leaderboard` passes; existing tests updated to reference `entry.profile.*`.
- Local dev: profile page round-trip works (load → edit → save → reload shows persisted values).
- Local dev: leaderboard render shows avatar inline from a live join, no `avatarConfig` columns on the entry table.
- Pipeline deploy to a fresh DREM environment goes green.
- After deploy, a user editing their avatar sees the change reflected on their existing leaderboard entries on the next render — no refresh button, no admin intervention.
