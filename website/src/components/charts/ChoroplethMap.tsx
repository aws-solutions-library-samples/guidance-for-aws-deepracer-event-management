import { Chart } from 'chart.js';
import {
  ChoroplethController,
  GeoFeature,
  ColorScale,
  ProjectionScale,
} from 'chartjs-chart-geo';
import { feature } from 'topojson-client';
import { Chart as ReactChart } from 'react-chartjs-2';
import { useMemo } from 'react';
import { useChartTheme } from './chartDefaults';
import worldAtlas from 'world-atlas/countries-50m.json';

Chart.register(ChoroplethController, GeoFeature, ColorScale, ProjectionScale);

const alpha2ToNumeric: Record<string, string> = {
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

export interface ChoroplethMapProps {
  data: { countryCode: string; events: number; racers: number; laps: number }[];
  height?: number;
}

export function ChoroplethMap({ data, height = 400 }: ChoroplethMapProps) {
  const chartTheme = useChartTheme();

  const countries = useMemo(
    () => (feature(worldAtlas as any, (worldAtlas as any).objects.countries) as any).features as any[],
    []
  );

  const countryDataMap = useMemo(() => {
    const map: Record<string, { events: number; racers: number; laps: number }> = {};
    for (const d of data) {
      const numericId = alpha2ToNumeric[d.countryCode];
      if (numericId) map[numericId] = d;
    }
    return map;
  }, [data]);

  const chartData = useMemo(
    () => ({
      labels: countries.map((c: any) => c.properties?.name ?? c.id),
      datasets: [
        {
          label: 'Events',
          outline: countries,
          outlineBorderWidth: 0.5,
          borderWidth: 1,
          borderColor: '#999999',
          data: countries.map((c: any) => ({
            feature: c,
            value: countryDataMap[c.id]?.events ?? 0,
          })),
        },
      ],
    }),
    [countries, countryDataMap]
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      showOutline: true,
      showGraticule: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(ctx: any) {
              const numericId = countries[ctx.dataIndex]?.id;
              const d = numericId ? countryDataMap[numericId] : null;
              if (!d) return 'No events';
              return [
                `Events: ${d.events}`,
                `Racers: ${d.racers}`,
                `Laps: ${d.laps}`,
              ];
            },
          },
        },
      },
      scales: {
        projection: {
          axis: 'x' as const,
          projection: 'equalEarth',
        },
        color: {
          axis: 'x' as const,
          legend: {
            position: 'bottom-right' as const,
            align: 'right' as const,
          },
          interpolate: (v: number) => {
            if (v === 0) return '#ffffff';
            const logV = Math.log1p(v * 10) / Math.log1p(10);
            const r = Math.round(220 - logV * 180);
            const g = Math.round(230 - logV * 150);
            const b = Math.round(255);
            return `rgb(${r}, ${g}, ${b})`;
          },
          missing: '#ffffff',
        },
      },
    }),
    [chartTheme, countries, countryDataMap]
  );

  return (
    <div style={{ height, position: 'relative' }}>
      <ReactChart type="choropleth" data={chartData as any} options={options as any} />
    </div>
  );
}
