/**
 * Bar chart wrapper around chart.js / react-chartjs-2.
 * Defaults styled from CloudScape design tokens so it sits visually
 * alongside the rest of the DREM UI.
 */
import { ChartOptions } from 'chart.js';
import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { categoricalPalette, tooltipBaseOptions, useChartTheme } from './chartDefaults';

export interface BarChartProps {
  /**
   * Tick labels. Each element can be a string (single-line tick) or a
   * string[] (multi-line tick, one entry per line — chart.js renders each
   * inner string on its own line).
   */
  labels: (string | string[])[];
  values: number[];
  seriesLabel?: string;
  yTitle?: string;
  xTitle?: string;
  height?: number;
  color?: string;
}

export function BarChart({
  labels,
  values,
  seriesLabel,
  yTitle,
  xTitle,
  height = 300,
  color = categoricalPalette[0],
}: BarChartProps) {
  const chartTheme = useChartTheme();
  const options = useMemo<ChartOptions<'bar'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: tooltipBaseOptions(chartTheme),
      },
      scales: {
        x: {
          title: xTitle ? { display: true, text: xTitle, color: chartTheme.tickColor } : undefined,
          grid: { display: false, color: chartTheme.gridColor },
          border: { color: chartTheme.axisColor },
          ticks: { color: chartTheme.tickColor, autoSkip: false, maxRotation: 0 },
        },
        y: {
          beginAtZero: true,
          title: yTitle ? { display: true, text: yTitle, color: chartTheme.tickColor } : undefined,
          grid: { color: chartTheme.gridColor },
          border: { color: chartTheme.axisColor },
          ticks: { color: chartTheme.tickColor },
        },
      },
    }),
    [xTitle, yTitle, chartTheme]
  );

  return (
    <div style={{ height }}>
      <Bar
        data={{
          labels,
          datasets: [
            {
              label: seriesLabel ?? '',
              data: values,
              backgroundColor: color,
              borderColor: color,
              borderWidth: 1,
              borderRadius: 2,
            },
          ],
        }}
        options={options}
      />
    </div>
  );
}
