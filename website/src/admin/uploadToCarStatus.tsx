import { Box, Container, Header, Icon, SpaceBetween, StatusIndicator } from '@cloudscape-design/components';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { ChartData, ChartOptions } from 'chart.js';
import { SimpleHelpPanelLayout } from '../components/help-panels/simple-help-panel';
import { TableHeader } from '../components/tableConfig';
import {
  categoricalPalette,
  statusPalette,
  tooltipBaseOptions,
  useChartTheme,
} from '../components/charts/chartDefaults';
import { graphqlMutate, graphqlSubscribe } from '../graphql/graphqlHelpers';
import * as queries from '../graphql/queries';
import { useTranslation } from 'react-i18next';
import { EventSelectorModal } from '../components/eventSelectorModal';
import { PageLayout } from '../components/pageLayout';
import { PageTable } from '../components/pageTable';
import { onUploadsToCarCreated, onUploadsToCarUpdated } from '../graphql/subscriptions';
import i18next from '../i18n';
import { useSelectedEventContext } from '../store/contexts/storeProvider';
import {
  ColumnConfiguration,
  FilteringProperties,
} from './uploadToCarStatusTableConfig';

// Type definitions
type UploadStatus = 'Created' | 'Started' | 'InProgress' | 'Success' | 'Failed';

interface UploadToCarItem {
  status: UploadStatus;
  statusIndicator?: React.ReactNode;
  uploadStartTime?: string;
  endTime?: string;
  duration?: number;
  carName?: string;
  jobId?: string;
  modelKey?: string;
  [key: string]: any; // Allow additional properties from GraphQL
}

interface BarChartDataPoint {
  x: string | Date;
  y: number;
}

const UploadToCarStatus: React.FC = () => {
  const { t } = useTranslation(['translation', 'help-admin-cars']);
  const [allItems, setItems] = useState<UploadToCarItem[]>([]);
  const [barData, setBarData] = useState<BarChartDataPoint[]>([]);
  const [maxDuration, setMaxDuration] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedItems, setSelectedItems] = useState<UploadToCarItem[]>([]);
  const selectedEvent = useSelectedEventContext();
  const [eventSelectModalVisible, setEventSelectModalVisible] = useState<boolean>(false);

  useEffect(() => {
    if (selectedEvent?.eventId == null) {
      setEventSelectModalVisible(true);
    }
  }, [selectedEvent]);

  function enrichStatus(data: UploadToCarItem[]): UploadToCarItem[] {
    data.forEach(element => {
      // enrich status
      if (element.status === 'Created') {
        element.statusIndicator = (
          <StatusIndicator type="info">
            {i18next.t('carmodelupload.status.created')}
          </StatusIndicator>
        );
      } else if (element.status === 'Started') {
        element.statusIndicator = (
          <StatusIndicator type="pending">
            {i18next.t('carmodelupload.status.started')}
          </StatusIndicator>
        );
      } else if (element.status === 'InProgress') {
        element.statusIndicator = (
          <StatusIndicator type="loading">
            {i18next.t('carmodelupload.status.inprogress')}
          </StatusIndicator>
        );
      } else if (element.status === 'Success') {
        element.statusIndicator = (
          <StatusIndicator type="success">
            {i18next.t('carmodelupload.status.success')}
          </StatusIndicator>
        );

        // enrich upload duration
        if (element.uploadStartTime && element.endTime) {
          const uploadStartDateTime = Date.parse(element.uploadStartTime);
          const endDateTime = Date.parse(element.endTime);
          const duration = (endDateTime - uploadStartDateTime) / 1000;
          element.duration = duration;
        }
      } else if (element.status === 'Failed') {
        element.statusIndicator = (
          <StatusIndicator type="error">{i18next.t('carmodelupload.status.error')}</StatusIndicator>
        );
      } else {
        element.statusIndicator = element.status;
      }
    });
    return data;
  }

  function getColorForStatus(status: string): string {
    switch (status) {
      case 'Created':
        return statusPalette.info;
      case 'Started':
        return statusPalette.neutral;
      case 'InProgress':
        return statusPalette.low;
      case 'Success':
        return statusPalette.positive;
      case 'Failed':
        return statusPalette.critical;
      default:
        return statusPalette.neutral;
    }
  }

  useEffect(() => {
    async function listUploadsToCar() {
      setItems([]);
      const response = await graphqlMutate<{ listUploadsToCar: UploadToCarItem[] }>(
        queries.listUploadsToCar,
        { eventId: selectedEvent?.eventId }
      );
      const enrichedData = enrichStatus(response.listUploadsToCar);
      setItems(enrichedData);
      setIsLoading(false);
    }

    if (typeof selectedEvent?.eventId !== "undefined") {
      listUploadsToCar();
    }
    return () => {
      // Unmounting
    };
  }, [selectedEvent]);

  // bar chart
  useEffect(() => {
    const newBarData: BarChartDataPoint[] = [];

    allItems.forEach(element => {
      if (typeof element.duration !== "undefined" && element.uploadStartTime) {
        const dateTime = new Date(element.uploadStartTime);
        const data: BarChartDataPoint = { x: dateTime, y: element.duration };
        newBarData.push(data);
      }
    });

    newBarData.sort((a, b) => {
      const dateA = new Date(a.x);
      const dateB = new Date(b.x);
      return dateA.getTime() - dateB.getTime();
    });

    setBarData(newBarData);

    if (allItems.length > 0) {
      const max = allItems.reduce((prev, current) => {
        return (prev && prev.duration && current.duration && prev.duration > current.duration) ? prev : current;
      });
      const newMaxDuration = Math.ceil(max.duration || 0) + 3;
      setMaxDuration(newMaxDuration);
    }
  }, [allItems]);

  useEffect(() => {
    const filter = {
      eventId: selectedEvent?.eventId,
    };
    const subscription = graphqlSubscribe<{ onUploadsToCarCreated: UploadToCarItem }>(
      onUploadsToCarCreated,
      filter
    ).subscribe({
        next: (event) => {
          console.debug(
            'onUploadsToCarCreated event received',
            event.value.data.onUploadsToCarCreated
          );
          event.value.data.onUploadsToCarCreated.status = 'Created';
          const newItems = allItems.concat(event.value.data.onUploadsToCarCreated);
          const enrichedItems = enrichStatus(newItems);
          setItems(enrichedItems);
        },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [selectedEvent, t, allItems]);

  // monitor for updated jobs matching our JobIds
  useEffect(() => {
    const filter = {
      eventId: selectedEvent?.eventId,
    };
    const subscription = graphqlSubscribe<{ onUploadsToCarUpdated: UploadToCarItem }>(
      onUploadsToCarUpdated,
      filter
    ).subscribe({
        next: (event) => {
          const updatedData = event.value.data.onUploadsToCarUpdated;
          console.debug('onUploadsToCarUpdated event received', updatedData);
          const newItems = [...allItems];
          let currentData = newItems.find((value) => (value.modelKey === updatedData.modelKey && value.jobId === updatedData.jobId));
          
          // handle missed events
          if (currentData === undefined) {
            currentData = {} as UploadToCarItem;
            newItems.push(currentData);
            currentData.modelKey = updatedData.modelKey;
          }

          currentData.status = updatedData.status;
          if (updatedData.uploadStartTime) {
            currentData.uploadStartTime = updatedData.uploadStartTime;
          }
          if (updatedData.endTime) {
            currentData.endTime = updatedData.endTime;
          }

          const enrichedItems = enrichStatus(newItems);
          setItems(enrichedItems);
        },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [selectedEvent, t, allItems]);

  const columnConfiguration = ColumnConfiguration() as any;
  const filteringProperties = FilteringProperties() as any;

  const HeaderActionButtons: React.FC = () => {
    return (
      <SpaceBetween direction="horizontal" size="xs">
      </SpaceBetween>
    );
  };

  const breadcrumbs: Array<{ text: string; href?: string }> = [
    { text: t('home.breadcrumb'), href: '/' },
    { text: t('operator.breadcrumb'), href: '/admin/home' },
    { text: t('models.breadcrumb'), href: '/admin/home' },
    { text: t('upload-to-car-status.breadcrumb') }
  ];

  const chartTheme = useChartTheme();

  // Stacked horizontal chart — one row per dimension (Status / Car / Job).
  // Each upload contributes a single 1-unit segment to all three rows, so
  // the segment boundaries line up across rows: the divider between two
  // jobs in the Job row sits at the same x position as the divider in
  // the Status and Car rows above it. The dividers themselves are drawn
  // by painting a borderColor that matches the chart container bg, so
  // they read as gaps in both light and dark mode.
  const horizontalChartLabels = ['Status', 'Car', 'Job'];
  const horizontalChartData = useMemo<ChartData<'bar'>>(() => {
    // Stable palette assignments — the same car name / job id always
    // gets the same swatch regardless of arrival order, so re-renders
    // after a new upload don't shuffle the colours.
    const carColours = new Map<string, string>();
    const jobColours = new Map<string, string>();
    for (const item of allItems) {
      if (item.carName && !carColours.has(item.carName)) {
        carColours.set(
          item.carName,
          categoricalPalette[carColours.size % categoricalPalette.length]
        );
      }
      if (item.jobId && !jobColours.has(item.jobId)) {
        jobColours.set(
          item.jobId,
          categoricalPalette[jobColours.size % categoricalPalette.length]
        );
      }
    }

    return {
      labels: horizontalChartLabels,
      datasets: allItems.map((item, idx) => {
        const carColour = item.carName
          ? carColours.get(item.carName)!
          : statusPalette.neutral;
        const jobColour = item.jobId
          ? jobColours.get(item.jobId)!
          : statusPalette.neutral;
        const labelParts: string[] = [item.status];
        if (item.carName) labelParts.push(item.carName);
        if (item.jobId) labelParts.push(item.jobId.slice(0, 8));

        // Adjacent uploads that belong to the same job merge into one
        // visual block — drop the divider on whichever side touches a
        // sibling with the same jobId. Applies across all three rows
        // because each upload is one dataset that paints all three.
        const prev = allItems[idx - 1];
        const next = allItems[idx + 1];
        const mergeLeft = !!(prev?.jobId && item.jobId && prev.jobId === item.jobId);
        const mergeRight = !!(next?.jobId && item.jobId && next.jobId === item.jobId);

        return {
          label: labelParts.join(' · '),
          data: [1, 1, 1],
          backgroundColor: [getColorForStatus(item.status), carColour, jobColour],
          borderColor: chartTheme.bgColor,
          // Per-side widths: row edges (top/bottom) stay borderless so
          // each row reads as a band; the seam borders (left/right)
          // disappear when the neighbouring upload shares this job.
          borderWidth: {
            top: 0,
            bottom: 0,
            left: mergeLeft ? 0 : 2,
            right: mergeRight ? 0 : 2,
          },
          borderSkipped: false,
          stack: 'all',
          // Stashed for the tooltip callbacks — Chart.js ignores extra
          // dataset properties so this is safe to ride along.
          _uploadInfo: {
            status: item.status,
            carName: item.carName,
            jobId: item.jobId,
            uploadStartTime: item.uploadStartTime,
          },
        } as any;
      }),
    };
  }, [allItems, chartTheme.bgColor]);

  const horizontalChartOptions = useMemo<ChartOptions<'bar'>>(
    () => ({
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      // Hover any segment of an upload and Chart.js activates the whole
      // dataset (i.e. all three row segments belonging to that upload),
      // so the tooltip can render a combined Status / Car / Job view
      // regardless of which row the cursor is over.
      interaction: { mode: 'dataset', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tooltipBaseOptions(chartTheme),
          callbacks: {
            title: (items) => {
              const info = (items[0]?.dataset as any)?._uploadInfo;
              if (!info?.uploadStartTime) return '';
              return new Date(info.uploadStartTime).toLocaleString('en-GB', {
                day: 'numeric',
                month: 'short',
                hour: 'numeric',
                minute: 'numeric',
                hour12: false,
              });
            },
            label: (item) => {
              const info = (item.dataset as any)._uploadInfo;
              if (!info) return '';
              const row = horizontalChartLabels[item.dataIndex];
              if (row === 'Status') return `Status: ${info.status}`;
              if (row === 'Car') return `Car: ${info.carName ?? '—'}`;
              if (row === 'Job') return `Job: ${info.jobId ? info.jobId.slice(0, 8) : '—'}`;
              return '';
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          beginAtZero: true,
          max: allItems.length || undefined,
          title: {
            display: true,
            text: t('upload-to-car-status.horizontal-bar.x-title'),
            color: chartTheme.tickColor,
          },
          grid: { color: chartTheme.gridColor },
          border: { color: chartTheme.axisColor },
          ticks: { color: chartTheme.tickColor, precision: 0 },
        },
        y: {
          stacked: true,
          grid: { display: false, color: chartTheme.gridColor },
          border: { color: chartTheme.axisColor },
          ticks: { color: chartTheme.tickColor },
        },
      },
    }),
    [allItems.length, chartTheme, t]
  );

  // Vertical bars over upload start time. Time-scale data points are
  // {x: epoch ms, y: duration} — chart.js places them on the time axis.
  // `barThickness` is fixed (rather than the default 'flex' / category-width
  // sizing) because the time scale would otherwise size each bar by the
  // smallest gap between two uploads; two uploads a few seconds apart
  // collapse every bar to a sub-pixel sliver that looks like an empty chart.
  const timeChartData = useMemo<ChartData<'bar', { x: number; y: number }[]>>(
    () => ({
      datasets: [
        {
          label: t('upload-to-car-status.upload-time.y-title'),
          data: barData.map((d) => ({
            x: d.x instanceof Date ? d.x.getTime() : new Date(d.x).getTime(),
            y: d.y,
          })),
          backgroundColor: categoricalPalette[0],
          borderWidth: 0,
          borderRadius: 2,
          barThickness: 8,
          maxBarThickness: 16,
        },
      ],
    }),
    [barData, t]
  );

  // Default window: the last hour up to now. The full data set is still
  // loaded; the user can drag-pan the chart leftward (or click the left
  // arrow) to walk back through earlier uploads. The window is held in
  // React state so the scroll arrows and chart options stay in sync —
  // onPanComplete commits the post-drag scale range back into state.
  const ONE_HOUR_MS = 60 * 60 * 1000;
  const HALF_HOUR_MS = 30 * 60 * 1000;
  const chartRef = useRef<any>(null);
  const [timeWindow, setTimeWindow] = useState(() => ({
    min: Date.now() - ONE_HOUR_MS,
    max: Date.now(),
  }));

  // Reset the window to "the last hour from now" when the underlying
  // data set changes, so a new upload nudges the view forward to
  // include the latest event.
  useEffect(() => {
    const max = Date.now();
    setTimeWindow({ min: max - ONE_HOUR_MS, max });
  }, [allItems]);

  // Numeric ms range of the loaded data — used both to clamp pan/zoom
  // and to decide whether each scroll arrow should appear.
  const dataRange = useMemo(() => {
    const times = barData
      .map((d) => (d.x instanceof Date ? d.x.getTime() : new Date(d.x).getTime()))
      .filter((n) => Number.isFinite(n));
    return times.length
      ? { min: Math.min(...times), max: Math.max(...times) }
      : null;
  }, [barData]);

  // For pan limits, clamp leftward scrolling to one hour before the
  // oldest upload and rightward scrolling to "now" so users can't drag
  // into empty future or scroll past their oldest data.
  const panBounds = useMemo(
    () => ({
      min: dataRange ? dataRange.min - ONE_HOUR_MS : undefined,
      max: Date.now(),
    }),
    [dataRange]
  );

  // Are there uploads outside the visible window in either direction?
  // Drives the chevron-arrow indicators alongside the chart edges.
  const canScrollLeft = !!dataRange && dataRange.min < timeWindow.min;
  const canScrollRight = !!dataRange && dataRange.max > timeWindow.max;

  // Shift the window by `deltaMs` (positive = forward in time). Clamps
  // against panBounds so we never scroll past the oldest data or into
  // the future.
  const scrollWindow = (deltaMs: number) => {
    const span = timeWindow.max - timeWindow.min;
    let newMin = timeWindow.min + deltaMs;
    let newMax = timeWindow.max + deltaMs;
    const lowerLimit = panBounds.min ?? newMin;
    const upperLimit = panBounds.max ?? newMax;
    if (newMin < lowerLimit) {
      newMin = lowerLimit;
      newMax = newMin + span;
    }
    if (newMax > upperLimit) {
      newMax = upperLimit;
      newMin = newMax - span;
    }
    setTimeWindow({ min: newMin, max: newMax });
  };

  const timeChartOptions = useMemo<ChartOptions<'bar'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tooltipBaseOptions(chartTheme),
          callbacks: {
            title: (items) => {
              const ts = items[0]?.parsed?.x;
              return ts
                ? new Date(ts).toLocaleTimeString('en-GB', {
                    hour: 'numeric',
                    minute: 'numeric',
                    second: 'numeric',
                    hour12: false,
                  })
                : '';
            },
          },
        },
        zoom: {
          pan: {
            enabled: true,
            mode: 'x',
            // Hold no modifier — straight drag pans. The wheel and
            // pinch zoom are deliberately left off, since the user
            // asked for scrollable history with a fixed 1-hour view,
            // not free zoom that could collapse the window.
            onPanComplete: ({ chart }: any) => {
              const scale = chart.scales.x;
              setTimeWindow({ min: scale.min, max: scale.max });
            },
          },
          limits: {
            x: {
              min: panBounds.min,
              max: panBounds.max,
            },
          },
        },
      },
      scales: {
        x: {
          type: 'time',
          min: timeWindow.min,
          max: timeWindow.max,
          // Mirror CloudScape's tick layout — let chart.js pick the right
          // unit for the visible range, then format with date-fns. The
          // hour/minute units render "29 May at 14:00" (matching the
          // CloudScape "<day> at HH:mm" style), and broader zooms get
          // sensible day/month labels.
          time: {
            // 1-hour window is always same-day, so the date is redundant on
            // the axis — strip it to keep ticks short. Broader-zoom formats
            // are inert (wheel/pinch zoom is off), but kept sensible in
            // case zoom is ever turned on.
            displayFormats: {
              minute: 'HH:mm',
              hour: 'HH:mm',
              day: 'd MMM',
              week: 'd MMM',
              month: 'MMM yyyy',
              quarter: 'MMM yyyy',
              year: 'yyyy',
            },
          },
          title: { display: true, text: 'Time (UTC)', color: chartTheme.tickColor },
          grid: { display: false, color: chartTheme.gridColor },
          border: { color: chartTheme.axisColor },
          ticks: {
            color: chartTheme.tickColor,
            autoSkip: true,
            autoSkipPadding: 20,
            maxRotation: 0,
          },
        },
        y: {
          beginAtZero: true,
          max: maxDuration || undefined,
          title: {
            display: true,
            text: t('upload-to-car-status.upload-time.y-title'),
            color: chartTheme.tickColor,
          },
          grid: { color: chartTheme.gridColor },
          border: { color: chartTheme.axisColor },
          ticks: { color: chartTheme.tickColor },
        },
      },
    }),
    [maxDuration, chartTheme, t, timeWindow, panBounds]
  );

  const emptyState = (
    <Box textAlign="center" color="inherit">
      <b>No data available</b>
      <Box variant="p" color="inherit">
        There is no data available
      </Box>
    </Box>
  );

  return (
    <div>
      <EventSelectorModal
        visible={eventSelectModalVisible}
        onDismiss={() => setEventSelectModalVisible(false)}
        onOk={() => setEventSelectModalVisible(false)}
      />

      <PageLayout
        helpPanelHidden={true}
        helpPanelContent={
          <SimpleHelpPanelLayout
            headerContent={t('header', { ns: 'help-admin-cars' })}
            bodyContent={t('content', { ns: 'help-admin-cars' })}
            footerContent={t('footer', { ns: 'help-admin-cars' })}
          />
        }
        header={t('upload-to-car-status.header')}
        description={t('upload-to-car-status.description')}
        breadcrumbs={breadcrumbs as any}
      >
        <SpaceBetween direction="vertical" size="l">
          <ColumnLayout columns={2}>
            <Container {...{ textAlign: "center", fitHeight: true } as any}>
              <Header variant={"h2" as any}>{t('upload-to-car-status.horizontal-bar.header')}</Header>
              {allItems.length > 0 ? (
                <div style={{ height: 250 }} aria-label="Stacked, horizontal bar chart">
                  <Bar data={horizontalChartData} options={horizontalChartOptions} />
                </div>
              ) : (
                emptyState
              )}
            </Container>

            <Container {...{ textAlign: "center", fitHeight: true } as any}>
              <Header variant={"h2" as any}>{t('upload-to-car-status.upload-time.header')}</Header>
              {barData.length > 0 ? (
                <div
                  style={{ height: 250, position: 'relative' }}
                  aria-label="Upload duration over time"
                >
                  <Bar ref={chartRef} data={timeChartData} options={timeChartOptions} />
                  {canScrollLeft && (
                    <button
                      type="button"
                      onClick={() => scrollWindow(-HALF_HOUR_MS)}
                      aria-label="Show earlier uploads"
                      style={{
                        position: 'absolute',
                        // Sit below the x-axis on the same baseline as the
                        // "Time (UTC)" title — out of the plot area entirely,
                        // so they never overlap bars, tick labels, or the
                        // y-axis "Seconds" title.
                        left: 8,
                        bottom: 0,
                        background: chartTheme.tooltipBgColor,
                        border: `1px solid ${chartTheme.tooltipBorderColor}`,
                        borderRadius: 4,
                        padding: '4px 6px',
                        cursor: 'pointer',
                        color: chartTheme.tickColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1,
                      }}
                    >
                      <Icon name="angle-left" />
                    </button>
                  )}
                  {canScrollRight && (
                    <button
                      type="button"
                      onClick={() => scrollWindow(HALF_HOUR_MS)}
                      aria-label="Show later uploads"
                      style={{
                        position: 'absolute',
                        right: 8,
                        bottom: 0,
                        background: chartTheme.tooltipBgColor,
                        border: `1px solid ${chartTheme.tooltipBorderColor}`,
                        borderRadius: 4,
                        padding: '4px 6px',
                        cursor: 'pointer',
                        color: chartTheme.tickColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1,
                      }}
                    >
                      <Icon name="angle-right" />
                    </button>
                  )}
                </div>
              ) : (
                emptyState
              )}
            </Container>
          </ColumnLayout>

          <PageTable
            selectedItems={selectedItems}
            setSelectedItems={setSelectedItems}
            tableItems={allItems}
            columnConfiguration={columnConfiguration}
            header={
              <TableHeader
                nrSelectedItems={selectedItems.length}
                nrTotalItems={allItems.length}
                header={t('upload-to-car-status.header')}
                actions={<HeaderActionButtons />}
              />
            }
            itemsIsLoading={isLoading}
            loadingText={t('upload-to-car-status.loading')}
            localStorageKey={'cars-table-preferences'}
            trackBy={'InstanceId'}
            filteringProperties={filteringProperties}
            filteringI18nStringsName={'devices'}
          />
        </SpaceBetween>
      </PageLayout>
    </div>
  );
};

export { UploadToCarStatus };
