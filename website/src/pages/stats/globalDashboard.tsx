import {
  Box,
  ColumnLayout,
  Container,
  ContentLayout,
  Header,
  SegmentedControl,
  SpaceBetween,
  Spinner,
  StatusIndicator,
  Table,
} from '@cloudscape-design/components';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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

  // Build the segmented-control options from whichever tracks actually
  // have fastest-lap data, so we don't show empty tabs.
  const trackOptions = useMemo(() => {
    const trackSegments = (stats.fastestLapsByTrack ?? []).map((bucket) => ({
      id: bucket.trackType,
      text: GetTrackTypeNameFromId(bucket.trackType) ?? bucket.trackType,
    }));
    return [{ id: ALL_TRACKS, text: t('stats.all-tracks') }, ...trackSegments];
  }, [stats.fastestLapsByTrack, t]);

  const fastestLapsRows: FastestLapEntry[] =
    trackFilter === ALL_TRACKS
      ? stats.fastestLapsEver
      : (stats.fastestLapsByTrack?.find((b) => b.trackType === trackFilter)?.entries ?? []);

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
                <SegmentedControl
                  selectedId={trackFilter}
                  onChange={({ detail }) => setTrackFilter(detail.selectedId)}
                  options={trackOptions}
                  label={t('stats.filter-by-track')}
                />
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
