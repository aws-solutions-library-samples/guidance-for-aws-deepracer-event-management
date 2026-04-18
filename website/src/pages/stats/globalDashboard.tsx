import {
  BarChart,
  Box,
  ColumnLayout,
  Container,
  ContentLayout,
  Header,
  LineChart,
  PieChart,
  SpaceBetween,
  Spinner,
  StatusIndicator,
  Table,
} from '@cloudscape-design/components';
import { useTranslation } from 'react-i18next';
import { useStatsApi } from '../../hooks/useStatsApi';

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
            series={[
              {
                title: t('stats.events'),
                type: 'bar',
                data: stats.eventsByCountry.map((c) => ({
                  x: c.countryCode,
                  y: c.events,
                })),
              },
            ]}
            xTitle={t('stats.country')}
            yTitle={t('stats.events')}
            hideFilter
            height={300}
          />
        </Container>

        {/* Activity Over Time — three stacked charts so each series has its own scale */}
        <Container header={<Header variant="h2">{t('stats.activity-over-time')}</Header>}>
          <SpaceBetween size="m">
            <LineChart
              series={[
                {
                  title: t('stats.events'),
                  type: 'line',
                  data: stats.eventsByMonth.map((m) => ({
                    x: new Date(m.month + '-01'),
                    y: m.events,
                  })),
                },
              ]}
              xScaleType="time"
              xTitle={t('stats.month')}
              yTitle={t('stats.events')}
              hideFilter
              height={180}
            />
            <LineChart
              series={[
                {
                  title: t('stats.races'),
                  type: 'line',
                  data: stats.eventsByMonth.map((m) => ({
                    x: new Date(m.month + '-01'),
                    y: m.races,
                  })),
                },
              ]}
              xScaleType="time"
              xTitle={t('stats.month')}
              yTitle={t('stats.races')}
              hideFilter
              height={180}
            />
            <LineChart
              series={[
                {
                  title: t('stats.laps'),
                  type: 'line',
                  data: stats.eventsByMonth.map((m) => ({
                    x: new Date(m.month + '-01'),
                    y: m.laps,
                  })),
                },
              ]}
              xScaleType="time"
              xTitle={t('stats.month')}
              yTitle={t('stats.laps')}
              hideFilter
              height={180}
            />
          </SpaceBetween>
        </Container>

        {/* Event Type Breakdown */}
        <Container header={<Header variant="h2">{t('stats.event-type-breakdown')}</Header>}>
          <PieChart
            data={stats.eventTypeBreakdown.map((e) => ({
              title: e.typeOfEvent.replace(/_/g, ' '),
              value: e.count,
            }))}
            hideFilter
            size="medium"
          />
        </Container>

        {/* Fastest Laps Ever */}
        <Container header={<Header variant="h2">{t('stats.fastest-laps-ever')}</Header>}>
          <Table
            columnDefinitions={[
              {
                id: 'rank',
                header: '#',
                cell: (item) =>
                  stats.fastestLapsEver.indexOf(item) + 1,
                width: 50,
              },
              { id: 'username', header: t('stats.racer'), cell: (item) => item.username },
              { id: 'eventName', header: t('stats.event'), cell: (item) => item.eventName },
              {
                id: 'trackType',
                header: t('stats.track'),
                cell: (item) => item.trackType.replace(/_/g, ' '),
              },
              {
                id: 'lapTimeMs',
                header: t('stats.lap-time'),
                cell: (item) => formatLapTime(item.lapTimeMs),
              },
              { id: 'eventDate', header: t('stats.date'), cell: (item) => item.eventDate },
            ]}
            items={stats.fastestLapsEver}
            variant="embedded"
          />
        </Container>
      </SpaceBetween>
    </ContentLayout>
  );
}
