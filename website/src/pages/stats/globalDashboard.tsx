import {
  Box,
  ColumnLayout,
  Container,
  ContentLayout,
  Header,
  Multiselect,
  SegmentedControl,
  Select,
  SpaceBetween,
  Spinner,
  StatusIndicator,
  Table,
  Tabs,
} from '@cloudscape-design/components';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  EventTypeConfig,
  GetTypeOfEventNameFromId,
} from '../../admin/events/support-functions/eventDomain';
import { GetTrackTypeNameFromId } from '../../admin/events/support-functions/raceConfig';
import { BarChart } from '../../components/charts/BarChart';
import { categoricalPalette } from '../../components/charts/chartDefaults';
import { PieChart } from '../../components/charts/PieChart';
import { SyncedActivityCharts } from '../../components/charts/SyncedActivityCharts';
import { WorldMap } from '../../components/charts/WorldMap';
import { FastestLapEntry, useStatsApi } from '../../hooks/useStatsApi';
import { deriveCountryMetric, type MetricKey } from './countryMetric';

const ALL_TRACKS = 'ALL';

// The stats page only surfaces event types where lap timing is reliable —
// the rest still live in the data and the admin Events page, they just
// don't appear in the multiselect or get rolled into the "all selected"
// view here.
const STATS_VISIBLE_TYPES = new Set(['AWS_SUMMIT', 'OFFICIAL_TRACK_RACE', 'OFFICIAL_WORKSHOP']);

function KpiCard({ title, value }: { title: string; value: string | number }) {
  return (
    <Box>
      <Box variant="awsui-key-label">{title}</Box>
      <Box variant="awsui-value-large">{value}</Box>
    </Box>
  );
}

function formatLapTime(ms: number): string {
  const seconds = ms / 1000;
  return `${seconds.toFixed(3)}s`;
}

/**
 * Convert an ISO-3166-1 alpha-2 country code into the corresponding
 * regional-indicator flag emoji ("GB" → 🇬🇧). Unknown / non-letter input
 * returns the empty string so chart.js drops the second tick line.
 */
function flagEmoji(code: string): string {
  if (!code || code.length !== 2) return '';
  const A = 'A'.charCodeAt(0);
  const BASE = 0x1f1e6;
  const upper = code.toUpperCase();
  const c0 = upper.charCodeAt(0);
  const c1 = upper.charCodeAt(1);
  if (c0 < A || c0 > A + 25 || c1 < A || c1 > A + 25) return '';
  return String.fromCodePoint(BASE + (c0 - A)) + String.fromCodePoint(BASE + (c1 - A));
}

export function GlobalDashboard() {
  const { t } = useTranslation();
  const { globalStats, loading, error } = useStatsApi();
  const [trackFilter, setTrackFilter] = useState<string>(ALL_TRACKS);
  // Default to AWS Summit only — these events have the most rigorous timing
  // setup, so the "Fastest Laps Ever" view is trustworthy out of the box.
  // Users can broaden via the Multiselect.
  const [typeFilter, setTypeFilter] = useState<Set<string>>(() => new Set(['AWS_SUMMIT']));

  // All hooks must run on every render — no early returns above this block.
  // We feed the memos optional-chained values so they cope with `globalStats`
  // being null during the loading state and don't blow up.

  // Build dropdown options from whichever tracks actually have fastest-lap
  // data, so we don't show empty entries. "All tracks" lives at the top.
  const trackOptions = useMemo(() => {
    const trackEntries = (globalStats?.fastestLapsByTrack ?? []).map((bucket) => ({
      value: bucket.trackType,
      label: GetTrackTypeNameFromId(bucket.trackType) ?? bucket.trackType,
    }));
    return [{ value: ALL_TRACKS, label: t('stats.all-tracks') }, ...trackEntries];
  }, [globalStats?.fastestLapsByTrack, t]);

  // Event-type filter options — narrowed to STATS_VISIBLE_TYPES (private /
  // test / "other" events have less rigorous timing and would dominate the
  // ranking; they're still visible everywhere else, just not filterable in
  // the stats top-N).
  const typeOptions = useMemo(
    () =>
      EventTypeConfig()
        .filter((cfg) => STATS_VISIBLE_TYPES.has(cfg.value))
        .map((cfg) => ({
          value: cfg.value,
          label: cfg.label,
        })),
    []
  );

  // For "All tracks", derive the view from the union of per-track buckets
  // filtered by the type selection. The precomputed `fastestLapsEver`
  // top-N can't be used as a shortcut here because it spans every event
  // type (including the ones STATS_VISIBLE_TYPES intentionally hides), so
  // even "all dropdown options selected" needs to go through the union
  // path to keep hidden types out.
  const fastestLapsRows = useMemo<FastestLapEntry[]>(() => {
    if (!globalStats) return [];
    if (trackFilter !== ALL_TRACKS) {
      const bucket = globalStats.fastestLapsByTrack?.find((b) => b.trackType === trackFilter);
      return (bucket?.entries ?? []).filter((entry) => typeFilter.has(entry.typeOfEvent));
    }
    const unioned = (globalStats.fastestLapsByTrack ?? [])
      .flatMap((bucket) => bucket.entries)
      .filter((entry) => typeFilter.has(entry.typeOfEvent));
    unioned.sort((a, b) => a.lapTimeMs - b.lapTimeMs);
    return unioned.slice(0, globalStats.fastestLapsEver.length || 10);
  }, [globalStats, trackFilter, typeFilter]);

  // Drop the Event column when the view is fully un-narrowed (every visible
  // type + every track) — the event name is essentially noise across that
  // many rows. Narrowing either dropdown brings the column back.
  const allVisibleTypesSelected =
    typeFilter.size === STATS_VISIBLE_TYPES.size &&
    [...STATS_VISIBLE_TYPES].every((t) => typeFilter.has(t));
  const showEventNameColumn = !(allVisibleTypesSelected && trackFilter === ALL_TRACKS);

  const [countryMetric, setCountryMetric] = useState<MetricKey>('events');

  const countryRows = useMemo(
    () => deriveCountryMetric(globalStats?.eventsByCountry ?? [], countryMetric),
    [globalStats?.eventsByCountry, countryMetric]
  );

  const countryMetricLabel = useMemo(() => {
    switch (countryMetric) {
      case 'events':
        return t('stats.events');
      case 'laps':
        return t('stats.laps');
      case 'avgLapsPerEvent':
        return t('stats.metric-avg-laps');
    }
  }, [countryMetric, t]);

  // Tooltip + bar-chart Y-axis label for the avg metric should render one
  // decimal so "25" doesn't sit next to "12.3"; the raw `value` stays
  // unrounded for the chart's own scale calculations.
  const formatCountryValue = useMemo(
    () =>
      countryMetric === 'avgLapsPerEvent'
        ? (v: number) => (Math.round(v * 10) / 10).toString()
        : undefined,
    [countryMetric]
  );

  // Map the active metric to the raw count field that the WorldMap tooltip
  // should suppress (so it doesn't show a duplicate context line). The
  // avg metric doesn't match any raw field, so leave primaryField unset.
  const countryPrimaryField = useMemo<'events' | 'laps' | undefined>(() => {
    if (countryMetric === 'events') return 'events';
    if (countryMetric === 'laps') return 'laps';
    return undefined;
  }, [countryMetric]);

  if (loading) {
    return (
      <ContentLayout header={<Header variant="h1">{t('stats.global-dashboard')}</Header>}>
        <Box textAlign="center" padding={{ top: 'xxxl' }}>
          <Spinner size="large" />
        </Box>
      </ContentLayout>
    );
  }

  if (error || !globalStats) {
    return (
      <ContentLayout header={<Header variant="h1">{t('stats.global-dashboard')}</Header>}>
        <Box textAlign="center" padding={{ top: 'xxxl' }}>
          <StatusIndicator type="info">{t('stats.no-race-data')}</StatusIndicator>
        </Box>
      </ContentLayout>
    );
  }

  const stats = globalStats;
  const activityDates = stats.eventsByMonth.map((m) => new Date(m.month + '-01'));

  return (
    <ContentLayout header={<Header variant="h1">{t('stats.global-dashboard')}</Header>}>
      <SpaceBetween size="l">
        {/* KPI Cards */}
        <Container>
          <ColumnLayout columns={5} variant="text-grid">
            <KpiCard title={t('stats.total-events')} value={stats.totalEvents} />
            <KpiCard title={t('stats.total-racers')} value={stats.totalRacers} />
            <KpiCard title={t('stats.total-laps')} value={stats.totalValidLaps.toLocaleString()} />
            <KpiCard title={t('stats.total-countries')} value={stats.totalCountries} />
            <KpiCard
              title={t('stats.completion-ratio')}
              value={
                stats.totalLaps > 0
                  ? `${Math.round((stats.totalValidLaps / stats.totalLaps) * 100)}%`
                  : '—'
              }
            />
          </ColumnLayout>
        </Container>

        {/* Events by Country — tab between world map ("where") and bar
            chart ("exact comparable numbers"). */}
        <Container
          header={
            <Header
              variant="h2"
              actions={
                <SegmentedControl
                  selectedId={countryMetric}
                  onChange={({ detail }) => setCountryMetric(detail.selectedId as MetricKey)}
                  label={t('stats.country-breakdown')}
                  options={[
                    { id: 'events', text: t('stats.events') },
                    { id: 'laps', text: t('stats.laps') },
                    { id: 'avgLapsPerEvent', text: t('stats.metric-avg-laps') },
                  ]}
                />
              }
            >
              {t('stats.country-breakdown')}
            </Header>
          }
        >
          <Tabs
            tabs={[
              {
                id: 'bar',
                label: t('stats.bar-chart'),
                content: (
                  <BarChart
                    labels={countryRows.map((c) => [c.countryCode, flagEmoji(c.countryCode)])}
                    values={countryRows.map((c) => c.value)}
                    seriesLabel={countryMetricLabel}
                    xTitle={t('stats.country')}
                    yTitle={countryMetricLabel}
                    color={categoricalPalette[0]}
                    height={300}
                  />
                ),
              },
              {
                id: 'map',
                label: t('stats.world-map'),
                content: (
                  <WorldMap
                    data={countryRows}
                    metricLabel={countryMetricLabel}
                    formatValue={formatCountryValue}
                    primaryField={countryPrimaryField}
                    height={400}
                  />
                ),
              },
            ]}
          />
        </Container>

        {/* Activity Over Time — three stacked charts with synced crosshair */}
        <Container header={<Header variant="h2">{t('stats.activity-over-time')}</Header>}>
          <SyncedActivityCharts
            dates={activityDates}
            series={[
              {
                title: t('stats.events'),
                color: categoricalPalette[0],
                values: stats.eventsByMonth.map((m) => m.events),
              },
              {
                title: t('stats.races'),
                color: categoricalPalette[1],
                values: stats.eventsByMonth.map((m) => m.races),
              },
              {
                title: t('stats.laps'),
                color: categoricalPalette[2],
                values: stats.eventsByMonth.map((m) => m.laps),
              },
            ]}
          />
        </Container>

        {/* Event Type Breakdown */}
        <Container header={<Header variant="h2">{t('stats.event-type-breakdown')}</Header>}>
          <PieChart
            data={stats.eventTypeBreakdown.map((e) => ({
              label: e.typeOfEvent.replace(/_/g, ' '),
              value: e.count,
            }))}
            height={320}
          />
        </Container>

        {/* Fastest Laps Ever */}
        <Container
          header={
            <Header
              variant="h2"
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Multiselect
                    selectedOptions={typeOptions.filter((o) => typeFilter.has(o.value))}
                    onChange={({ detail }) =>
                      setTypeFilter(new Set(detail.selectedOptions.map((o) => o.value as string)))
                    }
                    options={typeOptions}
                    placeholder={t('stats.filter-by-event-type')}
                    tokenLimit={2}
                    hideTokens={false}
                  />
                  <Select
                    selectedOption={
                      trackOptions.find((o) => o.value === trackFilter) ?? trackOptions[0]
                    }
                    onChange={({ detail }) => setTrackFilter(detail.selectedOption.value as string)}
                    options={trackOptions}
                    ariaLabel={t('stats.filter-by-track')}
                  />
                </SpaceBetween>
              }
            >
              {t('stats.fastest-laps-ever')}
            </Header>
          }
        >
          <Table
            columnDefinitions={[
              {
                id: 'rank',
                header: '#',
                cell: (item) => fastestLapsRows.indexOf(item) + 1,
                width: 50,
              },
              { id: 'username', header: t('stats.racer'), cell: (item) => item.username },
              ...(showEventNameColumn
                ? [
                    {
                      id: 'eventName',
                      header: t('stats.event'),
                      cell: (item: FastestLapEntry) => item.eventName,
                    },
                  ]
                : []),
              {
                id: 'typeOfEvent',
                header: t('stats.event-type'),
                cell: (item) => GetTypeOfEventNameFromId(item.typeOfEvent) ?? item.typeOfEvent,
              },
              {
                id: 'trackType',
                header: t('stats.track'),
                cell: (item) => GetTrackTypeNameFromId(item.trackType) ?? item.trackType,
              },
              {
                id: 'lapTimeMs',
                header: t('stats.lap-time'),
                cell: (item) => formatLapTime(item.lapTimeMs),
              },
              { id: 'eventDate', header: t('stats.date'), cell: (item) => item.eventDate },
            ]}
            items={fastestLapsRows}
            variant="embedded"
            empty={
              <Box textAlign="center" padding="m">
                <StatusIndicator type="info">{t('stats.no-laps-on-track')}</StatusIndicator>
              </Box>
            }
          />
        </Container>
      </SpaceBetween>
    </ContentLayout>
  );
}
