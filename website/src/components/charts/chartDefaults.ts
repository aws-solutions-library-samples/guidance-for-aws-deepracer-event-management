/**
 * Shared chart.js configuration for DREM.
 *
 * Registers the chart.js components we use and exposes a palette drawn from
 * CloudScape design tokens so our chart.js-based visualisations stay visually
 * consistent with the rest of the app.
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

/**
 * CloudScape design tokens export colours as CSS var() expressions with a
 * hex fallback, e.g. `"var(--color-charts-palette-categorical-1-xxx, #688AE8)"`.
 * Chart.js renders to canvas and can't resolve CSS variables, so we pull the
 * hex fallback out.
 *
 * TODO when dark mode ships (#179): replace with a runtime resolver that
 * reads the CSS variable via getComputedStyle so colours adapt to the
 * current theme. For now the hex fallback is the light-mode value.
 */
function resolveToken(tokenValue: string): string {
  const match = /#[0-9a-fA-F]{3,8}/.exec(tokenValue);
  return match ? match[0] : tokenValue;
}

// Categorical palette resolved from CloudScape design tokens.
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
].map(resolveToken);

export const chartTheme = {
  gridColor: resolveToken(tokens.colorChartsLineGrid),
  axisColor: resolveToken(tokens.colorChartsLineAxis),
  tickMarkColor: resolveToken(tokens.colorChartsLineTick),
  tickColor: resolveToken(tokens.colorTextBodySecondary),
  titleColor: resolveToken(tokens.colorTextHeadingDefault),
} as const;
