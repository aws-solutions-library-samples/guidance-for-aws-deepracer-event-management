/**
 * Shared chart.js configuration for DREM.
 *
 * Registers the chart.js components we use and exposes a palette drawn from
 * CloudScape design tokens so our chart.js-based visualisations stay visually
 * consistent with the rest of the app (and auto-adapt when dark mode lands).
 */
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PieController,
  PointElement,
  TimeScale,
  Title,
  Tooltip,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import * as tokens from '@cloudscape-design/design-tokens';

Chart.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PieController,
  PointElement,
  TimeScale,
  Title,
  Tooltip
);

// Categorical palette from CloudScape design tokens.
// Auto-adapts to dark mode when the dark-mode toggle lands (#179).
export const categoricalPalette: string[] = [
  tokens.colorChartsPaletteCategorical1,
  tokens.colorChartsPaletteCategorical2,
  tokens.colorChartsPaletteCategorical3,
  tokens.colorChartsPaletteCategorical4,
  tokens.colorChartsPaletteCategorical5,
  tokens.colorChartsPaletteCategorical6,
  tokens.colorChartsPaletteCategorical7,
  tokens.colorChartsPaletteCategorical8,
  tokens.colorChartsPaletteCategorical9,
  tokens.colorChartsPaletteCategorical10,
  tokens.colorChartsPaletteCategorical11,
  tokens.colorChartsPaletteCategorical12,
  tokens.colorChartsPaletteCategorical13,
  tokens.colorChartsPaletteCategorical14,
  tokens.colorChartsPaletteCategorical15,
  tokens.colorChartsPaletteCategorical16,
  tokens.colorChartsPaletteCategorical17,
  tokens.colorChartsPaletteCategorical18,
  tokens.colorChartsPaletteCategorical19,
  tokens.colorChartsPaletteCategorical20,
  tokens.colorChartsPaletteCategorical21,
  tokens.colorChartsPaletteCategorical22,
  tokens.colorChartsPaletteCategorical23,
  tokens.colorChartsPaletteCategorical24,
  tokens.colorChartsPaletteCategorical25,
  tokens.colorChartsPaletteCategorical26,
  tokens.colorChartsPaletteCategorical27,
  tokens.colorChartsPaletteCategorical28,
  tokens.colorChartsPaletteCategorical29,
  tokens.colorChartsPaletteCategorical30,
];

export const chartTheme = {
  gridColor: tokens.colorChartsLineGrid,
  axisColor: tokens.colorChartsLineAxis,
  tickColor: tokens.colorChartsLineTick,
} as const;
