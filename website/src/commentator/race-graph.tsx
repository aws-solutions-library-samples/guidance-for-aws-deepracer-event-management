/**
 * Race lap times chart for the commentator race-statistics view.
 *
 * Renders one bar per lap, colour-coded by lap status:
 *   - red:    invalid lap
 *   - yellow: valid lap
 *   - green:  fastest lap of this race
 *   - purple: fastest lap of this race AND faster than the event-wide best
 *             (i.e. a new event record was set in this race)
 *
 * Plus a dashed horizontal threshold line at the event-wide fastest lap
 * time, for visual comparison.
 *
 * chart.js-based — replaces the earlier CloudScape BarChart implementation
 * for consistency with the /stats dashboard and to avoid the Highcharts
 * licensing constraint of CloudScape's chart suite.
 */
import { ChartOptions, Plugin } from 'chart.js';
import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import { RaceTypeEnum } from '../admin/events/support-functions/raceConfig';
import {
  useChartTheme,
  useLapStatusColors,
} from '../components/charts/chartDefaults';
import { convertMsToString } from '../support-functions/time';

interface RaceGraphProps {
  laps: any[];
  fastestEventLapTime?: number;
  fastestEventAvgLap?: { avgTime: number; [key: string]: any };
  raceFormat?: string;
  fastestRaceAvgLap?: { avgTime: number; [key: string]: any };
}

interface LapPoint {
  lapNumber: number;
  time: number;
  category: 'invalid' | 'valid' | 'fastestOfRace' | 'fastestOfEvent';
}

/**
 * Classify each lap into one of the four colour categories. The avg-lap-time
 * format treats the laps inside the fastest average-window as a single
 * "fastest of race" / "fastest of event" block; laps outside the window are
 * either valid (yellow) or invalid (red).
 */
function classifyLaps(
  laps: any[],
  raceFormat: string | undefined,
  fastestEventLapTime: number | undefined,
  fastestEventAvgLap: { avgTime: number } | undefined,
  fastestRaceAvgLap: { avgTime: number; startLapId: number; endLapId: number } | undefined,
): LapPoint[] {
  const normalised: LapPoint[] = laps.map((lap: any) => ({
    lapNumber: Number(lap.lapId) + 1,
    time: lap.time,
    category: lap.isValid ? 'valid' : 'invalid',
  }));

  if (raceFormat === RaceTypeEnum.BEST_AVERAGE_LAP_TIME_X_LAP) {
    // Average-window format: paint the laps inside the fastest race window
    // as green (or purple if the window beats the event-wide best).
    if (fastestRaceAvgLap) {
      const beatsEventBest =
        fastestEventAvgLap?.avgTime != null &&
        fastestRaceAvgLap.avgTime < fastestEventAvgLap.avgTime;
      const colour: LapPoint['category'] = beatsEventBest ? 'fastestOfEvent' : 'fastestOfRace';
      for (let i = fastestRaceAvgLap.startLapId; i <= fastestRaceAvgLap.endLapId; i += 1) {
        if (normalised[i] && normalised[i].category === 'valid') {
          normalised[i].category = colour;
        }
      }
    }
    return normalised;
  }

  // Fastest-lap format: find the single fastest valid lap and colour it.
  let fastestIdx = -1;
  let fastestTime = Infinity;
  normalised.forEach((p, i) => {
    if (p.category === 'valid' && p.time < fastestTime) {
      fastestTime = p.time;
      fastestIdx = i;
    }
  });
  if (fastestIdx >= 0) {
    const beatsEventBest =
      fastestEventLapTime != null && normalised[fastestIdx].time < fastestEventLapTime;
    normalised[fastestIdx].category = beatsEventBest ? 'fastestOfEvent' : 'fastestOfRace';
  }
  return normalised;
}

const RaceGraph = ({
  laps,
  fastestEventLapTime,
  fastestEventAvgLap,
  raceFormat,
  fastestRaceAvgLap,
}: RaceGraphProps): JSX.Element => {
  const { t } = useTranslation(['translation', 'help-race-stats']);
  const chartTheme = useChartTheme();
  const statusColors = useLapStatusColors();

  // Threshold value — what the dashed horizontal line marks. For avg format
  // it's the event-wide fastest avg-window time, otherwise the event-wide
  // fastest single lap.
  const threshold = useMemo(() => {
    if (raceFormat === RaceTypeEnum.BEST_AVERAGE_LAP_TIME_X_LAP) {
      return fastestEventAvgLap?.avgTime;
    }
    return fastestEventLapTime;
  }, [raceFormat, fastestEventAvgLap, fastestEventLapTime]);

  const thresholdLabel = useMemo(() => {
    return raceFormat === RaceTypeEnum.BEST_AVERAGE_LAP_TIME_X_LAP
      ? t('commentator.race.graph.fastestAvgLap')
      : t('commentator.race.graph.fastestLap');
  }, [raceFormat, t]);

  const classified = useMemo(
    () =>
      classifyLaps(
        laps ?? [],
        raceFormat,
        fastestEventLapTime,
        fastestEventAvgLap,
        fastestRaceAvgLap as any,
      ),
    [laps, raceFormat, fastestEventLapTime, fastestEventAvgLap, fastestRaceAvgLap],
  );

  // Use one chart.js dataset per status category so the legend automatically
  // surfaces each colour. For any given lap only one dataset has a numeric
  // value; the others are null which chart.js renders as a gap of zero
  // height — visually identical to having one bar per lap with per-data-point
  // colours, but with a sensible category legend out of the box.
  const datasets = useMemo(() => {
    const buckets: Record<LapPoint['category'], (number | null)[]> = {
      invalid: classified.map(() => null),
      valid: classified.map(() => null),
      fastestOfRace: classified.map(() => null),
      fastestOfEvent: classified.map(() => null),
    };
    classified.forEach((p, i) => {
      buckets[p.category][i] = p.time;
    });
    const isAvgFormat = raceFormat === RaceTypeEnum.BEST_AVERAGE_LAP_TIME_X_LAP;
    return [
      {
        label: t('commentator.race.graph.invalidLaps'),
        data: buckets.invalid,
        backgroundColor: statusColors.invalid,
      },
      {
        label: t('commentator.race.graph.validLaps'),
        data: buckets.valid,
        backgroundColor: statusColors.valid,
      },
      {
        label: isAvgFormat
          ? t('commentator.race.graph.fastestAvgWindow')
          : t('commentator.race.graph.fastestRaceLap'),
        data: buckets.fastestOfRace,
        backgroundColor: statusColors.fastestOfRace,
      },
      {
        label: isAvgFormat
          ? t('commentator.race.graph.fastestOfEventAvgWindow')
          : t('commentator.race.graph.fastestOfEventRaceLap'),
        data: buckets.fastestOfEvent,
        backgroundColor: statusColors.fastestOfEvent,
      },
    ];
  }, [classified, raceFormat, statusColors, t]);

  const labels = useMemo(() => classified.map((p) => `Lap ${p.lapNumber}`), [classified]);

  // Per-chart-instance plugin that draws the dashed horizontal threshold
  // line. Closes over the live threshold value and theme-reactive colour.
  const thresholdPlugin = useMemo<Plugin<'bar'>>(
    () => ({
      id: 'raceGraphThreshold',
      afterDatasetsDraw(chart) {
        if (threshold == null || threshold <= 0) return;
        const yScale = chart.scales.y;
        if (!yScale) return;
        const y = yScale.getPixelForValue(threshold);
        const { left, right } = chart.chartArea;
        const ctx = chart.ctx;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(right, y);
        ctx.lineWidth = 2;
        ctx.strokeStyle = statusColors.threshold;
        ctx.setLineDash([6, 4]);
        ctx.stroke();
        ctx.restore();
      },
    }),
    [threshold, statusColors.threshold],
  );

  const options = useMemo<ChartOptions<'bar'>>(() => {
    // Y-axis range: pad so the threshold line and the bars are both visible.
    const lapTimes = classified.map((p) => p.time).filter((t) => t > 0);
    const minTime = lapTimes.length > 0 ? Math.min(...lapTimes) : 0;
    const maxTime = lapTimes.length > 0 ? Math.max(...lapTimes) : 15000;
    const bottom = threshold != null && threshold > 0 ? Math.min(minTime, threshold) : minTime;
    const top = threshold != null && threshold > 0 ? Math.max(maxTime, threshold) : maxTime;

    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { color: chartTheme.tickColor, boxWidth: 12 },
        },
        tooltip: {
          backgroundColor: 'rgba(255, 255, 255, 0.96)',
          borderColor: chartTheme.axisColor,
          borderWidth: 1,
          titleColor: chartTheme.tickColor,
          bodyColor: chartTheme.tickColor,
          displayColors: true,
          // Skip the bucket datasets that have null values for this lap so
          // the tooltip only shows the one matching category.
          filter(item) {
            return item.parsed.y != null;
          },
          callbacks: {
            label(item) {
              const ms = item.parsed.y as number;
              return `${item.dataset.label}: ${convertMsToString(ms, true)}`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false, color: chartTheme.gridColor },
          border: { color: chartTheme.axisColor },
          ticks: { color: chartTheme.tickColor, autoSkip: false, maxRotation: 0 },
        },
        y: {
          stacked: true,
          // Pad by 500ms on each side so neither the bars nor the threshold
          // line sits flush against the chart edge.
          min: Math.max(0, bottom - 500),
          max: top + 500,
          title: {
            display: true,
            text: thresholdLabel,
            color: chartTheme.tickColor,
          },
          grid: { color: chartTheme.gridColor },
          border: { color: chartTheme.axisColor },
          ticks: {
            color: chartTheme.tickColor,
            callback(value) {
              return convertMsToString(value as number, false);
            },
          },
        },
      },
    };
  }, [classified, threshold, thresholdLabel, chartTheme]);

  if (!laps || laps.length === 0) {
    return <div style={{ padding: 24, color: chartTheme.tickColor }}>No data available</div>;
  }

  return (
    <div style={{ height: 300 }}>
      <Bar
        data={{ labels, datasets }}
        options={options}
        plugins={[thresholdPlugin]}
      />
    </div>
  );
};

export { RaceGraph };
