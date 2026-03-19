# Testing Guide: SSM Parameter Store — Cross-Stack Sharing (PR 1 of 2)

## Overview

This is the first of two PRs that together eliminate CloudFormation `Fn::ImportValue`
hard dependencies between `BaseStack` and `DeepracerEventManagerStack`.

**Why this matters:** `Fn::ImportValue` creates a CloudFormation lock between stacks
that blocks independent updates. The symptom is:

```
Delete canceled. Cannot delete export drem-backend-X-base:ExportsOutput...
as it is in use by drem-backend-X-infrastructure.
```

### What this PR does (additive only — safe for fresh installs and upgrades)

- Adds 14 SSM parameters to `BaseStack` under `/${stackName}/<key>`
- Removes T&C checkbox/link from sign-up flow and admin Create User form
- No changes to `DeepracerEventManagerStack`, the pipeline stage, or any cross-stack
  references — existing `Fn::ImportValue` dependencies are untouched

### What PR 2 does (follow-up — requires two-pipeline migration, documented below)

- Switches `DeepracerEventManagerStack` to read all 14 values from SSM instead of
  via `Fn::ImportValue`
- Removes T&C CDK infrastructure (S3 bucket, CloudFront distributions, pipeline step)

---

## Automated Tests

Run before doing anything else. No Docker or live AWS account needed.

```sh
npm install
make test.cdk
```

Expected output:

```
PASS test/deepracer-event-manager.test.ts
  BaseStack
    ✓ creates all required SSM parameters for cross-stack sharing
```

---

## Integration Test Plan (PR 1)

### Prerequisites

- AWS account bootstrapped for CDK (`make bootstrap`)
- `build.config` configured with your account, region, email, and label
- AWS CLI and CDK CLI available locally

### Step 1 — Tear down any existing deployment (if upgrading)

Fresh installations can skip to Step 2.

```sh
make drem.clean
```

Expected duration: 15–30 minutes.

> **Note:** The logs S3 bucket logs access to itself, which causes CloudFormation
> auto-delete to fail. `make drem.clean` handles this by disabling logging and emptying
> the bucket first. If the base stack enters `DELETE_FAILED`, re-run manually:
> ```sh
> BUCKET=<bucket-name> REGION=<region>
> aws s3api put-bucket-logging --bucket $BUCKET --bucket-logging-status {} --region $REGION
> aws s3 rm s3://$BUCKET --recursive --region $REGION
> aws cloudformation delete-stack --stack-name drem-backend-<label>-base --region $REGION
> ```

### Step 2 — Deploy from upstream `release/stable` (baseline)

```
source_repo = aws-solutions-library-samples/guidance-for-aws-deepracer-event-management
source_branch = release/stable
```

```sh
make install
```

Approve the `DeployDREM` manual approval step when it appears. Expected: 45–90 min.

> **Verify:** Pipeline green, website accessible, sign-up shows T&C checkbox.

### Step 3 — Switch to this branch

```
source_repo = <your-fork>/guidance-for-aws-deepracer-event-management
source_branch = feat/ssm-cross-stack-sharing
```

```sh
make install
```

Approve `DeployDREM` when prompted. Expected: 45–90 min.

This is a safe upgrade — the pipeline only **adds** 14 SSM parameters to the base
stack. No exports are removed, no cross-stack references change.

### Step 4 — Verify post-deploy state

#### SSM Parameter Store console

Open [SSM Parameter Store](https://console.aws.amazon.com/systems-manager/parameters)
and filter by `/drem-backend-<label>-base/`. Expect **14 parameters**:

| Parameter | Contains |
|-----------|---------|
| `cloudfrontDistributionId` | CloudFront distribution ID |
| `cloudfrontDistributionDomainName` | e.g. `abc123.cloudfront.net` |
| `cloudfrontDomainName` | Custom domain or CloudFront domain |
| `logsBucketName` | S3 bucket name |
| `websiteBucketName` | S3 bucket name |
| `eventBusArn` | EventBridge custom bus ARN |
| `userPoolId` | Cognito User Pool ID |
| `identityPoolId` | Cognito Identity Pool ID |
| `userPoolClientWebId` | Cognito App Client ID |
| `adminGroupRoleArn` | IAM Role ARN |
| `operatorGroupRoleArn` | IAM Role ARN |
| `commentatorGroupRoleArn` | IAM Role ARN |
| `registrationGroupRoleArn` | IAM Role ARN |
| `authenticatedUserRoleArn` | IAM Role ARN |

Or via CLI:

```sh
aws ssm get-parameters-by-path \
  --path /drem-backend-<label>-base/ \
  --region <region> \
  --query 'Parameters[*].Name' \
  --output table
```

#### Functional checks

```sh
make local.config
make test.cdk
```

> **Verify:**
> - Website accessible and functional
> - Sign-up flow has no T&C checkbox
> - Admin Create User form has no T&C checkbox
> - T&C page still accessible at its CloudFront URL (CDK infrastructure not yet removed)

### Step 5 — Clean up

```sh
make drem.clean
```

---

## PR 2 Migration Guide (Fn::ImportValue removal)

> Run this **after** PR 1 has been deployed and confirmed working.

PR 2 switches `DeepracerEventManagerStack` from `Fn::ImportValue` to SSM reads, and
removes the T&C CDK infrastructure. Because this removes CloudFormation exports that
the infra stack currently imports, it **cannot be done in a single pipeline run** when
upgrading from PR 1. Two pipeline runs are required.

### Why two pipeline runs are needed

With `Fn::ImportValue`, CloudFormation enforces: a stack cannot remove an export while
another stack imports it. Even if both stacks update in the same pipeline run, the
evaluation is against the **currently deployed** infra state.

- **Pipeline run 1** (infra-first ordering): Infra drops all `Fn::ImportValue` references
  (reads from SSM instead). Base unchanged.
- **Pipeline run 2** (base-first ordering): Base removes the now-unused `CfnOutput`
  exports and the T&C CDK resources. Infra already uses SSM — no conflict.

### Pipeline run 1 — Drop Fn::ImportValue from infra

Switch `build.config` to the PR 2 branch with `stack.addDependency` temporarily
**reversed** (infra first). SSM params already exist from PR 1, so infra can resolve
them at changeset creation time.

After this pipeline run completes, infra no longer has any `Fn::ImportValue`:

```sh
aws cloudformation get-template \
  --stack-name drem-backend-<label>-infrastructure \
  --region <region> \
  --query 'TemplateBody' \
  | grep -c 'Fn::ImportValue'
# Expected: 0
```

### Pipeline run 2 — Remove base exports and T&C infrastructure

Restore `stack.addDependency(baseStack)` (base first). Trigger a second pipeline run.
Base can now safely remove its `CfnOutput` exports and T&C resources.

> See `docs/testing-ssm-cross-stack-migration-pr2.md` (in the PR 2 branch) for the
> full step-by-step guide.

---

## Key Files Changed (PR 1)

| File | What changed |
|------|-------------|
| `lib/base-stack.ts` | Writes 14 SSM parameters at end of constructor |
| `lib/constructs/cdn.ts` | Added `comment` prop for CloudFront distribution descriptions |
| `lib/constructs/leaderboard.ts` | Passes `comment` to Cdn construct |
| `lib/constructs/streaming-overlay.ts` | Passes `comment` to Cdn construct |
| `website/src/App.tsx` | Removed T&C checkbox and footer link from sign-up flow |
| `website/src/admin/users/createUser.tsx` | Removed T&C checkbox from Create User form |
| `website/public/locales/en/translation.json` | Removed T&C translation strings |
| `scripts/generate_amplify_config_cfn.py` | Removed `termsAndConditionsUrl` from config |
| `tsconfig.json` | Exclude `website*/` subdirs from CDK `tsc` compilation |
| `test/deepracer-event-manager.test.ts` | CDK assertion test for the 14 SSM parameters |
| `jest.config.ts` | Converted from `.js` to `.ts` |
| `Makefile` | `make drem.clean`, Python venv fixes, `make test.cdk`, `--require-approval never` |
| `CLAUDE.md` | Project overview, commands, and architecture notes |
