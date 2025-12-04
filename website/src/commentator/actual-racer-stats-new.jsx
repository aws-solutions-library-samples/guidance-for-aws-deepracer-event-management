
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import { RaceTimeAsString } from '../components/raceTimeAsString';

import { Box, Grid, SpaceBetween } from '@cloudscape-design/components';
import { useEffect, useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import RaceTimer from '../components/raceTimer';

import { RaceTypeEnum } from '../admin/events/support-functions/raceConfig';

import { convertMsToString } from '../support-functions/time';
import { getFacestAvgFromOverlayInfo } from './support-functions';

// color values: text-status-info, text-label
const ValueWithLabel = ({ label, children, color = 'text-label' }) => (
  <div>
    <Box variant="h3">{label}</Box>
    <Box color={color} variant="h2">
      {children}
    </Box>
  </div>
);

const FastestAvgWindow = ({ averageLapInformation }) => {
  var label = '-';

  if (Number(averageLapInformation?.startLapId) >= 0) {
    label = `${Number(averageLapInformation.startLapId) + 1} - ${
      Number(averageLapInformation.endLapId) + 1
    }`;
  }

  return <>{label}</>;
};

const NewPositionLabel = ({ newPosition, actualPosition }) => {
  var label = newPosition <= 0 ? '-' : newPosition;
  if (actualPosition > -1 && newPosition < actualPosition)
    label = `${newPosition} (-${actualPosition - newPosition})`;
  return <>{label}</>;
};

const ActualRacerStatsNew = ({ leaderboard, overlayInfo, raceFormat }) => {
  const { t } = useTranslation();
  //const { actualRacer, leaderboard = [] } = props;

  const [timerIsRunning, SetTimerIsRunning] = useState(false);
  const [timeLeftInMs, SetTimeLeftInMs] = useState(0);
  const [fastestRaceLap, SetFastestRaceLap] = useState({});
  const [fastestRaceAvg, SetFastestRaceAvg] = useState({});
  const [gapToLeader, SetGapToLeader] = useState('-');
  const [fastestEventLapTime, SetFastestEventLapTime] = useState();
  const [fastestEventAvgLap, SetFastestEventAvgLap] = useState();
  const [currentTotalTime, SetCurrentTotalTime] = useState(0);
  const [fastestEventTotalTime, SetFastestEventTotalTime] = useState(null);
  const [actualPosition, SetActualPosition] = useState();
  const [newPosition, SetNewPosition] = useState();
  const [selectedRacer, SetSelectedRacer] = useState('');

  const calculateGapToLeaderValue = () => {
    var leaderTime = 0;
    var fastestRacerTime = null;

    if (raceFormat === RaceTypeEnum.BEST_LAP_TIME && fastestEventLapTime && fastestRaceLap) {
      leaderTime = fastestEventLapTime;
      fastestRacerTime = fastestRaceLap.time;
    } else if (raceFormat === RaceTypeEnum.TOTAL_RACE_TIME && fastestEventTotalTime && currentTotalTime) {
      leaderTime = fastestEventTotalTime;
      fastestRacerTime = currentTotalTime;
    } else if (fastestEventAvgLap && fastestRaceAvg) {
      leaderTime = fastestEventAvgLap.avgTime;
      fastestRacerTime = fastestRaceAvg.avgTime;
    }

    var label = '-';
    if (leaderTime && fastestRacerTime) {
      const gapTime = fastestRacerTime - leaderTime;
      if (gapTime > 0) label = convertMsToString(gapTime);
    }

    SetGapToLeader(label);
  };

  const manageTimer = (overlayInfo) => {
    SetTimeLeftInMs(overlayInfo.timeLeftInMs ? overlayInfo.timeLeftInMs : 0);
    if (overlayInfo.raceStatus === 'RACE_IN_PROGRESS') {
      SetTimerIsRunning(true);
    } else {
      SetTimerIsRunning(false);
    }
  };

  const calculatePositions = (username, fastestRaceLap, fastestRaceAvg, currentTotalTime) => {
    if (leaderboard?.length > 0 && username) {
      // actual position
      const actualPosition = leaderboard.findIndex((entry) => entry.username === username);

      var newPosition = null;
      if (raceFormat === RaceTypeEnum.BEST_LAP_TIME) {
        newPosition = leaderboard.findIndex((entry) => entry.fastestLapTime > fastestRaceLap?.time);
      } else if (raceFormat === RaceTypeEnum.TOTAL_RACE_TIME) {
        newPosition = leaderboard.findIndex((entry) => entry.totalLapTime > currentTotalTime);
      } else {
        newPosition = leaderboard.findIndex(
          (entry) =>
            entry.fastestAverageLap?.avgTime > fastestRaceAvg?.avgTime || !entry.fastestAverageLap
        );
      }
      // red lantern
      if (newPosition === -1) newPosition = leaderboard.length;

      // not raced so far
      if (actualPosition === -1) {
        SetActualPosition(-1);
        SetNewPosition(newPosition + 1);
      } else {
        SetNewPosition(Math.min(actualPosition, newPosition) + 1);
        SetActualPosition(actualPosition + 1);
      }
    } else if (username === undefined) {
      SetActualPosition(-1);
      SetNewPosition(-1);
    } else {
      SetActualPosition(-1);
      SetNewPosition(1);
    }
  };

  const updateUI = (overlayInfo) => {
    var lapsSortedByTime = [];

    var fastestRaceLap = {};
    if (overlayInfo.laps) {
      lapsSortedByTime = overlayInfo.laps
        .filter((lap) => lap.isValid)
        .sort((a, b) => {
          return a.time > b.time ? 1 : b.time > a.time ? -1 : 0;
        });
      fastestRaceLap = lapsSortedByTime[0];
    }
    SetFastestRaceLap(fastestRaceLap);

    SetFastestRaceAvg(getFacestAvgFromOverlayInfo(overlayInfo));

    // Calculate current total time for TOTAL_RACE_TIME
    if (raceFormat === RaceTypeEnum.TOTAL_RACE_TIME && overlayInfo.laps) {
      const validLaps = overlayInfo.laps.filter(lap => lap.isValid);
      const currentTotal = validLaps.reduce((sum, lap) => sum + lap.time, 0);
      SetCurrentTotalTime(currentTotal);
    }

    calculateGapToLeaderValue();
    calculatePositions(overlayInfo.username, fastestRaceLap, fastestRaceAvg, currentTotalTime);
    SetSelectedRacer(overlayInfo.username);
  };

  useEffect(() => {
    if (leaderboard && leaderboard.length > 0) {
      const fastest = leaderboard.reduce(
        (acc, curr) => {
          if (acc.fastestLapTime === null) {
            acc.fastestLapTime = curr.fastestLapTime;
          } else if (acc.fastestLapTime > curr.fastestLapTime) {
            acc.fastestLapTime = curr.fastestLapTime;
          }

          if (acc.fastestAverageLap === null) {
            acc.fastestAverageLap = curr.fastestAverageLap;
          } else if (acc.fastestAverageLap > curr.fastestAverageLap) {
            acc.fastestAverageLap = curr.fastestAverageLap;
          }
          return acc;
        },
        { fastestLapTime: null, fastestAverageLap: null }
      );

      SetFastestEventLapTime(fastest.fastestLapTime);
      SetFastestEventAvgLap(fastest.fastestAverageLap);
      
      // Calculate fastest total time for TOTAL_RACE_TIME
      if (raceFormat === RaceTypeEnum.TOTAL_RACE_TIME) {
        const validEntries = leaderboard.filter(entry => entry.numberOfValidLaps > 0);
        if (validEntries.length > 0) {
          SetFastestEventTotalTime(Math.min(...validEntries.map(e => e.totalLapTime)));
        }
      }
      
      calculatePositions();
    }
  }, [leaderboard, raceFormat]);

  useLayoutEffect(() => {
    manageTimer(overlayInfo);
    const raceStatus = overlayInfo.raceStatus;
    switch (raceStatus) {
      case 'READY_TO_START':
      case 'RACE_IN_PROGRESS':
      case 'RACE_PAUSED':
      default:
        updateUI(overlayInfo);
        break;
      case 'NO_RACER_SELECTED':
        //reset UI
        break;
      case 'RACE_FINSIHED':
    }
  }, [overlayInfo]);

  const gridDefinition = [{ colspan: 3 }, { colspan: 3 }, { colspan: 3 }, { colspan: 3 }];

  return (
    <>
      <Container
        header={
          <Header variant="h2" description={t('commentator.race.actual-racer-stats')}>
            {t('commentator.race.actual-racer-stats-header')}{' '}
            <Box color="text-status-info" display="inline" variant="h2">
              {selectedRacer}
            </Box>
          </Header>
        }
      >
        <SpaceBetween size="l">
          <Grid gridDefinition={gridDefinition}>
            <ValueWithLabel label={t('commentator.race.status')} color="text-status-info">
              {t(`commentator.race.status.${overlayInfo.raceStatus}`)}
            </ValueWithLabel>
          </Grid>
          <Grid gridDefinition={gridDefinition}>
            <ValueWithLabel label={t('commentator.race.timeLeft')} color="text-status-info">
              <RaceTimer timerIsRunning={timerIsRunning} timeLeftInMs={timeLeftInMs} />
            </ValueWithLabel>
            <ValueWithLabel label={t('commentator.race.gapToFastest')} color="text-status-info">
              {gapToLeader}
            </ValueWithLabel>
            <ValueWithLabel label={t('commentator.race.actualPosition')} color="text-status-info">
              {actualPosition === -1 ? '-' : actualPosition}
            </ValueWithLabel>
            <ValueWithLabel label={t('commentator.race.newPosition')} color="text-status-info">
              <NewPositionLabel
                newPosition={newPosition}
                actualPosition={actualPosition}
              ></NewPositionLabel>
            </ValueWithLabel>
          </Grid>

          <Grid gridDefinition={gridDefinition}>
            {raceFormat === RaceTypeEnum.TOTAL_RACE_TIME ? (
              <ValueWithLabel label={t('commentator.race.totalTime')} color="text-status-info">
                <RaceTimeAsString timeInMS={currentTotalTime}></RaceTimeAsString>
              </ValueWithLabel>
            ) : (
              <>
                <ValueWithLabel label={t('commentator.race.fastest')} color="text-status-info">
                  <RaceTimeAsString timeInMS={fastestRaceLap?.time}></RaceTimeAsString>
                </ValueWithLabel>
                <ValueWithLabel label={t('commentator.race.fastestLapId')} color="text-status-info">
                  {fastestRaceLap?.lapId ? Number(fastestRaceLap.lapId) + 1 : '-'}
                </ValueWithLabel>
                <ValueWithLabel label={t('commentator.race.fastestAvg')} color="text-status-info">
                  <RaceTimeAsString timeInMS={fastestRaceAvg?.avgTime}></RaceTimeAsString>
                </ValueWithLabel>
                <ValueWithLabel label={t('commentator.race.fastestAvgWindow')} color="text-status-info">
                  <FastestAvgWindow averageLapInformation={fastestRaceAvg}></FastestAvgWindow>
                </ValueWithLabel>
              </>
            )}
          </Grid>
        </SpaceBetween>
      </Container>
    </>
  );
};

export { ActualRacerStatsNew };
