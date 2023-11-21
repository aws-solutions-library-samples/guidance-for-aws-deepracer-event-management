import BarChart from '@cloudscape-design/components/bar-chart';
import Box from '@cloudscape-design/components/box';
import {
  colorChartsPaletteCategorical25,
  colorChartsStatusCritical,
  colorChartsStatusNeutral,
  colorChartsStatusPositive,
} from '@cloudscape-design/design-tokens';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RaceTypeEnum } from '../admin/events/support-functions/raceConfig';
import { convertMsToString } from '../support-functions/time';

const RaceGraph = ({
  laps,
  fastestEventLapTime,
  fastestEventAvgLap,
  raceFormat,
  fastestRaceAvgLap,
}) => {
  const { t } = useTranslation(['translation', 'help-race-stats']);

  const [yDomain, setYDomain] = useState([0, 15000]);
  const [xDomain, SetXDomain] = useState([]);
  const [redLaps, setRedLaps] = useState([]);
  const [greenLaps, setGreenLaps] = useState([]);
  const [neutralLaps, setNeutralLaps] = useState([]);
  const [threshold, setThreshold] = useState(0);
  const [thresholdLabel, setThresholdLabel] = useState(t('commentator.race.graph.fastestLap'));
  const [fastestLabel, setFastestLabel] = useState(t('commentator.race.graph.fastestRaceLap'));

  const prepareGraphForAvgFormat = (slowestTime, fastestTime, allLaps) => {
    setFastestLabel(t('commentator.race.graph.fastestAvgWindow'));
    setThresholdLabel(t('commentator.race.graph.fastestAvgLap'));
    if (fastestEventAvgLap?.avgTime) {
      const fastestAvg = fastestEventAvgLap?.avgTime;
      setThreshold(fastestEventAvgLap.avgTime);

      setYDomain([
        Math.min(slowestTime, fastestAvg) - 500,
        Math.max(fastestTime, fastestAvg) + 500,
      ]);

      const lapsCopy = [...allLaps];
      var avgWindowLaps = [];

      if (fastestRaceAvgLap) {
        const count = fastestRaceAvgLap.endLapId - fastestRaceAvgLap.startLapId + 1;
        avgWindowLaps = lapsCopy.splice(fastestRaceAvgLap.startLapId, count);
      }

      setNeutralLaps(avgWindowLaps);
      setGreenLaps(lapsCopy.filter((lap) => lap.isValid));
      setRedLaps(lapsCopy.filter((lap) => !lap.isValid));
    } else {
      setGreenLaps(allLaps);
    }
  };

  const prepareGraph = (fastestTime, slowestTime, allLaps) => {
    setFastestLabel(t('commentator.race.graph.fastestRaceLap'));
    if (fastestEventLapTime) {
      setYDomain([
        Math.min(fastestTime, fastestEventLapTime) - 500,
        Math.max(slowestTime, fastestEventLapTime) + 500,
      ]);
      setThreshold(fastestEventLapTime);
    } else {
      setYDomain([fastestTime - 500, slowestTime + 500]);
    }

    allLaps.sort((a, b) => a.time - b.time);

    console.log(allLaps);
    const fastest = allLaps.findIndex((lap) => lap.isValid);
    console.log(fastest);

    setGreenLaps(allLaps.filter((lap, index) => lap.isValid && index !== fastest));
    setRedLaps(allLaps.filter((lap) => !lap.isValid));
    setNeutralLaps(allLaps.filter((lap, index) => lap.isValid && index === fastest));
  };

  useEffect(() => {
    if (laps && laps.length) {
      var fastestTime = laps[0].time;
      var slowestTime = laps[0].time;

      const allLaps = laps.map((lap) => {
        if (lap.time < fastestTime) {
          fastestTime = lap.time;
        }
        if (lap.time > slowestTime) slowestTime = lap.time;
        return {
          x: Number(lap.lapId) + 1,
          y: lap.time,
          time: lap.time,
          isValid: lap.isValid,
        };
      });

      const xDomain = allLaps.map((lap) => lap.x);

      SetXDomain(xDomain);

      if (raceFormat === RaceTypeEnum.BEST_AVERAGE_LAP_TIME_X_LAP) {
        prepareGraphForAvgFormat(fastestTime, slowestTime, allLaps);
      } else {
        prepareGraph(fastestTime, slowestTime, allLaps);
      }
    } else {
      setYDomain([0, 15000]);
      SetXDomain([]);

      setRedLaps([]);
      setGreenLaps([]);
      setNeutralLaps([]);
    }
  }, [laps, fastestEventLapTime, fastestRaceAvgLap, raceFormat]);

  return (
    <>
      <BarChart
        series={[
          {
            type: 'bar',
            color: colorChartsStatusCritical,
            title: t('commentator.race.graph.invalidLaps'),
            data: redLaps,
            valueFormatter: (e) => convertMsToString(e, true),
          },
          {
            type: 'bar',
            color: colorChartsStatusPositive,
            title: t('commentator.race.graph.validLaps'),
            data: greenLaps,
            valueFormatter: (e) => convertMsToString(e, true),
          },
          {
            type: 'bar',
            color: colorChartsStatusNeutral,
            title: fastestLabel,
            data: neutralLaps,
            valueFormatter: (e) => convertMsToString(e, true),
          },
          {
            title: thresholdLabel,
            type: 'threshold',
            color: colorChartsPaletteCategorical25,
            y: Number(threshold),
            valueFormatter: (e) => convertMsToString(e, true),
          },
        ]}
        yDomain={yDomain}
        xDomain={xDomain}
        i18nStrings={{
          yTickFormatter: function numberFormatter(e) {
            return convertMsToString(e, false);
          },
          xTickFormatter: function numberFormatter(e) {
            return 'Lap ' + e;
          },
        }}
        ariaLabel="Single data series line chart"
        height={300}
        yTitle="Time"
        stackedBars
        hideFilter
        empty={
          <Box textAlign="center" color="inherit">
            {' '}
            <b>No data available</b>{' '}
            <Box variant="p" color="inherit">
              {' '}
              There is no data available{' '}
            </Box>{' '}
          </Box>
        }
      />
    </>
  );
};

export { RaceGraph };
