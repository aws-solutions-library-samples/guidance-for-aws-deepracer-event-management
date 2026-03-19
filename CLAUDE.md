# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AWS DeepRacer Event Manager (DREM) — a full-stack event management platform for running AWS DeepRacer autonomous vehicle racing events. It consists of a React admin SPA, a public leaderboard SPA, a streaming overlays SPA, and AWS CDK infrastructure deploying a serverless AWS backend.

## Commands

### CDK Infrastructure (root)
```sh
npm run build        # Compile TypeScript CDK code
npm test             # Run CDK unit tests (Jest)
```

### Main Website (`website/`)
```sh
npm start            # Vite dev server on port 3000
npm run build        # Type-check + Vite build
npm test             # Vitest (single pass)
npm run test:watch   # Vitest (watch mode)
```
Run a single test file: `npx vitest run src/path/to/file.test.tsx`

### Leaderboard (`website-leaderboard/`) / Overlays (`website-stream-overlays/`)
```sh
npm start            # Vite dev server (leaderboard: 3001, overlays: 3002)
npm run build        # Type-check + Vite build
npm run lint         # ESLint
```

### Makefile shortcuts
```sh
make test            # Run main website tests
make local.run       # Start main website (port 3000)
make local.run-leaderboard   # Start leaderboard (port 3001)
make local.run-overlays      # Start overlays (port 3002)
make local.config    # Pull CloudFormation outputs + regenerate Amplify configs
make manual.deploy   # Deploy all CDK stacks directly (no pipeline)
make manual.deploy.hotswap   # Fast Lambda/asset hotswap redeploy
```

### Local dev setup
Before running locally, `make local.config` must be run against a deployed stack to generate `aws-exports.json` for all three websites (uses `scripts/generate_amplify_config.py`).

### Python Lambda development
```sh
make local.config.python     # Create venv + pip install -e .[dev]
pytest                        # Run Python tests
```

## Architecture

### Two CDK Stacks (deployed via `lib/`)
1. **BaseStack** (`drem-backend-<label>-base`) — WAF, CloudFront for main site, Cognito User Pool + Identity Pool, EventBridge custom bus, shared Lambda layers, optional Route53/ACM
2. **DeepracerEventManagerStack** (`drem-backend-<label>-infrastructure`) — everything else; all domain constructs attach their types/resolvers to a single **AppSync GraphQL API**

**Deployment pipeline** (`CdkPipelineStack`) — self-mutating AWS CodePipeline pulling from GitHub; builds all three React apps and deploys both stacks. Configured via `build.config`.

### Backend Pattern
- All backend logic is **Python 3.12 ARM64 Lambda**, using AWS Lambda Powertools (`@tracer`, `@logger`, `AppSyncResolver`)
- Each domain construct (e.g. `RaceManager`, `ModelsManager`) appends its own GraphQL types/queries/mutations to the AppSync schema using `awscdk-appsync-utils` — the schema is code-first
- DynamoDB is used per domain (separate tables); Lambda resolvers handle all CRUD
- AppSync auth: **Cognito User Pool** (default), **API Key** (public leaderboard/overlays), **IAM** (Lambda-to-Lambda)
- Inter-service events flow through an **EventBridge custom bus**

### Frontend (`website/`)
- **Entry:** `src/App.tsx` — configures Amplify v6, initialises CloudWatch RUM, wraps app in Cognito `Authenticator`
- **UI:** [AWS CloudScape Design System](https://cloudscape.design/) throughout
- **Routing:** React Router v6, driven by `TopNav` with a side navigation
- **State:** Custom context-based store (`src/store/`) with domain stores: `usersStore`, `racesStore`, `modelsStore`, `carsStore`, `eventsStore`, `fleetsStore`, `assetsStore`
- **API layer:** Custom hooks per domain (`useCarsApi`, `useModelsApi`, `useRacesApi`, etc.) calling AppSync via Amplify v6
- **Timekeeper feature** (`src/pages/timekeeper/`) — the core race-management UI; uses an **XState v4** state machine (`ReadyToStartRace → RaceStarted → RaceIsOver`) to manage race flow
- **i18n:** i18next with translations in `src/i18n/` (de, en, es, fr, jp, se)

### Cognito User Groups / Roles
`admin`, `operator`, `commentator`, `registration`, `racer` — access control is enforced both in IAM (via group roles) and in AppSync resolvers.

### Public Frontends
- **Leaderboard** (`website-leaderboard/`) — unauthenticated, subscribes to AppSync via API key for live data; supports URL query params for display (lang, QR, track, format, flag)
- **Stream Overlays** (`website-stream-overlays/`) — unauthenticated, API key auth; uses D3.js for animated visualisations; supports chroma key background for broadcast use
