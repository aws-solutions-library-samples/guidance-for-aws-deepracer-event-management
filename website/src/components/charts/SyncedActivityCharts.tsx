/**
 * Three stacked line charts with a crosshair that stays in sync across all
 * three on mouse hover. Each chart has its own Y-axis scale so metrics with
 * very different magnitudes (events/races/laps) can share the same X axis
 * without one flattening the others.
 *
 * chart.js-based; replaces the earlier CloudScape LineChart + DOM overlay
 * implementation.
 */
import { ChartOptions, Plugin } from 'chart.js';
import { useMemo, useRef } from 'react';
import { Line } from 'react-chartjs-2';
import { chartTheme } from './chartDefaults';

// react-chartjs-2 ref type. The package uses a wrapper type `ChartJSOrUndefined`,
// but we only need the subset of the Chart.js API used below so `any` keeps
// the ref assignment straightforward without importing internal types.
type LineChartRef = any;

export interface ActivitySeries {
  title: string;
  color: string;
  values: number[];
}

export interface SyncedActivityChartsProps {
  dates: Date[];
  series: ActivitySeries[];
  height?: number;
}

// Chart.js plugin that draws a vertical crosshair line at the currently
// active tooltip point. Registered per-chart instance below so the line
// only appears when the chart has an active tooltip.
const crosshairPlugin: Plugin<'line'> = {
  id: 'syncedCrosshair',
  afterDatasetsDraw(chart) {
    const active = chart.tooltip?.getActiveElements() ?? [];
    if (active.length === 0) return;
    const x = active[0].element.x;
    const { top, bottom } = chart.chartArea;
    const ctx = chart.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.lineWidth = 1;
    ctx.strokeStyle = chartTheme.tickColor;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.restore();
  },
};

export function SyncedActivityCharts({
  dates,
  series,
  height = 180,
}: SyncedActivityChartsProps) {
  const chartRefs = useRef<Array<LineChartRef>>([]);

  const commonOptions = useMemo<ChartOptions<'line'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(255, 255, 255, 0.96)',
          borderColor: chartTheme.axisColor,
          borderWidth: 1,
          titleColor: chartTheme.tickColor,
          bodyColor: chartTheme.tickColor,
          displayColors: false,
          callbacks: {
            // The default time-axis title renders as a full locale date/time —
            // we only want "Mar 2025".
            title(items) {
              if (items.length === 0) return '';
              const raw = items[0].parsed.x;
              if (raw == null) return '';
              return new Date(raw).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
              });
            },
          },
        },
      },
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'month',
            displayFormats: { month: 'MMM' },
          },
          grid: { color: chartTheme.gridColor },
          border: { color: chartTheme.axisColor },
          ticks: {
            color: chartTheme.tickColor,
            autoSkip: true,
            maxRotation: 0,
            callback(value) {
              const d = new Date(value as number);
              return d.getMonth() === 0
                ? String(d.getFullYear())
                : d.toLocaleDateString(undefined, { month: 'short' });
            },
            font(ctx) {
              const tick = ctx.tick;
              if (tick && tick.value !== undefined) {
                const d = new Date(tick.value);
                if (d.getMonth() === 0) return { weight: 'bold' };
              }
              return {};
            },
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: chartTheme.gridColor },
          border: { color: chartTheme.axisColor },
          ticks: { color: chartTheme.tickColor },
          // Force the Y axis to a fixed width so the plot areas of stacked
          // charts line up even when label digits differ (10 vs 1,000 vs
          // 6,000). Without this the charts left-edges drift and the
          // synced crosshair looks misaligned between panels.
          afterFit(scaleInstance) {
            scaleInstance.width = 60;
          },
        },
      },
    }),
    []
  );

  const onHoverSync = (chartIdx: number) => (event: any, _elements: any) => {
    // Propagate the hover position to the other charts so the crosshair
    // and tooltip align across all three.
    chartRefs.current.forEach((chart, i) => {
      if (!chart || i === chartIdx) return;
      const canvasPos = {
        x: event.x,
        y: chart.chartArea.top + 1,
      };
      const activeElements = chart.data.datasets
        .map((_ds: any, dsIdx: number) => {
          const index = chart.scales.x.getValueForPixel(canvasPos.x);
          if (index === undefined) return null;
          // find nearest data index
          const xValues = chart.data.datasets[dsIdx].data.map((d: any) => d.x);
          let nearest = 0;
          let nearestDist = Infinity;
          xValues.forEach((xv: number, idx: number) => {
            const dist = Math.abs(xv - index);
            if (dist < nearestDist) {
              nearestDist = dist;
              nearest = idx;
            }
          });
          return { datasetIndex: dsIdx, index: nearest };
        })
        .filter(Boolean) as Array<{ datasetIndex: number; index: number }>;

      chart.setActiveElements(activeElements);
      chart.tooltip?.setActiveElements(activeElements, canvasPos);
      chart.update('none');
    });
  };

  const onLeaveSync = () => {
    chartRefs.current.forEach((chart) => {
      if (!chart) return;
      chart.setActiveElements([]);
      chart.tooltip?.setActiveElements([], { x: 0, y: 0 });
      chart.update('none');
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {series.map((s, i) => {
        const data = {
          datasets: [
            {
              label: s.title,
              data: dates.map((d, idx) => ({ x: d.getTime(), y: s.values[idx] })),
              borderColor: s.color,
              backgroundColor: s.color + '22',
              pointRadius: 0,
              pointHoverRadius: 4,
              pointHoverBackgroundColor: s.color,
              borderWidth: 2,
              tension: 0.25,
              fill: true,
            },
          ],
        };
        return (
          <div
            key={s.title}
            style={{ height, position: 'relative' }}
            onMouseLeave={onLeaveSync}
          >
            <Line
              ref={(el) => {
                chartRefs.current[i] = el;
              }}
              data={data}
              options={{
                ...commonOptions,
                onHover: onHoverSync(i),
                plugins: {
                  ...commonOptions.plugins,
                  title: {
                    display: true,
                    text: s.title,
                    color: s.color,
                    align: 'start',
                    font: { size: 13, weight: 'bold' },
                  },
                },
              }}
              plugins={[crosshairPlugin]}
            />
          </div>
        );
      })}
    </div>
  );
}
