/**
 * Choropleth world map for the stats dashboard.
 *
 * Each country is shaded by the supplied `value` (lighter = fewer, darker
 * = more, white = none). The parent picks what `value` represents (event
 * count, lap count, etc.) and passes the matching `metricLabel`. Tooltip
 * shows the localised country name, the metric value, plus event / racer /
 * lap counts as context.
 *
 * Implementation notes:
 *
 * - Uses `chartjs-chart-geo` so we stay inside the chart.js ecosystem
 *   already adopted for the other stats charts.
 * - Country shapes come from the `world-atlas` topojson (50m resolution).
 * - DREM stores country codes as ISO 3166-1 alpha-2 (e.g. `GB`); the
 *   world-atlas topojson keys features by numeric ISO codes (e.g. `826`),
 *   so we keep a small static lookup table in this file. Avoiding a
 *   third-party `i18n-iso-countries` dep — ISO codes don't change and we
 *   don't need the full library for one lookup.
 * - Log-scaled blue interpolator: a handful of countries have 100+ events
 *   and most have 1–5, so a linear ramp washes out the long tail. Log
 *   scale keeps low-count countries readable while still emphasising the
 *   big players. White for zero events.
 * - Localised tooltip via the existing browser-built-in `Intl.DisplayNames`
 *   — no extra dep, supports every i18n language the project ships.
 * - Theme-reactive via `useChartTheme` so the country borders track with
 *   dark mode.
 */
import { Chart, ChartConfiguration } from 'chart.js';
import {
  ChoroplethController,
  GeoFeature,
  ColorScale,
  ProjectionScale,
} from 'chartjs-chart-geo';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import worldAtlas from 'world-atlas/countries-50m.json';
import { useChartTheme } from './chartDefaults';

Chart.register(ChoroplethController, GeoFeature, ColorScale, ProjectionScale);

// ISO 3166-1 alpha-2 → numeric. Embedded rather than pulled from a lib;
// the values are static, this list is exhaustive for countries DREM is
// realistically going to see, and the maintenance cost is essentially zero.
const ALPHA2_TO_NUMERIC: Record<string, string> = {
  AF: '004', AL: '008', DZ: '012', AS: '016', AD: '020', AO: '024', AG: '028',
  AR: '032', AM: '051', AU: '036', AT: '040', AZ: '031', BS: '044', BH: '048',
  BD: '050', BB: '052', BY: '112', BE: '056', BZ: '084', BJ: '204', BT: '064',
  BO: '068', BA: '070', BW: '072', BR: '076', BN: '096', BG: '100', BF: '854',
  BI: '108', KH: '116', CM: '120', CA: '124', CV: '132', CF: '140', TD: '148',
  CL: '152', CN: '156', CO: '170', KM: '174', CG: '178', CD: '180', CR: '188',
  CI: '384', HR: '191', CU: '192', CY: '196', CZ: '203', DK: '208', DJ: '262',
  DM: '212', DO: '214', EC: '218', EG: '818', SV: '222', GQ: '226', ER: '232',
  EE: '233', ET: '231', FJ: '242', FI: '246', FR: '250', GA: '266', GM: '270',
  GE: '268', DE: '276', GH: '288', GR: '300', GD: '308', GT: '320', GN: '324',
  GW: '624', GY: '328', HT: '332', HN: '340', HU: '348', IS: '352', IN: '356',
  ID: '360', IR: '364', IQ: '368', IE: '372', IL: '376', IT: '380', JM: '388',
  JP: '392', JO: '400', KZ: '398', KE: '404', KI: '296', KP: '408', KR: '410',
  KW: '414', KG: '417', LA: '418', LV: '428', LB: '422', LS: '426', LR: '430',
  LY: '434', LI: '438', LT: '440', LU: '442', MK: '807', MG: '450', MW: '454',
  MY: '458', MV: '462', ML: '466', MT: '470', MH: '584', MR: '478', MU: '480',
  MX: '484', FM: '583', MD: '498', MC: '492', MN: '496', ME: '499', MA: '504',
  MZ: '508', MM: '104', NA: '516', NR: '520', NP: '524', NL: '528', NZ: '554',
  NI: '558', NE: '562', NG: '566', NO: '578', OM: '512', PK: '586', PW: '585',
  PA: '591', PG: '598', PY: '600', PE: '604', PH: '608', PL: '616', PT: '620',
  QA: '634', RO: '642', RU: '643', RW: '646', KN: '659', LC: '662', VC: '670',
  WS: '882', SM: '674', ST: '678', SA: '682', SN: '686', RS: '688', SC: '690',
  SL: '694', SG: '702', SK: '703', SI: '705', SB: '090', SO: '706', ZA: '710',
  SS: '728', ES: '724', LK: '144', SD: '736', SR: '740', SZ: '748', SE: '752',
  CH: '756', SY: '760', TW: '158', TJ: '762', TZ: '834', TH: '764', TL: '626',
  TG: '768', TO: '776', TT: '780', TN: '788', TR: '792', TM: '795', TV: '798',
  UG: '800', UA: '804', AE: '784', GB: '826', US: '840', UY: '858', UZ: '860',
  VU: '548', VE: '862', VN: '704', YE: '887', ZM: '894', ZW: '716',
};

interface CountryDatum {
  countryCode: string;
  /**
   * Pre-derived value for the choropleth (e.g. events count, laps count,
   * or avg laps per event). The parent decides what this number means and
   * passes the matching label via `metricLabel`.
   */
  value: number;
  // Raw counts retained so the tooltip can show all three regardless of
  // which metric drives the colour scale.
  events: number;
  racers: number;
  laps: number;
}

interface WorldMapProps {
  data: CountryDatum[];
  /**
   * Localised label for the primary tooltip line + chart.js dataset label.
   * E.g. "Events", "Laps", "Avg laps per event".
   */
  metricLabel: string;
  /**
   * Optional formatter for the primary tooltip value. Defaults to identity
   * (integer-friendly). Use for the avg metric to render 1-decimal output.
   */
  formatValue?: (v: number) => string;
  height?: number;
}

// Extract topojson country features once on module load — the parse is
// ~10ms for the 50m file and the result is static.
const worldFeatures = (() => {
  const fc = feature(
    worldAtlas as unknown as Topology,
    (worldAtlas as any).objects.countries,
  );
  // Returns a FeatureCollection for the countries layer; cast through
  // unknown since the .d.ts overload is over-narrowed to Feature.
  return (fc as unknown as { features: any[] }).features;
})();

export function WorldMap({ data, metricLabel, formatValue, height = 400 }: WorldMapProps) {
  const { t, i18n } = useTranslation();
  const theme = useChartTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Find the max value once per data refresh so the log-scaled
  // interpolator can normalise. Falls back to 1 to avoid log(0).
  const maxValue = useMemo(
    () => Math.max(1, ...data.map((d) => d.value)),
    [data],
  );

  // Index by topojson numeric id so the chart's per-feature data lookup is
  // O(1) instead of O(n) per render.
  const byNumericId = useMemo(() => {
    const map = new Map<string, CountryDatum>();
    for (const row of data) {
      const id = ALPHA2_TO_NUMERIC[row.countryCode];
      if (id) map.set(id, row);
    }
    return map;
  }, [data]);

  // Use Intl.DisplayNames for localised country names in the tooltip — it's
  // browser-native (Chrome 81+, Safari 14.1+, Firefox 86+), supports every
  // locale, and avoids pulling in another country-name dep.
  const countryNames = useMemo(() => {
    const lang = i18n.language?.split('-')[0] || 'en';
    try {
      return new Intl.DisplayNames([lang], { type: 'region' });
    } catch {
      return new Intl.DisplayNames(['en'], { type: 'region' });
    }
  }, [i18n.language]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const datapoints = worldFeatures.map((featureGeom) => {
      const numericId = String(featureGeom.id);
      const matched = byNumericId.get(numericId);
      return {
        feature: featureGeom,
        value: matched?.value ?? 0,
        countryCode: matched?.countryCode,
        events: matched?.events ?? 0,
        racers: matched?.racers ?? 0,
        laps: matched?.laps ?? 0,
      };
    });

    const config: ChartConfiguration<'choropleth'> = {
      type: 'choropleth',
      data: {
        labels: worldFeatures.map((f) => (f.properties as any)?.name ?? ''),
        datasets: [
          {
            label: metricLabel,
            outline: worldFeatures,
            data: datapoints as any,
            // Subtle separator between countries — uses the theme axis
            // colour so it tracks with dark mode (vs Steve's hardcoded
            // #999999 which would look off against the dark map).
            borderColor: theme.axisColor,
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        showOutline: true,
        showGraticule: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            // chart.js default styling (translucent dark + white text)
            // reads cleanly in both light and dark modes — better than
            // forcing a theme-tied colour like the other DREM charts do,
            // which all look washed out against dark mode.
            displayColors: false,
            callbacks: {
              title(items) {
                const raw: any = items[0]?.raw;
                const code: string | undefined = raw?.countryCode;
                // Prefer the localised display name; fall back to the
                // topojson feature's English name, then the chart label.
                if (code) {
                  try {
                    const name = countryNames.of(code);
                    if (name) return name;
                  } catch {
                    // ignore — fall through
                  }
                }
                const fromGeom: string | undefined =
                  raw?.feature?.properties?.name;
                return fromGeom || (items[0]?.label as string);
              },
              label(item) {
                const raw: any = item.raw;
                if (!raw?.countryCode) return t('stats.no-events') as string;
                const primary = formatValue
                  ? formatValue(raw.value ?? 0)
                  : String(raw.value ?? 0);
                return [
                  `${metricLabel}: ${primary}`,
                  `${t('stats.events')}: ${raw.events ?? 0}`,
                  `${t('stats.racers')}: ${raw.racers ?? 0}`,
                  `${t('stats.laps')}: ${raw.laps ?? 0}`,
                ];
              },
            },
          },
        },
        scales: {
          // Equal Earth — area-preserving projection, less Northern-
          // Hemisphere distortion than Mercator.
          projection: {
            axis: 'x',
            projection: 'equalEarth',
          } as any,
          color: {
            axis: 'x',
            legend: {
              position: 'bottom-right',
              align: 'right',
            },
            // Log-scaled blue ramp. Most countries have 1–5 events, a few
            // have 100+. A linear scale washes out the long tail, so map
            // each value v ∈ [0, max] to log1p(v) / log1p(max) and lerp
            // between a near-white and a strong blue. White (#ffffff) for
            // zero — visually distinguishes "no events" from "few events".
            interpolate: (v: number) => {
              if (v <= 0) return '#ffffff';
              const t = Math.log1p(v * maxValue) / Math.log1p(maxValue);
              const r = Math.round(220 - t * 180);
              const g = Math.round(230 - t * 150);
              return `rgb(${r}, ${g}, 255)`;
            },
            missing: '#ffffff',
          } as any,
        },
      },
    };

    const chart = new Chart(canvasRef.current, config);
    return () => {
      chart.destroy();
    };
  }, [byNumericId, maxValue, theme, t, countryNames, metricLabel, formatValue]);

  return (
    <div style={{ height }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
