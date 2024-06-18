import BarChart from '@cloudscape-design/components/bar-chart';
import Box from '@cloudscape-design/components/box';
import {
  colorChartsGreen400,
  colorChartsPaletteCategorical25,
  colorChartsPurple600,
  colorChartsStatusCritical,
  colorChartsYellow300
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
  const [yellowLaps, setYellowLaps] = useState([]);
  const [greenLaps, setGreenLaps] = useState([]);
  const [purpleLaps, setPurpleLaps] = useState([]);
  const [threshold, setThreshold] = useState(0);
  const [thresholdLabel, setThresholdLabel] = useState(t('commentator.race.graph.fastestLap'));
  const [fastestLabel, setFastestLabel] = useState(t('commentator.race.graph.fastestRaceLap'));
  const [fastestOfEventLabel, setFastestOfEventLabel] = useState(t('commentator.race.graph.fastestOfEventRaceLap'));

  const prepareGraphForAvgFormat = (slowestTime, fastestTime, allLaps) => {
    setFastestLabel(t('commentator.race.graph.fastestAvgWindow'));
    setFastestOfEventLabel(t('commentator.race.graph.fastestOfEventAvgWindow'));
    setThresholdLabel(t('commentator.race.graph.fastestAvgLap'));
    if (fastestEventAvgLap?.avgTime) {
      const fastestAvg = fastestEventAvgLap?.avgTime;
      setThreshold(fastestEventAvgLap.avgTime);

      setYDomain([
        Math.min(slowestTime, fastestAvg) - 500,
        Math.max(fastestTime, fastestAvg) + 500,
      ]);
    }

    const lapsCopy = [...allLaps];
    if (fastestRaceAvgLap?.avgTime) {
      var avgWindowLaps = [];

      if (fastestRaceAvgLap) {
        const count = fastestRaceAvgLap.endLapId - fastestRaceAvgLap.startLapId + 1;
        avgWindowLaps = lapsCopy.splice(fastestRaceAvgLap.startLapId, count);
      }

      console.log("fastestEventAvgLap:", fastestEventAvgLap?.avgTime);
      console.log("fastestRaceAvgLap:", fastestRaceAvgLap?.avgTime);

      //  Decide if the fastest avgLap is Green (Fastest of Race) or Purple (Fastest of Event)
      if (fastestRaceAvgLap?.avgTime < fastestEventAvgLap?.avgTime) {
        setGreenLaps([]);
        setPurpleLaps(avgWindowLaps);
      } else {
        setGreenLaps(avgWindowLaps);
        setPurpleLaps([]);
      }
      
      setYellowLaps(lapsCopy.filter((lap) => lap.isValid));
      setRedLaps(lapsCopy.filter((lap) => !lap.isValid));
    } else {
      setYellowLaps(lapsCopy.filter((lap) => lap.isValid));
      setRedLaps(lapsCopy.filter((lap) => !lap.isValid));
      setGreenLaps([]);
      setPurpleLaps([]);
    }
  };

  const prepareGraph = (fastestTime, slowestTime, allLaps) => {
    setFastestLabel(t('commentator.race.graph.fastestRaceLap'));
    setFastestOfEventLabel(t('commentator.race.graph.fastestOfEventRaceLap'));
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
    console.log("fastest:", allLaps[fastest].time);
    console.log("fastestEventLapTime:", fastestEventLapTime);

    setYellowLaps(allLaps.filter((lap, index) => lap.isValid && index !== fastest));
    setRedLaps(allLaps.filter((lap) => !lap.isValid));

    //  Decide if the fastest lap is Green (Fastest of Race) or Purple (Fastest of Event)
    if (allLaps[fastest].time < fastestEventLapTime) {
      console.log("purple:", allLaps[fastest].time);
      setPurpleLaps(allLaps.filter((lap, index) => lap.isValid && index === fastest));
      setGreenLaps([]);
    }
    else {
      console.log("Green:", allLaps[fastest].time);
      setPurpleLaps([]);
      setGreenLaps(allLaps.filter((lap, index) => lap.isValid && index === fastest));
    }    
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
      setYellowLaps([]);
      setPurpleLaps([]);
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
            color: colorChartsYellow300,
            title: t('commentator.race.graph.validLaps'),
            data: yellowLaps,
            valueFormatter: (e) => convertMsToString(e, true),
          },
          {
            type: 'bar',
            color: colorChartsGreen400,
            title: fastestLabel,
            data: greenLaps,
            valueFormatter: (e) => convertMsToString(e, true),
          },
          {
            type: 'bar',
            color: colorChartsPurple600,
            title: fastestOfEventLabel,
            data: purpleLaps,
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
