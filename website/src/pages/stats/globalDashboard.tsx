import {
  Box,
  ColumnLayout,
  Container,
  ContentLayout,
  Header,
  Multiselect,
  Select,
  SpaceBetween,
  Spinner,
  StatusIndicator,
  Table,
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
import { FastestLapEntry, useStatsApi } from '../../hooks/useStatsApi';

const ALL_TRACKS = 'ALL';

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

export function GlobalDashboard() {
  const { t } = useTranslation();
  const { globalStats, loading, error } = useStatsApi();
  const [trackFilter, setTrackFilter] = useState<string>(ALL_TRACKS);
  // Default to AWS Summit only — these events have the most rigorous timing
  // setup, so the "Fastest Laps Ever" view is trustworthy out of the box.
  // Users can broaden via the Multiselect.
  const [typeFilter, setTypeFilter] = useState<Set<string>>(
    () => new Set(['AWS_SUMMIT']),
  );

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

  // Event-type filter options — same enum the admin Events page uses. Show
  // every value so the operator can intentionally include misclassified
  // events if needed, even if none currently appear in the data.
  const typeOptions = useMemo(
    () =>
      EventTypeConfig().map((cfg) => ({
        value: cfg.value,
        label: cfg.label,
      })),
    [],
  );

  const trackFilteredRows: FastestLapEntry[] = !globalStats
    ? []
    : trackFilter === ALL_TRACKS
      ? globalStats.fastestLapsEver
      : (globalStats.fastestLapsByTrack?.find((b) => b.trackType === trackFilter)?.entries ?? []);

  const fastestLapsRows = useMemo(
    () => trackFilteredRows.filter((entry) => typeFilter.has(entry.typeOfEvent)),
    [trackFilteredRows, typeFilter],
  );

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
          <StatusIndicator type="info">{t('stats.no-data')}</StatusIndicator>
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

        {/* Events by Country */}
        <Container header={<Header variant="h2">{t('stats.events-by-country')}</Header>}>
          <BarChart
            labels={stats.eventsByCountry.map((c) => c.countryCode)}
            values={stats.eventsByCountry.map((c) => c.events)}
            seriesLabel={t('stats.events')}
            xTitle={t('stats.country')}
            yTitle={t('stats.events')}
            color={categoricalPalette[0]}
            height={300}
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
                      setTypeFilter(
                        new Set(detail.selectedOptions.map((o) => o.value as string)),
                      )
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
                    onChange={({ detail }) =>
                      setTrackFilter(detail.selectedOption.value as string)
                    }
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
              { id: 'eventName', header: t('stats.event'), cell: (item) => item.eventName },
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
