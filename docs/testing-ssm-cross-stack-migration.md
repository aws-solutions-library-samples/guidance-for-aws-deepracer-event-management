# SSM Parameter Store — Cross-Stack Sharing Migration Guide

## Overview

This is **PR 1 of 3** that together eliminate CloudFormation `Fn::ImportValue` hard
dependencies between `BaseStack` and `DeepracerEventManagerStack` and remove the
Terms & Conditions feature.

> **BREAKING CHANGE — Sequential upgrade required**
>
> If you have an **existing deployment**, you must apply these three PRs **in order**.
> Skipping directly to the latest release will break your deployment with:
> ```
> Delete canceled. Cannot delete export drem-backend-X-base:ExportsOutput...
> as it is in use by drem-backend-X-infrastructure.
> ```
> The three PRs must be deployed as separate pipeline runs in sequence:
> 1. **PR 1** `feat/ssm-cross-stack-sharing` — adds SSM parameters + removes T&C frontend (this PR)
> 2. **PR 2** `feat/ssm-infra-migration` — switches infra to SSM, removes T&C CDK infrastructure
> 3. **PR 3** `feat/restore-base-first-ordering` — restores correct base-first pipeline ordering
>
> Fresh installations (no existing stacks) can apply any single PR or all three in one go.

**Why this matters:** `Fn::ImportValue` creates a CloudFormation lock between stacks
that blocks independent updates. The symptom is:

```
Delete canceled. Cannot delete export drem-backend-X-base:ExportsOutput...
as it is in use by drem-backend-X-infrastructure.
```

### What this PR does (additive only — safe for fresh installs and upgrades)

- Adds 19 SSM parameters to `BaseStack` under `/${stackName}/<key>`
- Removes T&C checkbox/link from sign-up flow and admin Create User form
- No changes to `DeepracerEventManagerStack`, the pipeline stage, or any cross-stack
  references — existing `Fn::ImportValue` dependencies are untouched

### What PR 2 does (follow-up — requires two-pipeline migration run from PR 1)

- Switches `DeepracerEventManagerStack` to read all values from SSM instead of
  via `Fn::ImportValue`
- Removes T&C CDK infrastructure (S3 bucket, CloudFront distributions, pipeline step)
- Deploys infra before base so infra can drop `Fn::ImportValue` while base still exports

### What PR 3 does (one-liner after PR 2 is deployed)

- Restores `stack.addDependency(baseStack)` (base-first ordering) for ongoing development
- Ensures new SSM parameters created in BaseStack exist before infra reads them

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

This is a safe upgrade — the pipeline only **adds** 19 SSM parameters to the base
stack. No exports are removed, no cross-stack references change.

### Step 4 — Verify post-deploy state

#### SSM Parameter Store console

Open [SSM Parameter Store](https://console.aws.amazon.com/systems-manager/parameters)
and filter by `/drem-backend-<label>-base/`. Expect **19 parameters**:

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
| `defaultUserRole` | IAM Role ARN |
| `regionalWafWebAclArn` | WAF Web ACL ARN |
| `appsyncHelpersLambdaLayerArn` | Lambda Layer ARN |
| `helperFunctionsLambdaLayerArn` | Lambda Layer ARN |
| `powertoolsLambdaLayerArn` | Lambda Layer ARN |

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

### Step 5 — Continue to PR 2

See [`docs/testing-ssm-cross-stack-migration-pr2.md`](testing-ssm-cross-stack-migration-pr2.md)
for the PR 2 and PR 3 migration steps.

---

## Key Files Changed (PR 1)

| File | What changed |
|------|-------------|
| `lib/base-stack.ts` | Writes 19 SSM parameters at end of constructor |
| `lib/constructs/cdn.ts` | Added `comment` prop for CloudFront distribution descriptions |
| `lib/constructs/leaderboard.ts` | Passes `comment` to Cdn construct |
| `lib/constructs/streaming-overlay.ts` | Passes `comment` to Cdn construct |
| `website/src/App.tsx` | Removed T&C checkbox and footer link from sign-up flow |
| `website/src/admin/users/createUser.tsx` | Removed T&C checkbox from Create User form |
| `website/public/locales/en/translation.json` | Removed T&C translation strings |
| `scripts/generate_amplify_config_cfn.py` | Removed `termsAndConditionsUrl` from config |
| `tsconfig.json` | Exclude `website*/` subdirs from CDK `tsc` compilation |
| `test/deepracer-event-manager.test.ts` | CDK assertion test for the SSM parameters |
| `jest.config.ts` | Converted from `.js` to `.ts` |
| `Makefile` | `make drem.clean`, Python venv fixes, `make test.cdk`, `--require-approval never` |
| `CLAUDE.md` | Project overview, commands, and architecture notes |
