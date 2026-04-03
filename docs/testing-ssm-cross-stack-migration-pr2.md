# SSM Migration — PR 2 and PR 3 Testing Guide

> Run this **after** PR 1 (`feat/ssm-cross-stack-sharing`) has been deployed and confirmed
> working. See [`testing-ssm-cross-stack-migration.md`](testing-ssm-cross-stack-migration.md)
> for PR 1 steps.

---

## PR 2 — Switch infra to SSM, remove T&C CDK infrastructure

PR 2 (`feat/ssm-infra-migration`) does two things:

1. Switches `DeepracerEventManagerStack` to read all shared values from SSM Parameter Store
   instead of `Fn::ImportValue`
2. Removes the T&C CDK infrastructure (S3 bucket, CloudFront distribution, pipeline step)

### Why a single pipeline run cannot do both at once

With `Fn::ImportValue`, CloudFormation enforces: a stack cannot remove an export while
another stack still imports it. If base and infra updated in the same pipeline run with
base deploying first, the error would be:

```
Delete canceled. Cannot delete export drem-backend-X-base:ExportsOutput...
as it is in use by drem-backend-X-infrastructure.
```

PR 2 solves this with **infra-first** pipeline ordering (`baseStack.addDependency(stack)`):

- **Infra deploys first** — drops all `Fn::ImportValue` references, reads from SSM instead.
  SSM parameters already exist from PR 1, so CloudFormation can resolve them at changeset
  creation time.
- **Base deploys second** — can now safely remove the `CfnOutput` exports and T&C
  resources because infra no longer imports them.

### Deploy PR 2

Update `build.config`:

```
source_repo = <your-fork>/guidance-for-aws-deepracer-event-management
source_branch = feat/ssm-infra-migration
```

```sh
make install
```

Approve `DeployDREM` when prompted. Expected: 45–90 min.

Watch the pipeline stage order — `infrastructure.deploy` must complete before
`base.deploy` starts. This is the key difference from normal runs.

### Verify post-deploy state

#### No Fn::ImportValue in infra

```sh
aws cloudformation get-template \
  --stack-name drem-backend-<label>-infrastructure \
  --region <region> \
  --query 'TemplateBody' \
  --output json \
  | python3 -c "
import json, sys
t = json.load(sys.stdin)
count = sum(1 for r in t.get('Resources', {}).values() if 'Fn::ImportValue' in json.dumps(r))
print(f'Fn::ImportValue count: {count}')
"
# Expected: Fn::ImportValue count: 0
```

#### No CloudFormation exports from base

```sh
aws cloudformation list-exports \
  --region <region> \
  --query 'Exports[?contains(Name, `drem-backend-<label>`)].Name' \
  --output table
# Expected: empty table
```

#### SSM parameters still present

```sh
aws ssm get-parameters-by-path \
  --path /drem-backend-<label>-base/ \
  --region <region> \
  --query 'length(Parameters)' \
  --output text
# Expected: 19
```

#### Functional checks

> **Verify:**
> - Website accessible and functional
> - T&C page no longer accessible (CloudFront distribution removed)
> - Sign-up and Create User still have no T&C checkbox

---

## PR 3 — Restore base-first pipeline ordering

PR 3 (`feat/restore-base-first-ordering`) is a one-line change: it restores
`stack.addDependency(baseStack)` so that base deploys before infrastructure in all
future pipeline runs.

This is necessary for ongoing development: when a new SSM parameter is added to
`BaseStack` and consumed by `DeepracerEventManagerStack` in the same PR, base must
deploy first so the parameter exists when CloudFormation resolves it for infra's
changeset.

### Deploy PR 3

Update `build.config`:

```
source_repo = <your-fork>/guidance-for-aws-deepracer-event-management
source_branch = feat/restore-base-first-ordering
```

```sh
make install
```

Approve `DeployDREM` when prompted. Both stacks will show no resource changes —
only the pipeline ordering updates. Expected: 30–60 min (mostly pipeline self-mutation).

### Verify

```sh
aws cloudformation describe-stacks \
  --stack-name drem-backend-<label>-infrastructure \
  --region <region> \
  --query 'Stacks[0].StackStatus' \
  --output text
# Expected: UPDATE_COMPLETE

aws cloudformation describe-stacks \
  --stack-name drem-backend-<label>-base \
  --region <region> \
  --query 'Stacks[0].StackStatus' \
  --output text
# Expected: UPDATE_COMPLETE
```

The migration is complete. All future deployments will use SSM for cross-stack sharing
with base deploying before infrastructure.
