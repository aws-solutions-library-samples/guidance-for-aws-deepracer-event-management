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
  Toggle,
} from '@cloudscape-design/components';
import { useTranslation } from 'react-i18next';
import { SimpleHelpPanelLayout } from '../components/help-panels/simple-help-panel';
import { PageLayout } from '../components/pageLayout';
import { useStore } from '../store/store';
import { Breadcrumbs } from './fleets/support-functions/supportFunctions';
import awsconfig from '../config.json';
import {
  generateConfig,
  type PicoConfig,
  type PicoConnection,
  type PicoFormValues,
} from './picoDisplay.config';

const cfg = awsconfig as any;

// Re-export so any external imports from the page module keep working.
export { generateConfig };
export type { PicoConfig, PicoConnection, PicoFormValues };

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
  const [topN, setTopN] = React.useState<string>('5');
  const [raceDisplayLines, setRaceDisplayLines] = React.useState<1 | 2>(1);
  const [branding1, setBranding1] = React.useState<string>('DREM');
  const [branding1Colour, setBranding1Colour] = React.useState<string>('yellow');
  const [branding2, setBranding2] = React.useState<string>('>> This way towards victory >>');
  const [branding2Colour, setBranding2Colour] = React.useState<string>('cyan');
  const [ssid, setSsid] = React.useState<string>('');
  const [wifiPassword, setWifiPassword] = React.useState<string>('');
  const [debug, setDebug] = React.useState<boolean>(false);

  const eventOptions = events.map((e) => ({ label: e.eventName, value: e.eventId }));
  const selectedEvent = events.find((e) => e.eventId === selectedEventId);
  const trackOptions = (selectedEvent?.tracks ?? []).map((tr) => ({
    label: tr.trackId,
    value: tr.trackId,
  }));

  const otaBaseUrl = `${window.location.origin}/pico-display/`;

  const canDownload = Boolean(selectedEventId && selectedTrackId && endpoint && apiKey);

  const handleDownload = () => {
    const config = generateConfig(
      { endpoint, apiKey, region },
      {
        eventId: selectedEventId,
        trackId: selectedTrackId,
        raceFormat,
        brightness: parseFloat(brightness) || 0.5,
        scrollSpeed: parseInt(scrollSpeed, 10) || 40,
        topN: parseInt(topN, 10) || 5,
        raceDisplayLines,
        branding1,
        branding1Colour,
        branding2,
        branding2Colour,
        ssid,
        wifiPassword,
        otaBaseUrl,
        debug,
      }
    );
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config.json';
    a.click();
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
        <Box textAlign="right">
          <CopyButton value={value} field={field} />
        </Box>
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
                onChange={({ detail }) => {
                  setSelectedEventId(detail.selectedOption.value ?? '');
                  setSelectedTrackId('');
                }}
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
                selectedOption={{
                  label: raceFormat === 'fastest' ? t('pico-display.race-format-fastest') : t('pico-display.race-format-average'),
                  value: raceFormat,
                }}
                onChange={({ detail }) => setRaceFormat(detail.selectedOption.value as 'fastest' | 'average')}
                options={[
                  { label: t('pico-display.race-format-fastest'), value: 'fastest' },
                  { label: t('pico-display.race-format-average'), value: 'average' },
                ]}
              />
            </FormField>

            <FormField label={t('pico-display.ssid-label')}>
              <Input
                value={ssid}
                placeholder={t('pico-display.ssid-placeholder')}
                onChange={({ detail }) => setSsid(detail.value)}
              />
            </FormField>

            <FormField label={t('pico-display.wifi-password-label')}>
              <Input
                value={wifiPassword}
                placeholder={t('pico-display.wifi-password-placeholder')}
                onChange={({ detail }) => setWifiPassword(detail.value)}
              />
            </FormField>

            <Grid gridDefinition={[{ colspan: 4 }, { colspan: 4 }, { colspan: 4 }]}>
              <FormField label={t('pico-display.brightness-label')}>
                <Input value={brightness} onChange={({ detail }) => setBrightness(detail.value)} inputMode="decimal" />
              </FormField>
              <FormField label={t('pico-display.scroll-speed-label')}>
                <Input value={scrollSpeed} onChange={({ detail }) => setScrollSpeed(detail.value)} inputMode="numeric" />
              </FormField>
              <FormField label={t('pico-display.top-n-label')}>
                <Input value={topN} onChange={({ detail }) => setTopN(detail.value)} inputMode="numeric" />
              </FormField>
            </Grid>

            <FormField
              label={t('pico-display.race-display-lines-label')}
              description={t('pico-display.race-display-lines-description')}
            >
              <Select
                selectedOption={{
                  label:
                    raceDisplayLines === 1
                      ? t('pico-display.race-display-lines-1')
                      : t('pico-display.race-display-lines-2'),
                  value: String(raceDisplayLines),
                }}
                onChange={({ detail }) =>
                  setRaceDisplayLines(parseInt(detail.selectedOption.value!, 10) as 1 | 2)
                }
                options={[
                  { label: t('pico-display.race-display-lines-1'), value: '1' },
                  { label: t('pico-display.race-display-lines-2'), value: '2' },
                ]}
              />
            </FormField>

            <Grid gridDefinition={[{ colspan: 9 }, { colspan: 3 }]}>
              <FormField label={t('pico-display.branding-1-label')} description={t('pico-display.branding-1-description')}>
                <Input value={branding1} onChange={({ detail }) => setBranding1(detail.value)} />
              </FormField>
              <FormField
                label={t('pico-display.colour-label')}
                description={t('pico-display.colour-description')}
              >
                <Select
                  selectedOption={{ label: branding1Colour, value: branding1Colour }}
                  onChange={({ detail }) => setBranding1Colour(detail.selectedOption.value!)}
                  options={[
                    { label: 'yellow', value: 'yellow' },
                    { label: 'cyan', value: 'cyan' },
                    { label: 'green', value: 'green' },
                    { label: 'white', value: 'white' },
                    { label: 'orange', value: 'orange' },
                    { label: 'red', value: 'red' },
                  ]}
                />
              </FormField>
            </Grid>

            <Grid gridDefinition={[{ colspan: 9 }, { colspan: 3 }]}>
              <FormField label={t('pico-display.branding-2-label')} description={t('pico-display.branding-2-description')}>
                <Input value={branding2} onChange={({ detail }) => setBranding2(detail.value)} />
              </FormField>
              <FormField
                label={t('pico-display.colour-label')}
                description={t('pico-display.colour-description')}
              >
                <Select
                  selectedOption={{ label: branding2Colour, value: branding2Colour }}
                  onChange={({ detail }) => setBranding2Colour(detail.selectedOption.value!)}
                  options={[
                    { label: 'yellow', value: 'yellow' },
                    { label: 'cyan', value: 'cyan' },
                    { label: 'green', value: 'green' },
                    { label: 'white', value: 'white' },
                    { label: 'orange', value: 'orange' },
                    { label: 'red', value: 'red' },
                  ]}
                />
              </FormField>
            </Grid>

            <FormField label={t('pico-display.debug-label')} description={t('pico-display.debug-description')}>
              <Toggle checked={debug} onChange={({ detail }) => setDebug(detail.checked)}>
                {debug ? t('pico-display.debug-on') : t('pico-display.debug-off')}
              </Toggle>
            </FormField>

            <Button variant="primary" disabled={!canDownload} onClick={handleDownload}>
              {t('pico-display.download-button')}
            </Button>
          </SpaceBetween>
        </Container>

        <Container
          header={
            <Header variant="h2" description={t('pico-display.ota-description')}>
              {t('pico-display.ota-title')}
            </Header>
          }
        >
          <SpaceBetween size="m">
            {readOnlyField(t('pico-display.ota-url-label'), otaBaseUrl, 'otaBaseUrl')}
            <Box variant="small" color="text-body-secondary">
              {t('pico-display.ota-instructions')}
            </Box>
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
