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
import { useLayoutEffect, useRef, useState } from 'react';
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

// Month abbreviations. January shows the full year for visual emphasis,
// other months show the 3-letter abbreviation.
const MONTH_LABELS = ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatMonthTick(date: Date): string {
  const month = date.getMonth();
  if (month === 0) {
    return String(date.getFullYear());
  }
  return MONTH_LABELS[month - 1];
}

// Approximate horizontal offsets for the CloudScape LineChart plot area.
// These are best-effort and may drift if CloudScape changes internal layout.
const CHART_PLOT_LEFT = 65;
const CHART_PLOT_RIGHT = 16;

interface ActivitySeries {
  title: string;
  color: string;
  values: number[];
}

interface SyncedActivityChartsProps {
  months: { month: string; events: number; races: number; laps: number }[];
  series: ActivitySeries[];
  monthLabel: string;
  countLabel: string;
}

function SyncedActivityCharts({ months, series, monthLabel }: SyncedActivityChartsProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [wrapperWidth, setWrapperWidth] = useState<number>(0);

  useLayoutEffect(() => {
    if (!wrapperRef.current) return;
    const update = () => {
      if (wrapperRef.current) setWrapperWidth(wrapperRef.current.clientWidth);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, []);

  const dates = months.map((m) => new Date(m.month + '-01'));

  const plotWidth = Math.max(0, wrapperWidth - CHART_PLOT_LEFT - CHART_PLOT_RIGHT);
  const step = months.length > 1 ? plotWidth / (months.length - 1) : 0;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!wrapperRef.current || months.length === 0 || plotWidth <= 0) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - CHART_PLOT_LEFT;
    if (x < -5 || x > plotWidth + 5) {
      setHoveredIndex(null);
      return;
    }
    const clamped = Math.max(0, Math.min(plotWidth, x));
    const idx = Math.round(clamped / step);
    setHoveredIndex(Math.max(0, Math.min(months.length - 1, idx)));
  };

  const handleMouseLeave = () => setHoveredIndex(null);

  const overlayLeft =
    hoveredIndex !== null ? CHART_PLOT_LEFT + hoveredIndex * step : 0;

  const hoveredMonthLabel =
    hoveredIndex !== null
      ? dates[hoveredIndex].toLocaleDateString(undefined, { year: 'numeric', month: 'short' })
      : '';

  return (
    <div
      ref={wrapperRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ position: 'relative' }}
    >
      <SpaceBetween size="m">
        {series.map((s) => (
          <div key={s.title} style={{ position: 'relative' }}>
            <LineChart
              series={[
                {
                  title: s.title,
                  type: 'line',
                  color: s.color,
                  data: months.map((m, i) => ({ x: dates[i], y: s.values[i] })),
                },
              ]}
              xScaleType="time"
              xTitle={monthLabel}
              yTitle={s.title}
              xTickFormatter={formatMonthTick}
              hideFilter
              height={180}
            />
            {hoveredIndex !== null && plotWidth > 0 && (
              <>
                <div
                  style={{
                    position: 'absolute',
                    left: overlayLeft,
                    top: 20,
                    bottom: 40,
                    width: 1,
                    background: '#687078',
                    pointerEvents: 'none',
                    opacity: 0.7,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    left: overlayLeft + 6,
                    top: 20,
                    background: 'rgba(255,255,255,0.92)',
                    border: `1px solid ${s.color}`,
                    borderRadius: 3,
                    padding: '2px 6px',
                    fontSize: 12,
                    fontWeight: 600,
                    color: s.color,
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.values[hoveredIndex].toLocaleString()}
                </div>
              </>
            )}
          </div>
        ))}
      </SpaceBetween>
      {hoveredIndex !== null && (
        <Box textAlign="center" padding={{ top: 'xs' }}>
          <Box variant="awsui-key-label">{hoveredMonthLabel}</Box>
        </Box>
      )}
    </div>
  );
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
          <SyncedActivityCharts
            months={stats.eventsByMonth}
            monthLabel={t('stats.month')}
            countLabel={t('stats.count')}
            series={[
              {
                title: t('stats.events'),
                color: '#0972D3',
                values: stats.eventsByMonth.map((m) => m.events),
              },
              {
                title: t('stats.races'),
                color: '#037F0C',
                values: stats.eventsByMonth.map((m) => m.races),
              },
              {
                title: t('stats.laps'),
                color: '#B25C00',
                values: stats.eventsByMonth.map((m) => m.laps),
              },
            ]}
          />
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
