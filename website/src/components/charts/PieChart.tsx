/**
 * Pie / doughnut chart wrapper around chart.js / react-chartjs-2.
 * Uses CloudScape's categorical palette so segment colours line up with
 * the rest of the DREM UI.
 */
import { ChartOptions } from 'chart.js';
import { useMemo } from 'react';
import { Pie } from 'react-chartjs-2';
import { categoricalPalette, chartTheme } from './chartDefaults';

export interface PieSegment {
  label: string;
  value: number;
}

export interface PieChartProps {
  data: PieSegment[];
  height?: number;
}

export function PieChart({ data, height = 320 }: PieChartProps) {
  const colors = useMemo(
    () => data.map((_, i) => categoricalPalette[i % categoricalPalette.length]),
    [data]
  );

  const options = useMemo<ChartOptions<'pie'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: chartTheme.tickColor, boxWidth: 12 },
        },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.96)',
          borderColor: chartTheme.axisColor,
          borderWidth: 1,
          titleColor: chartTheme.tickColor,
          bodyColor: chartTheme.tickColor,
        },
      },
    }),
    []
  );

  return (
    <div style={{ height }}>
      <Pie
        data={{
          labels: data.map((d) => d.label),
          datasets: [
            {
              data: data.map((d) => d.value),
              backgroundColor: colors,
              borderColor: 'white',
              borderWidth: 2,
            },
          ],
        }}
        options={options}
      />
    </div>
  );
}
