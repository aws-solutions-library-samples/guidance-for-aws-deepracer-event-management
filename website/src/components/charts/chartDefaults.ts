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
import { useEffect, useState } from 'react';

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
 * Chart.js renders to canvas and can't resolve CSS variables, so we resolve
 * the active CSS variable value at runtime via getComputedStyle.
 *
 * Falls back to the hex literal in the var() expression when the variable
 * isn't defined yet (e.g. before CloudScape stylesheets apply, or during SSR).
 */
export function resolveToken(tokenValue: string): string {
  if (typeof window !== 'undefined' && document.body) {
    const varMatch = /^var\((--[^,)]+)/.exec(tokenValue);
    if (varMatch) {
      // CloudScape's dark mode is applied by adding `awsui-dark-mode` to
      // <body>, and the design-token CSS variables are redefined under that
      // class — so we have to read from a descendant of <body> (or <body>
      // itself) to see the active theme's value. Reading from
      // documentElement misses dark-mode overrides.
      const live = getComputedStyle(document.body).getPropertyValue(varMatch[1]).trim();
      if (live) return live;
    }
  }
  const hexMatch = /#[0-9a-fA-F]{3,8}/.exec(tokenValue);
  return hexMatch ? hexMatch[0] : tokenValue;
}

/**
 * Resolve a single CloudScape design-token CSS-var expression to its live
 * value, theme-reactive in the same way `useChartTheme` is. Useful for
 * colours not part of the standard chart theme (e.g. the per-lap status
 * colours in the commentator race-stats chart).
 */
export function useResolvedToken(tokenValue: string): string {
  const [value, setValue] = useState<string>(() => resolveToken(tokenValue));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const refresh = () => setValue(resolveToken(tokenValue));
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-mode', 'style'],
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'data-mode', 'style'],
    });
    refresh();
    return () => observer.disconnect();
  }, [tokenValue]);

  return value;
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

export interface ChartTheme {
  gridColor: string;
  axisColor: string;
  tickMarkColor: string;
  tickColor: string;
  titleColor: string;
  tooltipBgColor: string;
  tooltipBorderColor: string;
  tooltipTextColor: string;
}

function readChartTheme(): ChartTheme {
  return {
    gridColor: resolveToken(tokens.colorChartsLineGrid),
    axisColor: resolveToken(tokens.colorChartsLineAxis),
    tickMarkColor: resolveToken(tokens.colorChartsLineTick),
    tickColor: resolveToken(tokens.colorTextBodySecondary),
    titleColor: resolveToken(tokens.colorTextHeadingDefault),
    // Use CloudScape's popover tokens — purpose-built for floating surfaces
    // and theme-aware (white-on-dark in light mode, dark-on-light in dark
    // mode). The previous hardcoded `rgba(255,255,255,0.96)` rendered
    // illegible tooltips against the dark theme.
    tooltipBgColor: resolveToken(tokens.colorBackgroundPopover),
    tooltipBorderColor: resolveToken(tokens.colorBorderPopover),
    tooltipTextColor: resolveToken(tokens.colorTextBodyDefault),
  };
}

/**
 * Status colours (success, failure, in-progress, etc.) resolved once at
 * module load — for any chart.js visualisation that needs to colour
 * categorical status values consistently with the rest of CloudScape.
 *
 * Use as a `Record<string, string>` keyed by your domain status names; map
 * each domain value to one of the slots below.
 */
export const statusPalette = {
  positive: resolveToken(tokens.colorChartsStatusPositive),
  critical: resolveToken(tokens.colorChartsStatusCritical),
  info: resolveToken(tokens.colorChartsStatusInfo),
  low: resolveToken(tokens.colorChartsStatusLow),
  neutral: resolveToken(tokens.colorChartsStatusNeutral),
} as const;

/**
 * Standard chart.js tooltip options block. Pass a `ChartTheme` (from
 * `useChartTheme()`) so the tooltip background / border / text follow
 * the active CloudScape light/dark theme. Spread into
 * `options.plugins.tooltip` and override fields per-chart as needed.
 */
export function tooltipBaseOptions(theme: ChartTheme) {
  return {
    backgroundColor: theme.tooltipBgColor,
    borderColor: theme.tooltipBorderColor,
    borderWidth: 1,
    titleColor: theme.tooltipTextColor,
    bodyColor: theme.tooltipTextColor,
    displayColors: false,
    padding: 8,
    cornerRadius: 4,
  };
}

/**
 * Reactive chart theme — recomputes when CloudScape's dark-mode class flips
 * on `<body>` or `<html>` so chart.js canvases redraw with the correct
 * tick/grid/axis colours.
 *
 * Charts using this hook will re-render automatically on theme change because
 * the returned object reference changes.
 */
export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(readChartTheme);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const refresh = () => setTheme(readChartTheme());

    // CloudScape applies the dark mode by toggling classes/attributes on
    // <html> and <body>. Observe both to catch whichever it uses.
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-mode', 'style'],
    });
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'data-mode', 'style'],
    });

    // CloudScape's theme switch can race with the first React render — do a
    // single follow-up read after mount so the initial chart paint picks up
    // the correct theme even if the stylesheet hadn't settled yet.
    refresh();

    return () => observer.disconnect();
  }, []);

  return theme;
}
