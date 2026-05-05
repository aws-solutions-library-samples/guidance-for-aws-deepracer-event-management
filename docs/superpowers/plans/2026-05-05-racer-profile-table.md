# RacerProfile Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace PR #171's Cognito-attribute storage of avatar/highlight with a dedicated DynamoDB `RacerProfile` table, accessed via AppSync, live-joined onto leaderboard entries — eliminating the staleness problem that motivated Steve's "Option D refresh button" proposal.

**Architecture:** New CDK construct `lib/constructs/racer-profile.ts` creates a DDB table keyed by `username`, AppSync types/mutations/query with direct DDB JS resolvers (no Lambda). Leaderboard live-joins via an AppSync pipeline resolver on `LeaderBoardEntry.profile`. Cognito custom attrs `custom:avatarConfig` and `custom:highlightColour` are removed; `custom:countryCode` stays (still snapshotted at race-time).

**Tech Stack:** AWS CDK (TypeScript), `awscdk-appsync-utils` for code-first AppSync schema, DynamoDB direct resolvers (JS, AppSync runtime APPSYNC_JS), React 18 + Vite + vitest for frontend, Python 3.12 Lambdas with AWS Lambda Powertools.

**Spec:** `docs/superpowers/specs/2026-05-05-racer-profile-table-design.md`

---

## File Structure

| File | Responsibility | New / Modified |
|---|---|---|
| `lib/constructs/racer-profile.ts` | DDB table + AppSync types + direct DDB resolvers | New |
| `lib/constructs/racer-profile.test.ts` | CDK assertion test for the construct | New |
| `lib/drem-app-stack.ts` | Instantiate `RacerProfile` construct | Modified |
| `lib/constructs/idp.ts` | Drop `custom:avatarConfig`, `custom:highlightColour` (keep `custom:countryCode`) | Modified |
| `lib/constructs/leaderboard.ts` | Drop `avatarConfig`/`highlightColour` from `LeaderBoardEntry`; add `profile: RacerProfile` field with pipeline-resolver join; same on subscriptions | Modified |
| `lib/lambdas/leaderboard_entry_evb/index.py` | Stop reading avatar/highlight from Cognito; simplify mutation strings | Modified |
| `lib/lambdas/users_function/index.py` | Drop `avatarConfig`/`highlightColour` from `update_user_profile` | Modified |
| `website/src/admin/user-profile/AvatarBuilder.tsx` | Switch to `getRacerProfile`/`updateRacerProfile`; integrate Steve's UX (preview in collapsed header, neutral default avatar) | Modified |
| `website/src/components/AvatarDisplay.tsx` | Steve's shared component (silhouette fallback) | New |
| `website/src/components/topNav.tsx` | Mini avatar from `getRacerProfile` (replaces user-profile icon) | Modified |
| `website/src/types/avataaars.d.ts` | TS declarations for the avataaars library | New |
| `website/src/hooks/useAuth.ts` | Switch source from Cognito attrs to `getRacerProfile` query | Modified |
| `website/src/pages/timekeeper/components/racerSelector.tsx` | Drop avatar/highlight from publish payload (only countryCode read at race-time) | Modified |
| `website/src/pages/timekeeper/support-functions/raceDomain.ts` | Drop avatar/highlight from race domain object | Modified |
| `website/src/pages/timekeeper/support-functions/raceDomain.test.ts` | Update tests for new shape | Modified |
| `website/src/pages/timekeeper/pages/racePage.tsx`, `racePageLite.tsx`, `raceFinishPage.tsx` | Drop avatar/highlight propagation | Modified |
| `website/src/pages/timekeeper/timeKeeperWizard.tsx` | Drop avatar/highlight propagation | Modified |
| `website/src/hooks/usePublishOverlay.ts` | Drop avatar/highlight from overlay publish | Modified |
| `website/leaderboard/src/components/raceSummaryFooter.tsx` | Read avatar from `entry.profile` instead of `entry.avatarConfig` | Modified |
| `website/leaderboard/src/components/parseAvatarConfig.ts` | Untouched at function level — still parses an avataaars JSON string | Unchanged |
| `website/leaderboard/src/components/leaderboardTable.tsx` | Read avatar/highlight from `entry.profile` instead of entry root | Modified |
| `website/overlays/src/...` (TBD by codegen) | Same join pattern if overlays display avatar | Modified |
| `lib/cdk-pipeline-stack.ts` | Steve's `5a7a923` fixes (`--legacy-peer-deps` in WebsiteTests/PostDeployTests, ManualApproval depends on WebsiteTests) | Modified |

---

## Task 0: Reset branch and re-apply spec commit

**Why this exists:** The current `feat/racer-avatar` branch has 10 commits ahead of main implementing #171's Cognito-attr approach plus the spec and this plan. Per spec §Branch hygiene, we reset to main and rebuild. The spec and plan files currently live only in branch commits and would be deleted by `git reset --hard main` — copy them out first.

**Files:**
- Save: `docs/superpowers/specs/2026-05-05-racer-profile-table-design.md`
- Save: `docs/superpowers/plans/2026-05-05-racer-profile-table.md` (this file)

- [ ] **Step 1: Confirm branch state**

```bash
git checkout feat/racer-avatar
git log --oneline main..HEAD | head -12
```

Expected: 10 commits ahead of main, top two commits are `f4b3ed2 docs(plan): RacerProfile table implementation plan` and `2ae60fe docs(spec): RacerProfile DynamoDB table design`.

- [ ] **Step 2: Save backup branch and copy spec + plan out of git**

```bash
git branch backup/feat-racer-avatar-pre-rework feat/racer-avatar
cp docs/superpowers/specs/2026-05-05-racer-profile-table-design.md /tmp/racer-profile-spec.md
cp docs/superpowers/plans/2026-05-05-racer-profile-table.md /tmp/racer-profile-plan.md
```

Expected: Backup branch created. Both files copied to `/tmp`.

- [ ] **Step 3: Reset feat/racer-avatar to main**

```bash
git reset --hard main
git status
```

Expected: `Your branch is behind 'origin/feat/racer-avatar' by N commits, and can be fast-forwarded.` (We'll force-push later.) Working tree clean. Both spec and plan files now absent from working tree.

- [ ] **Step 4: Restore spec and plan from `/tmp` and stage**

```bash
mkdir -p docs/superpowers/specs docs/superpowers/plans
cp /tmp/racer-profile-spec.md docs/superpowers/specs/2026-05-05-racer-profile-table-design.md
cp /tmp/racer-profile-plan.md docs/superpowers/plans/2026-05-05-racer-profile-table.md
git add docs/superpowers/
```

- [ ] **Step 5: Commit the spec + plan as the first commit on the rebuilt branch**

```bash
git commit -m "$(cat <<'EOF'
docs(racer-profile): spec + implementation plan for the table-based rework

Replaces PR #171's Cognito-custom-attribute storage of avatar config and
highlight colour with a dedicated DynamoDB RacerProfile table accessed
via AppSync. Leaderboard live-joins profile data per entry rather than
snapshotting at race-time, eliminating the staleness problem.

- Spec: docs/superpowers/specs/2026-05-05-racer-profile-table-design.md
- Plan: docs/superpowers/plans/2026-05-05-racer-profile-table.md
EOF
)"
git log --oneline main..HEAD
```

Expected: Single new commit on top of main containing both spec and plan.

---

## Task 1: RacerProfile CDK construct + assertion test

**Files:**
- Create: `lib/constructs/racer-profile.ts`
- Create: `test/racer-profile.test.ts`

- [ ] **Step 1: Write the construct's CDK assertion test (TDD: failing test first)**

Create `test/racer-profile.test.ts`:

```typescript
import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import { CodeFirstSchema } from 'awscdk-appsync-utils';
import { RacerProfile } from '../lib/constructs/racer-profile';

const ENV = { account: '123456789012', region: 'eu-west-1' };

const makeStack = () => {
  const app = new cdk.App({ context: { 'aws:cdk:bundling-stacks': [] } });
  const stack = new cdk.Stack(app, 'TestStack', { env: ENV });
  const schema = new CodeFirstSchema();
  const api = new appsync.GraphqlApi(stack, 'TestApi', {
    name: 'TestApi',
    schema,
    authorizationConfig: {
      defaultAuthorization: { authorizationType: appsync.AuthorizationType.API_KEY },
      additionalAuthorizationModes: [
        { authorizationType: appsync.AuthorizationType.IAM },
      ],
    },
  });
  new RacerProfile(stack, 'RacerProfile', {
    appsyncApi: { api, schema, noneDataSource: api.addNoneDataSource('None') } as any,
  });
  return Template.fromStack(stack);
};

describe('RacerProfile construct', () => {
  let template: Template;
  beforeAll(() => { template = makeStack(); });

  test('creates a DynamoDB table keyed by username', () => {
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      KeySchema: [{ AttributeName: 'username', KeyType: 'HASH' }],
      AttributeDefinitions: Match.arrayWith([
        { AttributeName: 'username', AttributeType: 'S' },
      ]),
      PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
    });
  });

  test('attaches three resolvers (updateRacerProfile, updateRacerProfileForUser, getRacerProfile)', () => {
    template.resourceCountIs('AWS::AppSync::Resolver', 3);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails (no construct yet)**

```bash
npx jest test/racer-profile.test.ts -v 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module '../lib/constructs/racer-profile'`.

- [ ] **Step 3: Create the RacerProfile construct**

Create `lib/constructs/racer-profile.ts`:

```typescript
import * as cdk from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Directive, GraphqlType, InputType, ObjectType, ResolvableField } from 'awscdk-appsync-utils';
import { Construct } from 'constructs';

export interface AppsyncApiProps {
  api: appsync.GraphqlApi;
  schema: any; // CodeFirstSchema from awscdk-appsync-utils
  noneDataSource: appsync.NoneDataSource;
}

export interface RacerProfileProps {
  appsyncApi: AppsyncApiProps;
}

export class RacerProfile extends Construct {
  public readonly table: dynamodb.ITable;
  public readonly profileObjectType: ObjectType;

  constructor(scope: Construct, id: string, props: RacerProfileProps) {
    super(scope, id);

    // ----- DynamoDB table -----
    const table = new dynamodb.Table(this, 'RacerProfileTable', {
      partitionKey: { name: 'username', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    this.table = table;

    const dataSource = props.appsyncApi.api.addDynamoDbDataSource('RacerProfileDataSource', table);

    // ----- GraphQL types -----
    const profileObjectType = new ObjectType('RacerProfile', {
      definition: {
        username: GraphqlType.string({ isRequired: true }),
        avatarConfig: GraphqlType.awsJson(),
        highlightColour: GraphqlType.string(),
        updatedAt: GraphqlType.awsDateTime(),
      },
      directives: [Directive.apiKey(), Directive.iam(), Directive.cognito('admin', 'operator', 'commentator', 'racer', 'registration')],
    });
    props.appsyncApi.schema.addType(profileObjectType);
    this.profileObjectType = profileObjectType;

    const profileInputType = new InputType('RacerProfileInput', {
      definition: {
        avatarConfig: GraphqlType.awsJson(),
        highlightColour: GraphqlType.string(),
      },
    });
    props.appsyncApi.schema.addType(profileInputType);

    // ----- updateRacerProfile (own) -----
    props.appsyncApi.schema.addMutation(
      'updateRacerProfile',
      new ResolvableField({
        args: { input: profileInputType.attribute({ isRequired: true }) },
        returnType: profileObjectType.attribute(),
        dataSource,
        requestMappingTemplate: appsync.MappingTemplate.fromString(`
{
  "version": "2018-05-29",
  "operation": "UpdateItem",
  "key": {
    "username": $util.dynamodb.toDynamoDBJson($context.identity.username)
  },
  "update": {
    "expression": "SET avatarConfig = :ac, highlightColour = :hc, updatedAt = :ua",
    "expressionValues": {
      ":ac": $util.dynamodb.toDynamoDBJson($context.arguments.input.avatarConfig),
      ":hc": $util.dynamodb.toDynamoDBJson($context.arguments.input.highlightColour),
      ":ua": $util.dynamodb.toDynamoDBJson($util.time.nowISO8601())
    }
  }
}
`),
        responseMappingTemplate: appsync.MappingTemplate.fromString('$util.toJson($context.result)'),
        directives: [Directive.cognito('admin', 'operator', 'commentator', 'racer', 'registration')],
      })
    );

    // ----- updateRacerProfileForUser (admin override) -----
    props.appsyncApi.schema.addMutation(
      'updateRacerProfileForUser',
      new ResolvableField({
        args: {
          username: GraphqlType.string({ isRequired: true }),
          input: profileInputType.attribute({ isRequired: true }),
        },
        returnType: profileObjectType.attribute(),
        dataSource,
        requestMappingTemplate: appsync.MappingTemplate.fromString(`
{
  "version": "2018-05-29",
  "operation": "UpdateItem",
  "key": {
    "username": $util.dynamodb.toDynamoDBJson($context.arguments.username)
  },
  "update": {
    "expression": "SET avatarConfig = :ac, highlightColour = :hc, updatedAt = :ua",
    "expressionValues": {
      ":ac": $util.dynamodb.toDynamoDBJson($context.arguments.input.avatarConfig),
      ":hc": $util.dynamodb.toDynamoDBJson($context.arguments.input.highlightColour),
      ":ua": $util.dynamodb.toDynamoDBJson($util.time.nowISO8601())
    }
  }
}
`),
        responseMappingTemplate: appsync.MappingTemplate.fromString('$util.toJson($context.result)'),
        directives: [Directive.cognito('admin')],
      })
    );

    // ----- getRacerProfile (public) -----
    props.appsyncApi.schema.addQuery(
      'getRacerProfile',
      new ResolvableField({
        args: { username: GraphqlType.string({ isRequired: true }) },
        returnType: profileObjectType.attribute(),
        dataSource,
        requestMappingTemplate: appsync.MappingTemplate.fromString(`
{
  "version": "2018-05-29",
  "operation": "GetItem",
  "key": {
    "username": $util.dynamodb.toDynamoDBJson($context.arguments.username)
  }
}
`),
        responseMappingTemplate: appsync.MappingTemplate.fromString('$util.toJson($context.result)'),
        directives: [Directive.apiKey(), Directive.iam(), Directive.cognito('admin', 'operator', 'commentator', 'racer', 'registration')],
      })
    );
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx jest test/racer-profile.test.ts -v 2>&1 | tail -15
```

Expected: 2 tests pass.

- [ ] **Step 5: Run the full CDK build to make sure nothing else broke**

```bash
find lib -name '*.js' -delete; find lib -name '*.d.ts' -delete
npm run build 2>&1 | tail -3
npm test 2>&1 | tail -8
```

Expected: tsc clean. All existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add lib/constructs/racer-profile.ts test/racer-profile.test.ts
git commit -m "$(cat <<'EOF'
feat(racer-profile): add RacerProfile CDK construct with DDB + AppSync resolvers

New construct creating:
- DynamoDB RacerProfileTable, partition key username, PITR on
- AppSync types: RacerProfile (read), RacerProfileInput (write)
- Mutation updateRacerProfile (own) — Cognito user pools, identity-derived username
- Mutation updateRacerProfileForUser (admin override)
- Query getRacerProfile — public via API key plus Cognito + IAM
- Direct DDB JS resolvers, no Lambda — CRUD shape is too simple to need one

Test asserts the table key shape, PITR enabled, and three resolvers attached.
EOF
)"
```

---

## Task 2: Wire RacerProfile into stack and drop Cognito attrs

**Files:**
- Modify: `lib/drem-app-stack.ts` — instantiate `RacerProfile` construct
- Modify: `lib/constructs/idp.ts` — drop `custom:avatarConfig` and `custom:highlightColour`

- [ ] **Step 1: Add the import and instantiation in `lib/drem-app-stack.ts`**

Find the section where other constructs are instantiated (after `LandingPageManager`, alongside `Leaderboard`). Add:

```typescript
import { RacerProfile } from './constructs/racer-profile';
// ...

const racerProfile = new RacerProfile(this, 'RacerProfile', {
  appsyncApi: appsyncResources,
});
```

The `racerProfile` const isn't consumed by other constructs in v1 (the leaderboard pipeline-resolver uses the table by name via the schema in Task 3). It's defined for symmetry with other constructs and to surface the construct to cdk-nag.

- [ ] **Step 2: Drop the two custom attrs from `lib/constructs/idp.ts`**

Find the `customAttributes` block (around lines 90-100 — confirm with `grep -n 'avatarConfig\|highlightColour' lib/constructs/idp.ts`). Delete the two entries:

```typescript
// DELETE THIS:
avatarConfig: new cognito.StringAttribute({
  minLen: 0,
  maxLen: 2048,
  mutable: true,
}),
highlightColour: new cognito.StringAttribute({
  minLen: 0,
  maxLen: 32,
  mutable: true,
}),
```

Keep `countryCode`. After the edit, only `countryCode` remains under `customAttributes`.

- [ ] **Step 3: Verify CDK build is clean**

```bash
find lib -name '*.js' -delete; find lib -name '*.d.ts' -delete
npm run build 2>&1 | tail -3
npm test 2>&1 | tail -8
```

Expected: tsc clean. All tests pass.

- [ ] **Step 4: Commit**

```bash
git add lib/drem-app-stack.ts lib/constructs/idp.ts
git commit -m "$(cat <<'EOF'
feat(racer-profile): wire RacerProfile into stack; drop avatar/highlight Cognito attrs

- Instantiate RacerProfile construct in DeepracerEventManagerStack
- Remove custom:avatarConfig and custom:highlightColour from idp.ts
- custom:countryCode stays — pre-dates #171 and is effectively static

Note: removing custom attrs from a deployed Cognito User Pool will fail
CFN deploy. Existing fork dev/test environments with #171 deployed must
be torn down (make drem.clean) and redeployed fresh.
EOF
)"
```

---

## Task 3: Leaderboard schema rework — drop fields, add profile pipeline-resolver join

**Files:**
- Modify: `lib/constructs/leaderboard.ts`

- [ ] **Step 1: Drop `avatarConfig` and `highlightColour` from `leaderboardEntryObjectType`**

Find the `leaderboardEntryObjectType` definition (around line 230-240). Remove these two lines from `definition`:

```typescript
avatarConfig: GraphqlType.awsJson({ isRequired: false }),
highlightColour: GraphqlType.string({ isRequired: false }),
```

Keep `countryCode`. Do the same for any matching input type (`leaderboardEntryArgs` / similar input definitions in the same file).

- [ ] **Step 2: Add `profile` field of type `RacerProfile` to `leaderboardEntryObjectType`**

In the same `definition`, add:

```typescript
profile: GraphqlType.string(),  // placeholder — replaced in step 3
```

Wait — we need to reference the `RacerProfile` type. Cross-construct type sharing in awscdk-appsync-utils requires the type to be added to the schema before this construct runs, OR we share the type via the construct prop.

The cleanest approach: pass the `RacerProfile.profileObjectType` into the `Leaderboard` construct. Update `Leaderboard`'s props interface in `lib/constructs/leaderboard.ts`:

```typescript
export interface LeaderboardProps {
  // ...existing props...
  racerProfileObjectType: ObjectType;  // NEW
}
```

Then the `definition` becomes:

```typescript
profile: props.racerProfileObjectType.attribute(),
```

- [ ] **Step 3: Update `drem-app-stack.ts` to pass the profile type to Leaderboard**

In `lib/drem-app-stack.ts`, find where `Leaderboard` is instantiated. Add:

```typescript
const leaderboard = new Leaderboard(this, 'Leaderboard', {
  // ...existing props...
  racerProfileObjectType: racerProfile.profileObjectType,
});
```

- [ ] **Step 4: Add a pipeline-resolver function on `LeaderBoardEntry.profile`**

In `lib/constructs/leaderboard.ts`, after the data sources are defined, add a DDB data source pointing at `RacerProfileTable`. But — we don't want `Leaderboard` to know about the `RacerProfile` table directly. The cleanest approach: pass the data source through props too, OR use a field-resolver attached at the parent stack level.

For v1 simplicity, pass the table through:

```typescript
export interface LeaderboardProps {
  // ...existing props...
  racerProfileObjectType: ObjectType;
  racerProfileTable: dynamodb.ITable;
}
```

Then inside `Leaderboard` constructor:

```typescript
const racerProfileDataSource = props.appsyncApi.api.addDynamoDbDataSource(
  'LeaderboardRacerProfileDataSource',
  props.racerProfileTable
);

// Field-level resolver on LeaderBoardEntry.profile
new appsync.Resolver(this, 'LeaderBoardEntryProfileResolver', {
  api: props.appsyncApi.api,
  typeName: 'LeaderBoardEntry',
  fieldName: 'profile',
  dataSource: racerProfileDataSource,
  requestMappingTemplate: appsync.MappingTemplate.fromString(`
{
  "version": "2018-05-29",
  "operation": "GetItem",
  "key": {
    "username": $util.dynamodb.toDynamoDBJson($context.source.username)
  }
}
`),
  responseMappingTemplate: appsync.MappingTemplate.fromString('$util.toJson($context.result)'),
});
```

The field resolver fires once per leaderboard entry returned. AppSync handles batching automatically.

- [ ] **Step 5: Update `drem-app-stack.ts` to also pass the table**

```typescript
const leaderboard = new Leaderboard(this, 'Leaderboard', {
  // ...existing props...
  racerProfileObjectType: racerProfile.profileObjectType,
  racerProfileTable: racerProfile.table,
});
```

- [ ] **Step 6: Verify CDK build + synth + tests**

```bash
find lib -name '*.js' -delete; find lib -name '*.d.ts' -delete
npm run build 2>&1 | tail -3
npm test 2>&1 | tail -8
```

Expected: tsc clean. All tests pass. Subscriptions automatically inherit the `profile` field from the entry type — no extra subscription resolver needed because AppSync resolves the field on every type return.

- [ ] **Step 7: Commit**

```bash
git add lib/constructs/leaderboard.ts lib/drem-app-stack.ts
git commit -m "$(cat <<'EOF'
feat(leaderboard): live-join profile from RacerProfile; drop avatar/highlight from entry

- Drop avatarConfig and highlightColour fields from LeaderBoardEntry type
- Add profile: RacerProfile field on LeaderBoardEntry, resolved via field
  resolver doing DDB GetItem on RacerProfileTable keyed by entry.username
- Wire RacerProfile object type and table into Leaderboard construct via
  new constructor props (racerProfileObjectType, racerProfileTable)
- countryCode stays — still snapshotted at race-time from Cognito

Subscriptions (onNewLeaderboardEntry, onUpdateLeaderboardEntry) inherit
the profile field automatically since they return LeaderBoardEntry.
EOF
)"
```

---

## Task 4: Lambda simplification

**Files:**
- Modify: `lib/lambdas/leaderboard_entry_evb/index.py`
- Modify: `lib/lambdas/users_function/index.py`

- [ ] **Step 1: Simplify `__get_username_by_user_id` and its callers**

In `lib/lambdas/leaderboard_entry_evb/index.py`:

Find `__get_username_by_user_id` (around line 60). Currently returns 4 values. Change to return only 2:

```python
def __get_username_by_user_id(user_id: str) -> tuple[str, str | None]:
    """Read Cognito username and countryCode for the given userId."""
    user = cognito.admin_get_user(UserPoolId=USER_POOL_ID, Username=user_id)
    username = user["Username"]
    countryCode = None
    for attr in user["UserAttributes"]:
        if attr["Name"] == "custom:countryCode":
            countryCode = attr["Value"]
    return username, countryCode
```

- [ ] **Step 2: Update the three call sites**

The callers at lines 31-32, 36-37, 41-42 each unpack 4 values into the entry. Change all three to unpack 2:

```python
# was:
# username, countryCode, avatarConfig, highlightColour = __get_username_by_user_id(detail["userId"])
# detail = {**detail, "username": username, "countryCode": countryCode, "avatarConfig": avatarConfig, "highlightColour": highlightColour}

# becomes:
username, countryCode = __get_username_by_user_id(detail["userId"])
detail = {**detail, "username": username, "countryCode": countryCode}
```

(Apply the same pattern at lines 36-37 and 41-42.)

- [ ] **Step 3: Strip avatarConfig and highlightColour from the GraphQL mutation strings**

The file has inline GraphQL mutation templates around lines 120-140 and 180-220. Each declares `$avatarConfig: AWSJSON` and `$highlightColour: String` and passes them in the input. Remove all 4 such occurrences (2 per mutation × 2 mutations) and remove `avatarConfig` and `highlightColour` from the `selectionSet` (lines ~159-160 and ~219-220).

- [ ] **Step 4: Update `update_user_profile` in `lib/lambdas/users_function/index.py`**

Find `update_user_profile` (around line 191). Currently writes `avatarConfig` and `highlightColour` to Cognito. Drop both — function now only handles whatever other profile attrs remain. If avatarConfig/highlightColour are the *only* parameters the function takes, the function becomes empty — in that case, also remove the AppSync resolver that calls it (search `lib/constructs/user-manager.ts` for `updateUserProfile`).

After the edit, run `grep -n 'avatarConfig\|highlightColour' lib/lambdas/users_function/index.py` — should return no matches.

- [ ] **Step 5: Verify CDK build + tests**

```bash
find lib -name '*.js' -delete; find lib -name '*.d.ts' -delete
npm run build 2>&1 | tail -3
npm test 2>&1 | tail -8
```

Expected: tsc clean. All tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/lambdas/leaderboard_entry_evb/index.py lib/lambdas/users_function/index.py
# also stage user-manager.ts if its updateUserProfile resolver was removed:
git add lib/constructs/user-manager.ts 2>/dev/null || true
git commit -m "$(cat <<'EOF'
refactor(lambda): drop avatar/highlight reads in leaderboard_entry_evb and users_function

- leaderboard_entry_evb no longer reads custom:avatarConfig or
  custom:highlightColour from Cognito; only username and countryCode now
- Mutation strings (addLeaderboardEntry, updateLeaderboardEntry) drop
  the two variables and selection-set fields
- users_function update_user_profile drops avatarConfig and
  highlightColour parameters

Profile data is now read live from the RacerProfile table at GraphQL
read time via the LeaderBoardEntry.profile field resolver.
EOF
)"
```

---

## Task 5: Frontend — profile editor, top nav, useAuth (with Steve's UX)

**Files:**
- Create: `website/src/components/AvatarDisplay.tsx` (Steve's shared component)
- Create: `website/src/types/avataaars.d.ts`
- Modify: `website/src/admin/user-profile/AvatarBuilder.tsx`
- Modify: `website/src/components/topNav.tsx`
- Modify: `website/src/hooks/useAuth.ts`

This task absorbs Steve Askwith's UX-improvements commit (`b5b2eaf`) inline rather than cherry-picking, because we need to combine his UI changes with the data-source swap (Cognito → `getRacerProfile`).

- [ ] **Step 1: Run `make local.config` to refresh the GraphQL codegen with the new `getRacerProfile`/`updateRacerProfile`**

```bash
make local.config
```

Expected: codegen regenerates `website/src/graphql/queries.ts`, `mutations.ts`, `subscriptions.ts` with the new RacerProfile operations. (Requires the previous tasks to have been deployed to a dev account so the AppSync schema is queryable. If running ahead of deploy, hand-edit the codegen output to add the operations.)

- [ ] **Step 2: Create `website/src/types/avataaars.d.ts`**

Copy verbatim from Steve's commit `b5b2eaf:website/src/types/avataaars.d.ts`:

```bash
git show b5b2eaf:website/src/types/avataaars.d.ts > website/src/types/avataaars.d.ts
```

- [ ] **Step 3: Create `website/src/components/AvatarDisplay.tsx`**

Copy verbatim from Steve's commit:

```bash
git show b5b2eaf:website/src/components/AvatarDisplay.tsx > website/src/components/AvatarDisplay.tsx
```

This file is purely presentational — takes a config prop, renders avataaars or a silhouette fallback. Same regardless of where the data came from.

- [ ] **Step 4: Rewrite `website/src/admin/user-profile/AvatarBuilder.tsx`**

Start from Steve's UX version (`git show b5b2eaf:website/src/admin/user-profile/AvatarBuilder.tsx`), then swap the data source. Key changes vs Steve's version:

- Replace any `getCurrentUserAttributes()` / `fetchUserAttributes()` reads of `custom:avatarConfig` / `custom:highlightColour` with:

```typescript
import { getRacerProfile } from '../../graphql/queries';
import { updateRacerProfile } from '../../graphql/mutations';
import { generateClient } from 'aws-amplify/api';

const client = generateClient();

useEffect(() => {
  (async () => {
    const { data } = await client.graphql({
      query: getRacerProfile,
      variables: { username: identity.username },
    });
    if (data?.getRacerProfile) {
      setAvatarConfig(JSON.parse(data.getRacerProfile.avatarConfig ?? '{}'));
      setHighlightColour(data.getRacerProfile.highlightColour ?? DEFAULT_HIGHLIGHT);
    }
  })();
}, [identity.username]);
```

- Replace the save handler:

```typescript
const onSave = async () => {
  await client.graphql({
    query: updateRacerProfile,
    variables: {
      input: {
        avatarConfig: JSON.stringify(avatarConfig),
        highlightColour,
      },
    },
  });
};
```

Steve's UX additions stay intact: `ExpandableSection` with custom header containing the 40px preview, neutral bald-yellow `DEFAULT_CONFIG`, `AvatarDisplay` for rendering.

- [ ] **Step 5: Rewrite `website/src/components/topNav.tsx`**

Start from Steve's version (`git show b5b2eaf:website/src/components/topNav.tsx`), then swap the data source. Replace the Cognito attribute fetch with:

```typescript
import { getRacerProfile } from '../graphql/queries';
import { generateClient } from 'aws-amplify/api';

const [userAvatarConfig, setUserAvatarConfig] = useState<string | null>(null);

useEffect(() => {
  (async () => {
    const client = generateClient();
    const { data } = await client.graphql({
      query: getRacerProfile,
      variables: { username: identity.username },
    });
    setUserAvatarConfig(data?.getRacerProfile?.avatarConfig ?? null);
  })();
}, [identity.username]);
```

The rest of Steve's `iconSvg` + `marginTop: '-4px'` + `useMemo` dependency wiring stays. Fallback to silhouette via `AvatarDisplay` is unchanged.

- [ ] **Step 6: Update `website/src/hooks/useAuth.ts`**

Change the source of the `avatarConfig` / `highlightColour` fields from a Cognito attribute lookup to a `getRacerProfile` query. The `useAuth()` shape stays identical to consumers:

```typescript
// In whatever effect/method currently reads avatarConfig/highlightColour
// from user attributes, swap to:
const profileResp = await client.graphql({
  query: getRacerProfile,
  variables: { username: user.username },
});
return {
  ...existingFields,
  avatarConfig: profileResp.data?.getRacerProfile?.avatarConfig ?? null,
  highlightColour: profileResp.data?.getRacerProfile?.highlightColour ?? null,
};
```

- [ ] **Step 7: Verify website build**

```bash
cd website && npm install --legacy-peer-deps && npm run build 2>&1 | tail -10 && cd ..
```

Expected: tsc + Vite build passes.

- [ ] **Step 8: Commit**

```bash
git add website/src/components/AvatarDisplay.tsx \
        website/src/types/avataaars.d.ts \
        website/src/admin/user-profile/AvatarBuilder.tsx \
        website/src/components/topNav.tsx \
        website/src/hooks/useAuth.ts \
        website/src/graphql/queries.ts \
        website/src/graphql/mutations.ts \
        website/src/graphql/subscriptions.ts
git commit -m "$(cat <<'EOF'
feat(profile-frontend): AvatarBuilder + topNav + useAuth use RacerProfile query

Frontend rework for profile data (avatar + highlight colour). Replaces
the Cognito-attribute fetch path with the new getRacerProfile query and
updateRacerProfile mutation.

Includes Steve Askwith's avatar UX improvements (originally on
b5b2eaf) integrated inline:
- New shared AvatarDisplay component with silhouette SVG fallback
- Neutral bald-yellow DEFAULT_CONFIG (genderless/raceless)
- Avatar preview in collapsed ExpandableSection header
- Mini avatar in top nav replacing the generic user-profile icon
- avataaars TypeScript declarations

Co-Authored-By: Steven Askwith <askwith@amazon.co.uk>
EOF
)"
```

---

## Task 6: Frontend — timekeeper publish chain

**Files:**
- Modify: `website/src/pages/timekeeper/components/racerSelector.tsx`
- Modify: `website/src/pages/timekeeper/support-functions/raceDomain.ts`
- Modify: `website/src/pages/timekeeper/support-functions/raceDomain.test.ts`
- Modify: `website/src/pages/timekeeper/pages/racePage.tsx`
- Modify: `website/src/pages/timekeeper/pages/racePageLite.tsx`
- Modify: `website/src/pages/timekeeper/pages/raceFinishPage.tsx`
- Modify: `website/src/pages/timekeeper/timeKeeperWizard.tsx`
- Modify: `website/src/hooks/usePublishOverlay.ts`

- [ ] **Step 1: Strip avatarConfig and highlightColour from racerSelector.tsx**

Find every reference to `avatarConfig` and `highlightColour` and remove. The component reads Cognito attributes when timekeeper picks a racer; remove the avatar/highlight reads. `countryCode` stays.

```bash
grep -n 'avatarConfig\|highlightColour' website/src/pages/timekeeper/components/racerSelector.tsx
```

- [ ] **Step 2: Strip the same fields from `raceDomain.ts`**

```bash
grep -n 'avatarConfig\|highlightColour' website/src/pages/timekeeper/support-functions/raceDomain.ts
```

Remove both fields from any type definitions and from any constructor / factory functions. The race domain object no longer carries profile data — only countryCode for snapshot.

- [ ] **Step 3: Update `raceDomain.test.ts` accordingly**

```bash
grep -n 'avatarConfig\|highlightColour' website/src/pages/timekeeper/support-functions/raceDomain.test.ts
```

Remove the fields from any test fixtures and assertions.

- [ ] **Step 4: Strip from racePage.tsx, racePageLite.tsx, raceFinishPage.tsx, timeKeeperWizard.tsx, usePublishOverlay.ts**

For each file, remove all lines referencing `avatarConfig` and `highlightColour`:

```bash
for f in website/src/pages/timekeeper/pages/racePage.tsx \
         website/src/pages/timekeeper/pages/racePageLite.tsx \
         website/src/pages/timekeeper/pages/raceFinishPage.tsx \
         website/src/pages/timekeeper/timeKeeperWizard.tsx \
         website/src/hooks/usePublishOverlay.ts; do
  echo "=== $f ==="
  grep -n 'avatarConfig\|highlightColour' "$f"
done
```

These are all propagation paths from racer-pick to race-publish. None need replacement — the leaderboard live-joins these fields at read time, so they don't need to flow through the publish chain.

- [ ] **Step 5: Run frontend tests**

```bash
cd website && npm install --legacy-peer-deps && npm test 2>&1 | tail -10 && cd ..
```

Expected: tests pass; `raceDomain.test.ts` updates verified.

- [ ] **Step 6: Run website build**

```bash
cd website && npm run build 2>&1 | tail -10 && cd ..
```

Expected: tsc + Vite build passes.

- [ ] **Step 7: Commit**

```bash
git add website/src/pages/timekeeper/ website/src/hooks/usePublishOverlay.ts
git commit -m "$(cat <<'EOF'
refactor(timekeeper): drop avatar/highlight from race publish chain

Avatar and highlight colour are no longer snapshotted at race-time —
they're live-joined from the RacerProfile table via the
LeaderBoardEntry.profile field resolver when the leaderboard renders.

racerSelector, raceDomain, racePage, racePageLite, raceFinishPage,
timeKeeperWizard, and usePublishOverlay all simplify by dropping the
two fields from their props/payloads. countryCode stays — still
snapshotted at race-time from Cognito.
EOF
)"
```

---

## Task 7: Frontend — leaderboard + overlays render code

**Files:**
- Modify: `website/leaderboard/src/components/leaderboardTable.tsx`
- Modify: `website/leaderboard/src/components/raceSummaryFooter.tsx`
- Modify: `website/leaderboard/src/graphql/{queries,subscriptions}.ts` (regenerated)
- Modify: `website/overlays/src/...` (any consumer of avatar fields)

- [ ] **Step 1: Refresh leaderboard codegen**

```bash
make local.config
```

The leaderboard's GraphQL queries/subscriptions now include `profile { avatarConfig highlightColour }` on each `LeaderBoardEntry`. The codegen output is in `website/leaderboard/src/graphql/{queries,subscriptions}.ts`.

If running before the schema is deployed, hand-edit the .ts files to add `profile { avatarConfig highlightColour }` after the existing fields on every `LeaderBoardEntry` selection.

- [ ] **Step 2: Update `leaderboardTable.tsx`**

```bash
grep -n 'avatarConfig\|highlightColour' website/leaderboard/src/components/leaderboardTable.tsx
```

For each occurrence, change `entry.avatarConfig` → `entry.profile?.avatarConfig` and `entry.highlightColour` → `entry.profile?.highlightColour`. Optional chaining matters — `profile` is null when the racer hasn't set one.

- [ ] **Step 3: Update `raceSummaryFooter.tsx` the same way**

```bash
grep -n 'avatarConfig\|highlightColour' website/leaderboard/src/components/raceSummaryFooter.tsx
```

Apply the same `entry.profile?.avatarConfig` rewrite.

- [ ] **Step 4: Repeat for any overlay consumer**

```bash
grep -rn 'avatarConfig\|highlightColour' website/overlays/src
```

Apply the same rewrite anywhere overlay code consumes these fields.

- [ ] **Step 5: Run leaderboard tests**

```bash
cd website/leaderboard && npm install --legacy-peer-deps && npm test 2>&1 | tail -10 && cd ../..
```

Expected: tests pass.

- [ ] **Step 6: Run leaderboard + overlays builds**

```bash
cd website/leaderboard && npm run build 2>&1 | tail -5 && cd ../..
cd website/overlays && npm install --legacy-peer-deps && npm run build 2>&1 | tail -5 && cd ../..
```

Expected: both builds pass.

- [ ] **Step 7: Commit**

```bash
git add website/leaderboard/ website/overlays/
git commit -m "$(cat <<'EOF'
refactor(leaderboard, overlays): read avatar/highlight from entry.profile

Both apps now consume the live-joined profile data via
entry.profile?.avatarConfig and entry.profile?.highlightColour rather
than reading from the entry root. Codegen regenerated against the new
LeaderBoardEntry schema with the profile field.

Optional chaining handles the null-profile case (racer hasn't set one)
— AvatarDisplay's silhouette fallback then renders.
EOF
)"
```

---

## Task 8: Pipeline test fixes (Steve's `5a7a923`)

**Files:**
- Modify: `lib/cdk-pipeline-stack.ts`

This is Steve's pipeline-fixes commit, applied independently. Even after all the data-model rework, `avataaars` still declares a React 17 peer dep, so `--legacy-peer-deps` is still needed in the pipeline test steps. The approval-gate dependency is a sequencing fix unrelated to the data model.

- [ ] **Step 1: Find the WebsiteTests step's commands**

```bash
grep -n "websiteTestStep\|WebsiteTests\|cd website && npm install" lib/cdk-pipeline-stack.ts
```

In the `websiteTestStep`'s `commands` array, change:

```typescript
'cd website && npm install && npm test && cd ..',
'cd website/leaderboard && npm install && npm test && cd ../..',
```

to:

```typescript
'cd website && npm install --legacy-peer-deps && npm test && cd ..',
'cd website/leaderboard && npm install --legacy-peer-deps && npm test && cd ../..',
```

- [ ] **Step 2: Same in `postDeployStep`**

Find the `postDeployStep`'s `commands` array. Change:

```typescript
'cd website && npm install && npm run test:post-deploy && cd ..',
```

to:

```typescript
'cd website && npm install --legacy-peer-deps && npm run test:post-deploy && cd ..',
```

- [ ] **Step 3: Sequence the manual-approval gate after WebsiteTests**

Find where `infrastructure_stage` is created — currently:

```typescript
const infrastructure_stage = pipeline.addStage(infrastructure, {
  pre: [new pipelines.ManualApprovalStep('DeployDREM')],
});
// ...later...
infrastructure_stage.addPre(websiteTestStep);
```

Restructure so `websiteTestStep` is defined first, then `approvalStep` references it:

```typescript
// Move websiteTestStep definition above this block
const websiteTestStep = new pipelines.CodeBuildStep('WebsiteTests', { /* unchanged */ });

const approvalStep = new pipelines.ManualApprovalStep('DeployDREM');
approvalStep.addStepDependency(websiteTestStep);

const infrastructure_stage = pipeline.addStage(infrastructure, {
  pre: [websiteTestStep, approvalStep],
});
// remove the separate addPre(websiteTestStep) call
```

- [ ] **Step 4: Verify CDK build + tests**

```bash
find lib -name '*.js' -delete; find lib -name '*.d.ts' -delete
npm run build 2>&1 | tail -3
npm test 2>&1 | tail -8
```

Expected: tsc clean. All tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/cdk-pipeline-stack.ts
git commit -m "$(cat <<'EOF'
fix(pipeline): --legacy-peer-deps in test steps, sequence approval after tests

avataaars declares a React 17 peer while DREM uses React 18; npm errors
ERESOLVE in WebsiteTests and PostDeployTests without the flag.

Also sequence ManualApproval after WebsiteTests so the approval
notification doesn't appear in parallel with tests — previously a
deploy could be approved before tests had even started.

Co-Authored-By: Steven Askwith <askwith@amazon.co.uk>
EOF
)"
```

---

## Final verification

- [ ] **Step 1: Confirm 8 commits on the branch**

```bash
git log --oneline main..HEAD
```

Expected: 8 commits (Task 0 through Task 7's commits, since Task 8 is the 8th implementation commit on top of Task 0's spec commit).

- [ ] **Step 2: Force-push with lease**

```bash
git push --force-with-lease origin feat/racer-avatar
```

- [ ] **Step 3: Tear down any existing fork dev/test deployment that has #171's old Cognito attrs**

```bash
make drem.clean
# wait for completion, then:
make pipeline.deploy
```

This is the path to clear the now-removed Cognito custom attrs from the deployed User Pool. CFN cannot remove a custom attr in-place; the User Pool must be recreated.

- [ ] **Step 4: Update PR #171 description**

Note in the PR description that the implementation switched from Cognito custom attributes to a dedicated DynamoDB `RacerProfile` table per the spec at `docs/superpowers/specs/2026-05-05-racer-profile-table-design.md`. Link to Steve's original feedback (`avatar-ux-improvements.md`) and credit him as co-author on Tasks 5 and 8.

- [ ] **Step 5: Update merge plan on `docs/fork-notes`**

Switch to `docs/fork-notes`, update the `#171` row in the Independent PRs table to reflect the rework, and refresh the local copy at `docs/merge-plan.md`.
