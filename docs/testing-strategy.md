# DREM Testing Strategy

## Overview

DREM uses a layered testing approach built into the CDK pipeline. Tests run at two points: before deployment (fast, no AWS dependencies) and after deployment (slower, validates the live stack). All results are published as JUnit XML to the CodeBuild test report console.

---

## Pipeline test stages

```
Source → CDK Synth → [Pre-deploy tests] → Deploy → [Post-deploy tests]
```

### Pre-deploy — CDK (`test/`)

**Runner:** Jest + jest-junit  
**When:** Before any deployment, as part of CDK synth  
**Count:** 1

| File | What it tests |
|---|---|
| `test/deepracer-event-manager.test.ts` | Pipeline stack synthesizes with exactly one `AWS::CodePipeline::Pipeline` resource |

The intent here is a sanity check that the CDK app synthesizes correctly, not exhaustive infrastructure assertions. cdk-nag runs alongside this to enforce AWS security best practices on every synth.

---

### Pre-deploy — Website (`website/src/`)

**Runner:** Vitest  
**Config:** `website/vitest.config.ts`  
**When:** Before deployment, in the `PreDeployTests` CodeBuild step  
**Count:** 40 (4 files)

| File | What it tests |
|---|---|
| `src/support-functions/time.test.ts` | Time formatting and calculation utilities |
| `src/admin/race-admin/support-functions/metricCalculations.test.ts` | Race metric calculations |
| `src/admin/race-admin/support-functions/raceTableConfig.test.ts` | Race table column configuration |
| `src/components/devices-table/deviceTableConfig.test.ts` | Device table column configuration |

These are pure unit tests with no network calls or AWS dependencies. They run in a Node environment and complete in seconds.

The `graphql-schema-conformance.test.ts` and `smoke.test.ts` files are **excluded** from this run via `vitest.config.ts` — they require a deployed environment and run post-deploy instead.

---

### Post-deploy — Website (`website/src/__tests__/`)

**Runner:** Vitest  
**Config:** `website/vitest.config.post-deploy.ts` (no excludes)  
**When:** After `MainSiteDeployToS3` completes, in the `PostDeployTests` CodeBuild step  
**Count:** 16 (2 files)

#### GraphQL Schema Conformance — Layer 1 (`graphql-schema-conformance.test.ts`)

Validates that every GraphQL operation in the frontend codebase is valid against the **live AppSync schema**, fetched fresh from the deployed API via `aws appsync get-introspection-schema` at the start of the post-deploy step.

| Test group | What it checks |
|---|---|
| Schema itself | `schema.graphql` is parseable; has Query, Mutation, Subscription root types |
| `mutations.ts` | Exports ≥1 mutation; all are syntactically valid GraphQL; all validate against schema |
| `queries.ts` | Exports ≥1 query; all are syntactically valid GraphQL; all validate against schema |
| `subscriptions.ts` | Exports ≥1 subscription; all are syntactically valid GraphQL; all validate against schema |
| `.js` baselines | The original `.js` operation files all still pass (regression guard) |

This catches a class of bug where a TypeScript migration introduces invented or mistyped fields that don't exist in the real schema. No mocking, no network calls — pure static validation against the fetched schema file.

#### Smoke Tests (`smoke.test.ts`)

Playwright tests that hit the live CloudFront URL (`DREM_WEBSITE_URL` env var, set from the CDK stack output).

| Test | What it checks |
|---|---|
| `DREM_WEBSITE_URL env var is set` | Env var is present (guards against misconfiguration) |
| `main page returns HTTP 200` | CloudFront distribution is serving the site |
| `page title contains DREM` | Correct build was deployed (not a blank page or error page) |
| `page renders a root element` | React app mounted successfully (`#root` exists in DOM) |

These tests are written to be compatible with the CloudWatch Synthetics Playwright runtime (`syn-playwright-nodejs-*`), so they can be promoted to a continuous monitoring canary without rewriting.

---

## Test count summary

| Stage | Runner | Count |
|---|---|---|
| Pre-deploy CDK | Jest | 1 |
| Pre-deploy website | Vitest | 40 |
| Post-deploy conformance | Vitest + Playwright | 12 |
| Post-deploy smoke | Vitest + Playwright | 4 |
| **Total** | | **57** |

---

## What's not tested yet (known gaps)

- **React component rendering** — no `@testing-library/react` tests for UI components beyond table config
- **Lambda function logic** — backend business logic is not unit tested
- **Authentication flows** — Cognito login/redirect not covered by smoke tests
- **Leaderboard and overlay apps** — `website-leaderboard` has 2 tests (`time.test.ts`); `website-stream-overlays` has none
- **GraphQL Layer 2** — conformance tests validate syntax and field existence but not response shapes or resolver behaviour

---

## Future directions

- **CloudWatch Synthetics canary** — promote `smoke.test.ts` to a scheduled canary for continuous post-deploy monitoring between events
- **GraphQL Layer 2** — validate that operation response shapes match the TypeScript types generated from the schema
- **Component tests** — add Vitest + `@testing-library/react` tests for key UI components (leaderboard, race timer, model upload)
- **Lambda unit tests** — add Python unit tests for Lambda handlers, run in the pre-deploy stage
