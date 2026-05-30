# Pico W Galactic Unicorn — DREM Companion Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a DREM admin portal page (Beta) that surfaces AppSync connection details and generates a pre-filled `config.json` for the Pico LED display.

**Architecture:** Pure `generateConfig` function (testable) is separated from the page component. The API key is added to the main website's Amplify config so the page can read it without an extra network call. The page reads the event store for event/track selection and generates the download client-side.

**Tech Stack:** TypeScript, React, CloudScape Design System, Vitest + Testing Library, i18next.

**Spec:** `docs/superpowers/specs/2026-03-22-pico-display-design.md` — DREM Companion Page section.

---

## File Map

| File | Created/Modified | Responsibility |
|------|-----------------|----------------|
| `scripts/generate_amplify_config_cfn.py` | Modify | Read `appsyncApiKey` from cfn.outputs, write to website config |
| `website/src/App.tsx` | Modify | Add `aws_appsync_apiKey` to `LegacyConfig.API` interface; add route |
| `website/src/admin/picoDisplay.tsx` | Create | Page component: connection details + config generator form |
| `website/src/admin/picoDisplay.test.tsx` | Create | Vitest tests for `generateConfig` and download trigger |
| `website/src/components/topNav.tsx` | Modify | Add "Pico LED Display" Beta nav entry under Device Management |
| `website/public/locales/en/translation.json` | Modify | Add nav and page i18n strings |
| `website/public/locales/en/help-admin-pico-display.json` | Create | Help panel content |

---

## Task 1: Surface API key in website Amplify config

**Files:**
- Modify: `scripts/generate_amplify_config_cfn.py`
- Modify: `website/src/App.tsx`

The AppSync API key is already read in `scripts/generate_leaderboard_amplify_config_cfn.py` from `cfn.outputs`. Add the same read to the main website config script so the admin page can access it via `awsconfig`.

- [ ] **Step 1: Update `generate_amplify_config_cfn.py` to read and write the API key**

Current file at `scripts/generate_amplify_config_cfn.py`. Find the loop that reads `cfn.outputs` and add:

```python
if key["OutputKey"] == "appsyncApiKey":
    appsyncApiKey = key["OutputValue"]
```

Then add `aws_appsync_apiKey` to the `output_data["API"]` dict:

```python
"aws_appsync_apiKey": appsyncApiKey,
```

The final `output_data["API"]` block should be:

```python
"API": {
    "aws_appsync_graphqlEndpoint": appsyncEndpoint,
    "aws_appsync_region": region,
    "aws_appsync_authenticationType": "AMAZON_COGNITO_USER_POOLS",
    "aws_appsync_apiKey": appsyncApiKey,
},
```

- [ ] **Step 2: Update `LegacyConfig` interface in `website/src/App.tsx`**

Find the `LegacyConfig` interface (line ~43). The `API` block currently has 3 fields. Add the 4th:

```typescript
API: {
  aws_appsync_graphqlEndpoint: string;
  aws_appsync_region: string;
  aws_appsync_authenticationType: string;
  aws_appsync_apiKey: string;    // ← add this line
};
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd website && npm run build 2>&1 | tail -20
```
Expected: no TypeScript errors (build may warn about other things but must not fail on the new field)

- [ ] **Step 4: Commit**

```bash
git add scripts/generate_amplify_config_cfn.py website/src/App.tsx
git commit -m "feat(pico-page): add appsyncApiKey to main website Amplify config"
```

---

## Task 2: `generateConfig` pure function + tests

This function is the core business logic: it takes form values and connection details and returns a `config.json` object. Extract it as a standalone exported function so it can be tested in isolation — do not embed it in the component.

**Files:**
- Create: `website/src/admin/picoDisplay.tsx` (just the `generateConfig` function for now)
- Create: `website/src/admin/picoDisplay.test.tsx`

- [ ] **Step 1: Write the failing tests**

`website/src/admin/picoDisplay.test.tsx`:
```typescript
import { describe, it, expect } from 'vitest';
import { generateConfig } from './picoDisplay';

const CONNECTION = {
  endpoint: 'https://xxx.appsync-api.eu-west-1.amazonaws.com/graphql',
  apiKey: 'da2-abc123',
  region: 'eu-west-1',
};

const FORM = {
  eventId: 'uuid-event-1',
  trackId: '2',
  raceFormat: 'fastest' as const,
  brightness: 0.5,
  scrollSpeed: 40,
  pollInterval: 30,
  topN: 5,
};

describe('generateConfig', () => {
  it('populates appsync block from connection details', () => {
    const cfg = generateConfig(CONNECTION, FORM);
    expect(cfg.appsync.endpoint).toBe(CONNECTION.endpoint);
    expect(cfg.appsync.api_key).toBe(CONNECTION.apiKey);
    expect(cfg.appsync.region).toBe(CONNECTION.region);
  });

  it('populates event block from form values', () => {
    const cfg = generateConfig(CONNECTION, FORM);
    expect(cfg.event.event_id).toBe('uuid-event-1');
    expect(cfg.event.track_id).toBe('2');
    expect(cfg.event.race_format).toBe('fastest');
  });

  it('populates display block with defaults', () => {
    const cfg = generateConfig(CONNECTION, FORM);
    expect(cfg.display.brightness).toBe(0.5);
    expect(cfg.display.scroll_speed).toBe(40);
    expect(cfg.display.leaderboard_poll_interval).toBe(30);
    expect(cfg.display.leaderboard_top_n).toBe(5);
  });

  it('includes all default race_items', () => {
    const cfg = generateConfig(CONNECTION, FORM);
    expect(cfg.display.race_items).toEqual([
      'time_remaining',
      'laps_completed',
      'fastest_lap',
      'last_lap',
      'resets',
    ]);
  });

  it('wifi block contains placeholder values', () => {
    const cfg = generateConfig(CONNECTION, FORM);
    expect(cfg.wifi.ssid).toBe('YourNetworkName');
    expect(cfg.wifi.password).toBe('YourWiFiPassword');
  });

  it('average race_format is accepted', () => {
    const cfg = generateConfig(CONNECTION, { ...FORM, raceFormat: 'average' });
    expect(cfg.event.race_format).toBe('average');
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
cd website && npx vitest run src/admin/picoDisplay.test.tsx 2>&1 | tail -20
```
Expected: error — `picoDisplay.tsx` does not exist

- [ ] **Step 3: Create `picoDisplay.tsx` with just the `generateConfig` function**

`website/src/admin/picoDisplay.tsx`:
```typescript
import React from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PicoConnection {
  endpoint: string;
  apiKey: string;
  region: string;
}

export interface PicoFormValues {
  eventId: string;
  trackId: string;
  raceFormat: 'fastest' | 'average';
  brightness: number;
  scrollSpeed: number;
  pollInterval: number;
  topN: number;
}

export interface PicoConfig {
  wifi: { ssid: string; password: string };
  appsync: { endpoint: string; api_key: string; region: string };
  event: { event_id: string; track_id: string; race_format: string };
  display: {
    brightness: number;
    scroll_speed: number;
    leaderboard_poll_interval: number;
    leaderboard_top_n: number;
    race_items: string[];
  };
}

// ---------------------------------------------------------------------------
// Pure business logic (exported for testing)
// ---------------------------------------------------------------------------

export function generateConfig(conn: PicoConnection, form: PicoFormValues): PicoConfig {
  return {
    wifi: {
      ssid: 'YourNetworkName',
      password: 'YourWiFiPassword',
    },
    appsync: {
      endpoint: conn.endpoint,
      api_key: conn.apiKey,
      region: conn.region,
    },
    event: {
      event_id: form.eventId,
      track_id: form.trackId,
      race_format: form.raceFormat,
    },
    display: {
      brightness: form.brightness,
      scroll_speed: form.scrollSpeed,
      leaderboard_poll_interval: form.pollInterval,
      leaderboard_top_n: form.topN,
      race_items: [
        'time_remaining',
        'laps_completed',
        'fastest_lap',
        'last_lap',
        'resets',
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Page component — stub (built out in Task 3)
// ---------------------------------------------------------------------------

export const AdminPicoDisplay: React.FC = () => {
  return <div>Pico Display</div>;
};
```

- [ ] **Step 4: Run tests — confirm all pass**

```bash
cd website && npx vitest run src/admin/picoDisplay.test.tsx 2>&1 | tail -20
```
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add website/src/admin/picoDisplay.tsx website/src/admin/picoDisplay.test.tsx
git commit -m "feat(pico-page): generateConfig pure function with tests"
```

---

## Task 3: i18n strings and help panel

**Files:**
- Modify: `website/public/locales/en/translation.json`
- Create: `website/public/locales/en/help-admin-pico-display.json`

- [ ] **Step 1: Add translation keys to `translation.json`**

Open `website/public/locales/en/translation.json`. Find the `"topnav"` object (around line 710) and add alongside `"timer-activation"`:

```json
"pico-display": "Pico LED Display"
```

Add a top-level `"pico-display"` section (at the root of the JSON object) for page strings:

```json
"pico-display": {
  "page-title": "Pico LED Display",
  "page-description": "Connect a Raspberry Pi Pico W + Pimoroni Galactic Unicorn to your DREM event.",
  "connection-title": "Connection Details",
  "connection-description": "Copy these values into your config.json, or use the generator below.",
  "endpoint-label": "AppSync Endpoint",
  "region-label": "Region",
  "api-key-label": "API Key",
  "copy-button": "Copy",
  "copied-button": "Copied!",
  "generate-title": "Generate config.json",
  "generate-description": "Select your event and track. Download the generated config.json and copy it to the Pico alongside the display code.",
  "event-label": "Event",
  "event-placeholder": "Select an event",
  "track-label": "Track",
  "track-placeholder": "Select a track",
  "race-format-label": "Race Format",
  "race-format-fastest": "Fastest lap",
  "race-format-average": "Average lap",
  "brightness-label": "Brightness",
  "scroll-speed-label": "Scroll Speed (px/s)",
  "poll-interval-label": "Leaderboard Poll Interval (s)",
  "top-n-label": "Leaderboard Top N",
  "download-button": "Download config.json",
  "code-title": "Get the Display Code",
  "code-description": "Clone or download the pico-display/ directory from the DREM GitHub repository, copy your config.json into it, then flash all files to the Pico using Thonny.",
  "wifi-note": "The wifi section (ssid/password) is left as placeholder — fill it in directly in config.json before copying to the Pico.",
  "github-link": "View pico-display/ on GitHub"
}
```

- [ ] **Step 2: Create the help panel file**

`website/public/locales/en/help-admin-pico-display.json`:
```json
{
  "header": "## Pico LED Display",
  "content": "This page helps you connect a **Raspberry Pi Pico W** with a **Pimoroni Galactic Unicorn** (53×11 LED matrix) to your DREM deployment.\n\n**Connection Details** shows your AppSync endpoint, region, and API key — copy these or use the config generator.\n\n**Generate config.json** creates a pre-filled configuration file for the selected event and track. Download it, add your WiFi credentials, and copy it to the Pico alongside the display code.",
  "footer": ""
}
```

- [ ] **Step 3: Commit**

```bash
git add website/public/locales/en/translation.json website/public/locales/en/help-admin-pico-display.json
git commit -m "feat(pico-page): add i18n strings and help panel content"
```

---

## Task 4: Build the page component

**Files:**
- Modify: `website/src/admin/picoDisplay.tsx` — replace the stub component with the full page

The page follows the exact same structure as `timerActivation.tsx`: `PageLayout` wrapper, `useStore` for events, CloudScape containers, no custom styling.

- [ ] **Step 1: Replace the stub `AdminPicoDisplay` component**

**Important:** The imports added in this step must be merged to the **top of the file**, replacing the `import React from 'react';` stub from Task 2. Do not add a second import block mid-file.

The complete final `picoDisplay.tsx` should look like this (types + `generateConfig` from Task 2, then the component):

```typescript
import React from 'react';
import {
  Box,
  Button,
  Container,
  FormField,
  Grid,
  Header,
  Input,
  Link,
  Select,
  SpaceBetween,
  StatusIndicator,
} from '@cloudscape-design/components';
import { useTranslation } from 'react-i18next';
import { SimpleHelpPanelLayout } from '../components/help-panels/simple-help-panel';
import { PageLayout } from '../components/pageLayout';
import { useStore } from '../store/store';
import { Breadcrumbs } from './fleets/support-functions/supportFunctions';
import awsconfig from '../config.json';

const cfg = awsconfig as any;

// ---------------------------------------------------------------------------
// Types (unchanged from Task 2)
// ---------------------------------------------------------------------------

export interface PicoConnection { endpoint: string; apiKey: string; region: string; }
export interface PicoFormValues {
  eventId: string; trackId: string; raceFormat: 'fastest' | 'average';
  brightness: number; scrollSpeed: number; pollInterval: number; topN: number;
}
export interface PicoConfig {
  wifi: { ssid: string; password: string };
  appsync: { endpoint: string; api_key: string; region: string };
  event: { event_id: string; track_id: string; race_format: string };
  display: { brightness: number; scroll_speed: number; leaderboard_poll_interval: number; leaderboard_top_n: number; race_items: string[] };
}

// ---------------------------------------------------------------------------
// Pure business logic (unchanged from Task 2)
// ---------------------------------------------------------------------------

export function generateConfig(conn: PicoConnection, form: PicoFormValues): PicoConfig {
  return {
    wifi: { ssid: 'YourNetworkName', password: 'YourWiFiPassword' },
    appsync: { endpoint: conn.endpoint, api_key: conn.apiKey, region: conn.region },
    event: { event_id: form.eventId, track_id: form.trackId, race_format: form.raceFormat },
    display: {
      brightness: form.brightness,
      scroll_speed: form.scrollSpeed,
      leaderboard_poll_interval: form.pollInterval,
      leaderboard_top_n: form.topN,
      race_items: ['time_remaining', 'laps_completed', 'fastest_lap', 'last_lap', 'resets'],
    },
  };
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export const AdminPicoDisplay: React.FC = () => {
  const { t } = useTranslation(['translation', 'help-admin-pico-display']);
  const [state] = useStore();
  const events = state.events?.events ?? [];

  const endpoint: string = cfg.API?.aws_appsync_graphqlEndpoint ?? '';
  const region: string = cfg.API?.aws_appsync_region ?? '';
  const apiKey: string = cfg.API?.aws_appsync_apiKey ?? '';

  const [copiedField, setCopiedField] = React.useState<string | null>(null);
  const copyToClipboard = (value: string, field: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const [selectedEventId, setSelectedEventId] = React.useState<string>('');
  const [selectedTrackId, setSelectedTrackId] = React.useState<string>('');
  const [raceFormat, setRaceFormat] = React.useState<'fastest' | 'average'>('fastest');
  const [brightness, setBrightness] = React.useState<string>('0.5');
  const [scrollSpeed, setScrollSpeed] = React.useState<string>('40');
  const [pollInterval, setPollInterval] = React.useState<string>('30');
  const [topN, setTopN] = React.useState<string>('5');

  const eventOptions = events.map((e) => ({ label: e.eventName, value: e.eventId }));
  const selectedEvent = events.find((e) => e.eventId === selectedEventId);
  const trackOptions = (selectedEvent?.tracks ?? []).map((tr) => ({
    label: tr.trackId,
    value: tr.trackId,
  }));

  const canDownload = Boolean(selectedEventId && selectedTrackId && endpoint && apiKey);

  const handleDownload = () => {
    const config = generateConfig(
      { endpoint, apiKey, region },
      {
        eventId: selectedEventId, trackId: selectedTrackId, raceFormat,
        brightness: parseFloat(brightness) || 0.5,
        scrollSpeed: parseInt(scrollSpeed, 10) || 40,
        pollInterval: parseInt(pollInterval, 10) || 30,
        topN: parseInt(topN, 10) || 5,
      }
    );
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'config.json'; a.click();
    URL.revokeObjectURL(url);
  };

  const CopyButton: React.FC<{ value: string; field: string }> = ({ value, field }) => (
    <Button
      variant="inline-icon"
      iconName={copiedField === field ? 'status-positive' : 'copy'}
      onClick={() => copyToClipboard(value, field)}
      ariaLabel={t('pico-display.copy-button')}
    />
  );

  const readOnlyField = (label: string, value: string, field: string) => (
    <FormField label={label}>
      <Grid gridDefinition={[{ colspan: 10 }, { colspan: 2 }]}>
        <Input value={value} readOnly onChange={() => {}} />
        <Box textAlign="right"><CopyButton value={value} field={field} /></Box>
      </Grid>
    </FormField>
  );

  const breadcrumbs = Breadcrumbs();
  breadcrumbs.push({ text: t('pico-display.page-title'), href: '#' });

  return (
    <PageLayout
      breadcrumbs={breadcrumbs}
      header={t('pico-display.page-title')}
      description={t('pico-display.page-description')}
      helpPanelHidden={false}
      helpPanelContent={
        <SimpleHelpPanelLayout
          headerContent={t('header', { ns: 'help-admin-pico-display' })}
          bodyContent={t('content', { ns: 'help-admin-pico-display' })}
          footerContent={t('footer', { ns: 'help-admin-pico-display' })}
        />
      }
    >
      <SpaceBetween size="l">

        <Container
          header={
            <Header variant="h2" description={t('pico-display.connection-description')}>
              {t('pico-display.connection-title')}
            </Header>
          }
        >
          <SpaceBetween size="m">
            {!apiKey && (
              <StatusIndicator type="warning">
                API key not found in config — run <code>make local.config</code> to regenerate.
              </StatusIndicator>
            )}
            {readOnlyField(t('pico-display.endpoint-label'), endpoint, 'endpoint')}
            {readOnlyField(t('pico-display.region-label'), region, 'region')}
            {readOnlyField(t('pico-display.api-key-label'), apiKey, 'apiKey')}
          </SpaceBetween>
        </Container>

        <Container
          header={
            <Header variant="h2" description={t('pico-display.generate-description')}>
              {t('pico-display.generate-title')}
            </Header>
          }
        >
          <SpaceBetween size="m">
            <FormField label={t('pico-display.event-label')}>
              <Select
                selectedOption={eventOptions.find((o) => o.value === selectedEventId) ?? null}
                onChange={({ detail }) => { setSelectedEventId(detail.selectedOption.value ?? ''); setSelectedTrackId(''); }}
                options={eventOptions}
                placeholder={t('pico-display.event-placeholder')}
              />
            </FormField>

            <FormField label={t('pico-display.track-label')}>
              <Select
                selectedOption={trackOptions.find((o) => o.value === selectedTrackId) ?? null}
                onChange={({ detail }) => setSelectedTrackId(detail.selectedOption.value ?? '')}
                options={trackOptions}
                disabled={!selectedEventId}
                placeholder={t('pico-display.track-placeholder')}
              />
            </FormField>

            <FormField label={t('pico-display.race-format-label')}>
              <Select
                selectedOption={{ label: raceFormat === 'fastest' ? t('pico-display.race-format-fastest') : t('pico-display.race-format-average'), value: raceFormat }}
                onChange={({ detail }) => setRaceFormat(detail.selectedOption.value as 'fastest' | 'average')}
                options={[
                  { label: t('pico-display.race-format-fastest'), value: 'fastest' },
                  { label: t('pico-display.race-format-average'), value: 'average' },
                ]}
              />
            </FormField>

            <Grid gridDefinition={[{ colspan: 3 }, { colspan: 3 }, { colspan: 3 }, { colspan: 3 }]}>
              <FormField label={t('pico-display.brightness-label')}>
                <Input value={brightness} onChange={({ detail }) => setBrightness(detail.value)} inputMode="decimal" />
              </FormField>
              <FormField label={t('pico-display.scroll-speed-label')}>
                <Input value={scrollSpeed} onChange={({ detail }) => setScrollSpeed(detail.value)} inputMode="numeric" />
              </FormField>
              <FormField label={t('pico-display.poll-interval-label')}>
                <Input value={pollInterval} onChange={({ detail }) => setPollInterval(detail.value)} inputMode="numeric" />
              </FormField>
              <FormField label={t('pico-display.top-n-label')}>
                <Input value={topN} onChange={({ detail }) => setTopN(detail.value)} inputMode="numeric" />
              </FormField>
            </Grid>

            <StatusIndicator type="info">{t('pico-display.wifi-note')}</StatusIndicator>

            <Button variant="primary" disabled={!canDownload} onClick={handleDownload}>
              {t('pico-display.download-button')}
            </Button>
          </SpaceBetween>
        </Container>

        <Container header={<Header variant="h2">{t('pico-display.code-title')}</Header>}>
          <SpaceBetween size="s">
            <Box>{t('pico-display.code-description')}</Box>
            <Link
              href="https://github.com/aws-solutions-library-samples/guidance-for-aws-deepracer-event-management/tree/main/pico-display"
              external
            >
              {t('pico-display.github-link')}
            </Link>
          </SpaceBetween>
        </Container>

      </SpaceBetween>
    </PageLayout>
  );
};
```

- [ ] **Step 2: Run vitest to confirm `generateConfig` tests still pass**

```bash
cd website && npx vitest run src/admin/picoDisplay.test.tsx 2>&1 | tail -20
```
Expected: 6 passed

- [ ] **Step 3: Commit**

```bash
git add website/src/admin/picoDisplay.tsx
git commit -m "feat(pico-page): Pico LED Display admin page component"
```

---

## Task 5: Wire up route and nav entry

**Files:**
- Modify: `website/src/App.tsx` — add route
- Modify: `website/src/components/topNav.tsx` — add nav entry

- [ ] **Step 1: Add the route to `App.tsx`**

In `website/src/App.tsx`, find the existing imports from `../admin/` and add:

```typescript
import { AdminPicoDisplay } from '../admin/picoDisplay';
```

Find the block of `<Route>` elements (around the `admin-timer-activation` route) and add:

```tsx
<Route
  key="admin-pico-display"
  path="/admin/pico_display"
  element={<AdminPicoDisplay />}
/>
```

- [ ] **Step 2: Add the nav entry to `topNav.tsx`**

In `website/src/components/topNav.tsx`, find the `device-management` expandable-link-group (which contains car-activation and timer-activation entries). Add after `timer-activation`:

```typescript
{
  type: 'link',
  text: t('topnav.pico-display'),
  info: <Badge color="blue">{t('topnav.beta')}</Badge>,
  href: '/admin/pico_display',
},
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd website && npm run build 2>&1 | tail -30
```
Expected: no errors referencing picoDisplay or the new route

- [ ] **Step 4: Commit**

```bash
git add website/src/App.tsx website/src/components/topNav.tsx
git commit -m "feat(pico-page): add Pico LED Display route and nav entry (Beta)"
```

---

## Task 6: Manual smoke test and final cleanup

- [ ] **Step 1: Start local dev server**

```bash
make local.config   # regenerate Amplify config (picks up appsyncApiKey if deployed)
make local.build
make local.run
```

- [ ] **Step 2: Navigate to the page**

Open `http://localhost:3000`. Sign in. In the nav, open **Device Management** → **Pico LED Display**. Verify:
- Beta badge is visible next to the nav entry
- Page loads with two containers
- Connection details show endpoint and region (API key shows warning if running against local config without a deployed stack, or shows the key if deployed)

- [ ] **Step 3: Test config download**

Select an event, select a track, click **Download config.json**. Open the file and verify:
- `appsync.endpoint` and `appsync.region` match what's shown on the page
- `event.event_id` matches the selected event
- `event.track_id` matches the selected track
- `wifi.ssid` is `"YourNetworkName"` (placeholder)

- [ ] **Step 4: Run full website test suite**

```bash
cd website && npm test
```
Expected: all tests pass including the new `picoDisplay.test.tsx`

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(pico-page): complete Pico LED Display DREM companion page"
```
