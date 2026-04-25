# Async PDF Generation Design Spec

**Date:** 2026-04-20
**Feature:** Task #48 — Race Results PDF (async pivot)
**Status:** Design approved by user

## Problem

The current `generateRaceResultsPdf` AppSync mutation runs the entire PDF render synchronously on a Lambda resolver. Diagnostic logs from a 52-racer bulk certificate run show:

- Total Lambda duration: 42.4s (Init 3.2s + work 37.6s)
- First cert: 3.9s (fontconfig cache miss despite `fc-cache -sf` in Dockerfile)
- Warm per-cert: avg 724ms, min 586ms, WeasyPrint floor ~600ms
- Peak memory: 190MB / 1024MB — memory is not the bottleneck

AppSync Lambda resolvers have a **hard 30s timeout** that cannot be lifted. At ~36 racers the sync flow begins to fail; at 52 it always fails. Even with warm cache on the happy path, the flow is one event-size away from the cliff.

## Goal

Replace the sync flow with an async job pattern that scales to any event size (up to the 15-minute Lambda timeout — well beyond realistic racer counts). All 4 PDF types (`ORGANISER_SUMMARY`, `PODIUM`, `RACER_CERTIFICATE`, `RACER_CERTIFICATES_BULK`) go through the same flow for UI consistency.

## Pattern

Follows DREM's existing "long-running job" convention used by `models-manager-car-upload-step-function.ts` and `car-logs-fetch.ts`:

- DynamoDB jobs table holds job state (PK = jobId, TTL-expired)
- A `start*` mutation writes a PENDING row and kicks off a worker
- Worker writes final state via an IAM-authed `update*` mutation
- `update*` mutation triggers an AppSync subscription the client is already listening to
- Frontend gets push updates via subscription, no polling

We diverge from those two flows in one deliberate way: they use Step Functions for genuine multi-step orchestration (create row → invoke SSM → poll SSM). Our flow is single-step (render → upload → update row). We use a direct async Lambda invoke (`InvocationType=Event`) instead of Step Functions, matching `delete_user_function`'s pattern.

## Architecture

```
Frontend                  AppSync                Lambda                    DynamoDB    S3
   │                         │                     │                         │         │
   │──generateRaceResultsPdf▶│                     │                         │         │
   │                         │──resolver invoke───▶│ orchestrator            │         │
   │                         │                     │──PutItem PENDING───────▶│         │
   │                         │                     │──InvocationType=Event──▶│ worker  │
   │◀─PdfJob {PENDING}───────│◀────────────────────│                         │  Lambda │
   │                         │                     │                         │         │
   │──subscribe onPdfJobUpdated(jobId)─────────────▶│                        │         │
   │                         │                     │   worker ──render───────┼────────▶│
   │                         │                     │   worker ──updatePdfJob▶│         │
   │                         │◀──UpdateItem────────│   worker                │         │
   │◀─onPdfJobUpdated────────│                     │                         │         │
   │  (SUCCESS pushed)       │                     │                         │         │
   │──getPdfJob(jobId)──────▶│──resolver: GetItem + gen pre-signed URL──────▶│         │
   │◀─{downloadUrl}──────────│                     │                         │         │
   │──auto-download──────────────────────────────────────────────────────────────────▶ │
```

### Component boundaries

- **Orchestrator Lambda** — AppSync resolver for `generateRaceResultsPdf`. Validates the request (cognito groups, racer self-service for `RACER_CERTIFICATE`), writes the PENDING row, fires the worker via `lambda:InvokeAsync(InvocationType=Event)`, returns the jobId. Target <100ms.
- **Worker Lambda** — invoked async by the orchestrator. Shares the container image with the orchestrator (different `CMD` override). Wraps all work in try/except: on success writes `{status: SUCCESS, s3Key, filename}` via the IAM-authed `updatePdfJob` mutation; on failure writes `{status: FAILED, error}`. No direct DDB writes — always via AppSync so the subscription fires automatically.
- **`updatePdfJob` mutation** — unit VTL resolver on a DynamoDB data source. `@aws_iam` only. Triggers `onPdfJobUpdated` subscription as a side effect.
- **`getPdfJob(jobId)` query** — Lambda resolver. Reads the row, enforces `createdBy == caller.sub` (admin/operator/commentator bypass), generates a fresh 1-hour pre-signed URL from `s3Key` each time. Pre-signed URLs are never stored in the row — always computed on read so they're always fresh.
- **`onPdfJobUpdated(jobId)` subscription** — standard AppSync subscription keyed on the `updatePdfJob` mutation. Cognito auth; subscription filter is jobId, which the client only knows because the mutation just returned it.

## Data model

### DynamoDB `PdfJobsTable`

| Attribute | Type | Notes |
|-----------|------|-------|
| `jobId` | string (PK) | UUID v4 |
| `status` | string | `PENDING` \| `SUCCESS` \| `FAILED` |
| `type` | string | `ORGANISER_SUMMARY` \| `PODIUM` \| `RACER_CERTIFICATE` \| `RACER_CERTIFICATES_BULK` |
| `eventId` | string | |
| `userId` | string | Optional — only for `RACER_CERTIFICATE` |
| `trackId` | string | Optional — organiser/podium filter |
| `s3Key` | string | Populated on SUCCESS |
| `filename` | string | Populated on SUCCESS |
| `error` | string | Populated on FAILED, truncated to 500 chars |
| `createdBy` | string | Cognito sub of requester |
| `createdAt` | string | ISO-8601 UTC |
| `completedAt` | string | ISO-8601 UTC, populated on SUCCESS/FAILED |
| `ttl` | number | Epoch seconds = `createdAt + 86400` (1-day retention matching S3 lifecycle) |

Config: `PAY_PER_REQUEST`, AWS-managed encryption, PITR off, TTL attribute set to `ttl`.

### GraphQL schema

```graphql
enum PdfJobStatus { PENDING SUCCESS FAILED }

# Existing — unchanged:
# enum PdfType { ORGANISER_SUMMARY PODIUM RACER_CERTIFICATE RACER_CERTIFICATES_BULK }

type PdfJob @aws_cognito_user_pools(cognito_groups: ["admin","operator","commentator","racer"]) {
  jobId: ID!
  status: PdfJobStatus!
  type: PdfType!
  eventId: ID!
  userId: ID
  trackId: ID
  filename: String
  downloadUrl: String        # computed in getPdfJob resolver, null in subscription payload
  error: String
  createdBy: ID!
  createdAt: AWSDateTime!
  completedAt: AWSDateTime
}

type Mutation {
  # REPLACES today's generateRaceResultsPdf. Return type changes from PdfGenerationResult to PdfJob.
  generateRaceResultsPdf(
    eventId: ID!
    type: PdfType!
    userId: ID
    trackId: ID
  ): PdfJob @aws_cognito_user_pools(cognito_groups: ["admin","operator","commentator","racer"])

  # Worker-only. IAM auth. Triggers onPdfJobUpdated subscription.
  updatePdfJob(
    jobId: ID!
    status: PdfJobStatus!
    s3Key: String
    filename: String
    error: String
  ): PdfJob @aws_iam
}

type Query {
  getPdfJob(jobId: ID!): PdfJob
    @aws_cognito_user_pools(cognito_groups: ["admin","operator","commentator","racer"])
}

type Subscription {
  onPdfJobUpdated(jobId: ID!): PdfJob
    @aws_subscribe(mutations: ["updatePdfJob"])
    @aws_cognito_user_pools(cognito_groups: ["admin","operator","commentator","racer"])
}
```

### Auth rules

| Endpoint | Auth | Additional checks |
|----------|------|-------------------|
| `generateRaceResultsPdf` | Cognito (admin/operator/commentator/racer) | For `RACER_CERTIFICATE`: reject unless caller.sub == userId OR caller is admin/operator/commentator |
| `updatePdfJob` | IAM | Only callable by worker Lambda role |
| `getPdfJob` | Cognito (same groups) | Row must be `createdBy == caller.sub` OR caller in admin/operator/commentator |
| `onPdfJobUpdated(jobId)` | Cognito (same groups) | jobId arg is the filter; client only knows it because the mutation returned it |

## CDK construct (`lib/constructs/race-results-pdf.ts`)

Extends the existing construct:

1. **New `PdfJobsTable` DynamoDB table** — config per Data Model section.
2. **Rename existing `pdfLambda` → `orchestratorLambda`** — same container image, adds `PDF_JOBS_TABLE` and `WORKER_FUNCTION_NAME` env vars. Timeout drops to 30s; memory drops to 512MB (only does fast work now).
3. **New `workerLambda`** — **same container image asset** (`lambda.DockerImageCode.fromImageAsset('lib/lambdas/pdf_api', ...)`) with `cmd: ['worker.lambda_handler']`. Timeout 15min, memory 1024MB. Env includes `APPSYNC_ENDPOINT` and `APPSYNC_REGION` for the IAM-signed callback.
4. **`getPdfJobLambda`** — same container image, `cmd: ['get_pdf_job.lambda_handler']`. Timeout 10s, memory 256MB.
5. **IAM wiring**:
   - Orchestrator: `PdfJobsTable.grantWriteData`, `workerLambda.grantInvoke`, existing S3/race/events/Cognito grants.
   - Worker: `PdfJobsTable.grantReadData`, `pdfBucket.grantReadWrite`, existing race/events/Cognito grants, `appsync:GraphQL` on `graphqlApi.arn/types/Mutation/fields/updatePdfJob` only.
   - `getPdfJobLambda`: `PdfJobsTable.grantReadData`, `pdfBucket.grantRead` (for presigned URL generation).
6. **AppSync**:
   - Existing `PdfDataSource` (orchestrator Lambda) — resolves `generateRaceResultsPdf`.
   - New `PdfJobsDataSource` (DynamoDB) — resolves `updatePdfJob` via unit VTL resolver.
   - New `GetPdfJobDataSource` (getPdfJobLambda) — resolves `Query.getPdfJob`.
7. **S3 bucket** — unchanged (1-day lifecycle + block public + access logs).

## Backend Lambda code

Container image at `lib/lambdas/pdf_api/` — one new file and a light restructure. All three Lambdas share the image; each has a different `CMD` override.

```
lib/lambdas/pdf_api/
├── Dockerfile              # unchanged
├── requirements.txt        # unchanged
├── render.py               # unchanged (WeasyPrint wrapper)
├── race_summary.py         # unchanged (ranking logic)
├── templates/              # unchanged
├── shared.py            *  # NEW — shared helpers (see below)
├── index.py             *  # orchestrator handler, much shorter
├── worker.py            *  # NEW — worker handler
└── get_pdf_job.py       *  # NEW — getPdfJob resolver handler
```

### `shared.py` contents (moved out of today's `index.py`)

- `_replace_decimal_with_float`
- `_get_event`, `_get_races`, `_lookup_user`, `_build_summaries`, `_default_brand`, `_format_lap`, `_s3_key`
- `_render_organiser`, `_render_podium`, `_render_certificate`, `_render_bulk_zip`
- `_enforce_racer_self_service`
- `_requester_identity` (used by both orchestrator and getPdfJob)

### `index.py` (orchestrator) — ~60 lines

```python
@app.resolver(type_name="Mutation", field_name="generateRaceResultsPdf")
def generate_race_results_pdf(eventId, type, userId=None, trackId=None):
    requester = _requester_identity()
    if type == "RACER_CERTIFICATE":
        if not userId:
            raise ValueError("userId is required for RACER_CERTIFICATE")
        _enforce_racer_self_service(requester, userId)

    job_id = str(uuid.uuid4())
    now = dt.datetime.utcnow()
    item = {
        "jobId": job_id, "status": "PENDING", "type": type,
        "eventId": eventId, "userId": userId, "trackId": trackId,
        "createdBy": requester["sub"],
        "createdAt": now.isoformat() + "Z",
        "ttl": int((now + dt.timedelta(days=1)).timestamp()),
    }
    _jobs_table.put_item(Item=item)
    _lambda.invoke(
        FunctionName=WORKER_FUNCTION_NAME,
        InvocationType="Event",
        Payload=json.dumps({"jobId": job_id}),
    )
    return {**item, "downloadUrl": None, "error": None, "completedAt": None}
```

### `worker.py`

```python
def lambda_handler(event, context):
    job_id = event["jobId"]
    job = _jobs_table.get_item(Key={"jobId": job_id})["Item"]
    try:
        pdf_bytes, filename, s3_key = _render_for_job(job)
        _s3.put_object(
            Bucket=PDF_BUCKET, Key=s3_key, Body=pdf_bytes,
            ContentType="application/zip" if filename.endswith(".zip") else "application/pdf",
        )
        _call_update_pdf_job(job_id, "SUCCESS", s3Key=s3_key, filename=filename)
    except Exception as e:
        logger.exception("PDF render failed")
        _call_update_pdf_job(job_id, "FAILED", error=str(e)[:500])

def _call_update_pdf_job(job_id, status, **fields):
    query = """mutation U($jobId:ID!,$status:PdfJobStatus!,$s3Key:String,$filename:String,$error:String){
      updatePdfJob(jobId:$jobId,status:$status,s3Key:$s3Key,filename:$filename,error:$error){jobId}
    }"""
    _appsync_iam_request(query, {"jobId": job_id, "status": status, **fields})
```

`_render_for_job(job)` dispatches to the right helper based on `job["type"]` and returns `(pdf_bytes, filename, s3_key)`.

### `get_pdf_job.py`

```python
@app.resolver(type_name="Query", field_name="getPdfJob")
def get_pdf_job(jobId):
    requester = _requester_identity()
    job = _jobs_table.get_item(Key={"jobId": jobId}).get("Item")
    if not job:
        return None
    if requester["sub"] != job["createdBy"] and not (requester["groups"] & ADMIN_GROUPS):
        raise PermissionError("Not your PDF job")
    result = _replace_decimal_with_float(job)
    if job["status"] == "SUCCESS":
        result["downloadUrl"] = _s3.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": PDF_BUCKET, "Key": job["s3Key"],
                "ResponseContentDisposition": f'attachment; filename="{job["filename"]}"',
            },
            ExpiresIn=URL_EXPIRY_SECONDS,
        )
    return result
```

### Error handling

- Worker wraps all render + upload work in try/except.
- On exception: truncated message (≤500 chars, no stack trace) written to `error` via `updatePdfJob(status=FAILED)`.
- Relies on **Lambda's default async retry policy (2 retries)** for transient errors (throttling, cold-start timeouts). No custom retry logic in the worker itself — if all three attempts fail, the job stays PENDING and TTL cleans it up in 24h.
- **Client-side timeout for stuck jobs:** if `useGeneratePdf` has been waiting 5 minutes without a subscription update, it replaces the spinner flashbar with an error variant *"PDF generation timed out — please try again"* and clears the job from local state. The Lambda may still complete in the background; the user just doesn't see the result. Five minutes is comfortably above the worst-case worker duration (Lambda timeout is 15min but we don't expect jobs to approach that).
- No DLQ for v1. If worker consistently fails for a specific event, CloudWatch alarms on worker Lambda errors will surface it.

## Frontend

### `useGeneratePdf` hook

Location: `website/src/hooks/useGeneratePdf.ts` (new).

```typescript
const { generatePdf, jobs } = useGeneratePdf();
// jobs: Record<jobId, { status, type, eventId, userId?, trackId? }>

await generatePdf({ eventId, type, userId?, trackId? });
```

Internal flow:

1. Call `generateRaceResultsPdf` mutation. Receive `{ jobId, status: 'PENDING' }`.
2. Add CloudScape `<Flashbar>` item: *"Generating {type}…"* (spinner icon, dismissible).
3. Open AppSync subscription `onPdfJobUpdated(jobId)`.
4. Record the job in local state so the UI can disable the corresponding button until PENDING clears.
5. On subscription event:
   - `status === 'SUCCESS'` → call `getPdfJob(jobId)` query, trigger download via `<a download href={downloadUrl}>` click, replace flashbar with success variant *"Downloaded {filename}"* (auto-dismiss 5s).
   - `status === 'FAILED'` → replace flashbar with error variant showing `error` (persistent, manual dismiss).
6. Unsubscribe, remove job from local state, re-enable button.

### Component changes

- Buttons live in `website/src/pages/events/raceResultsPdfButtons.tsx` (exact path confirmed during implementation).
- Replace today's "await mutation and act on downloadUrl" code with `await generatePdf(...)`.
- Button disabled state keyed on `(eventId, type, userId ?? '-', trackId ?? '-')` — one click per (event, type, target) while PENDING. Different types or different racers can run in parallel.
- Flashbar rendered at page level (CloudScape convention).

### i18n (`website/src/i18n/`)

New strings in all six languages (de, en, es, fr, jp, se):
- `pdf.generating` — "Generating {{type}}…"
- `pdf.ready` — "Downloaded {{filename}}"
- `pdf.failed` — "PDF generation failed: {{error}}"
- `pdf.timedOut` — "PDF generation timed out — please try again"
- `pdf.type.ORGANISER_SUMMARY` — "organiser summary"
- `pdf.type.PODIUM` — "podium"
- `pdf.type.RACER_CERTIFICATE` — "racer certificate"
- `pdf.type.RACER_CERTIFICATES_BULK` — "certificate pack"

### No state persistence

Job state is in-memory only. Closing/reloading the tab drops the flashbar. In-flight Lambdas run to completion regardless; the S3 object still lands. User who reloads loses visibility of the toast but can click "Generate" again — the previous PDF is available via its S3 key for 24h if they somehow have the link (we won't expose it). YAGNI on a `listPdfJobs` query; add later if users complain.

## Testing

### Backend (pytest)

- `test_orchestrator_validates_racer_self_service` — racer sub != userId → `PermissionError`.
- `test_orchestrator_writes_pending_row_and_invokes_worker` — mocked DDB + Lambda client; assert PutItem payload and Lambda invoke call.
- `test_worker_success_path` — mocked render + S3 + AppSync; assert `updatePdfJob(SUCCESS)` called with s3Key/filename.
- `test_worker_failure_path` — render helper raises; assert `updatePdfJob(FAILED, error=...)` called with truncated message.
- `test_get_pdf_job_denies_other_racer` — row.createdBy != caller.sub, not admin → `PermissionError`.
- `test_get_pdf_job_returns_fresh_url_on_success` — row.status=SUCCESS → downloadUrl populated; status=PENDING → downloadUrl null.

### Frontend (Vitest)

- `useGeneratePdf.test.ts`:
  - Happy path — mutation resolves, subscription fires SUCCESS, `getPdfJob` returns URL, download triggered, flashbar transitions.
  - Failure path — subscription fires FAILED, error flashbar appears, no download.
  - Button disable — two calls with same (event, type, target) rejected until first clears.
- Component test for page with two buttons — verify both can run in parallel, and second click on the same button is disabled while PENDING.

### Manual smoke test (post-deploy)

1. Organiser summary on a small event — PDF downloads in ~5s.
2. Podium on the same event — PDF downloads.
3. Racer certificate for self (non-admin racer) — downloads.
4. Racer certificate for someone else (non-admin racer) — rejected with permission error.
5. Bulk certs on the 52-racer event — flashbar spinner, 40-ish seconds, ZIP downloads cleanly.
6. Bulk certs on a much bigger event (100+ racers) — completes without timeout; no client-side failure.

## Open items / deferred

- **`listPdfJobs` query + restore-on-load** — deferred. Add if users report losing jobs across reloads.
- **Dead-letter queue for worker failures** — deferred. Lambda's built-in retries + CloudWatch alarms sufficient for v1.
- **Rate limiting / cost controls** — deferred. If users bulk-click to DoS the renderer, AppSync quota + Lambda concurrency will cap blast radius; can add a per-user in-flight cap later.

## Migration

The existing sync `generateRaceResultsPdf` mutation's return type is changing from `PdfGenerationResult` to `PdfJob` — a **breaking change** for any client. Only the DREM frontend consumes it today, and the frontend will be updated in the same PR. No staged migration needed.

The `PdfGenerationResult` type is removed from the schema.
