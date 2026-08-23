/**
 * Pure helper for the /stats "Country breakdown" toggle.
 *
 * Given the raw `eventsByCountry` rows from `getGlobalStats`, return rows
 * shaped for downstream chart components: a single `value` per row that
 * tracks the active metric, plus the original counts preserved so the
 * WorldMap tooltip can still show events/racers/laps as context regardless
 * of which metric drives the colour scale.
 *
 * `avgLapsPerEvent` returns the raw quotient; rounding for display is a
 * tooltip concern, kept out of this pure layer so the chart's y-axis can
 * use the unrounded number.
 */
export type MetricKey = 'events' | 'laps' | 'avgLapsPerEvent';

export interface CountryRow {
  countryCode: string;
  events: number;
  racers: number;
  laps: number;
}

export interface DerivedCountryRow extends CountryRow {
  value: number;
}

export function deriveCountryMetric(
  rows: CountryRow[],
  metric: MetricKey,
): DerivedCountryRow[] {
  return rows.map((row) => {
    let value: number;
    switch (metric) {
      case 'events':
        value = row.events;
        break;
      case 'laps':
        value = row.laps;
        break;
      case 'avgLapsPerEvent':
        // Defensive guard: server normally excludes zero-event countries,
        // but if one slips through don't surface NaN.
        value = row.events > 0 ? row.laps / row.events : 0;
        break;
    }
    return { ...row, value };
  });
}
