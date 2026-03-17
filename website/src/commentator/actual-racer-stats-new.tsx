import React from 'react';

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

interface ValueWithLabelProps {
  label: string;
  children: React.ReactNode;
  color?: string;
}

// color values: text-status-info, text-label
const ValueWithLabel: React.FC<ValueWithLabelProps> = ({ label, children, color = 'text-label' }) => (
  <div>
    <Box variant="h3">{label}</Box>
    <Box color={color as any} variant="h2">
      {children}
    </Box>
  </div>
);

interface AverageLapInformation {
  startLapId?: number;
  endLapId?: number;
}

interface FastestAvgWindowProps {
  averageLapInformation?: AverageLapInformation;
}

const FastestAvgWindow: React.FC<FastestAvgWindowProps> = ({ averageLapInformation }) => {
  var label = '-';

  if (averageLapInformation && Number(averageLapInformation.startLapId) >= 0) {
    label = `${Number(averageLapInformation.startLapId) + 1} - ${
      Number(averageLapInformation.endLapId) + 1
    }`;
  }

  return <>{label}</>;
};

interface NewPositionLabelProps {
  newPosition: number;
  actualPosition: number;
}

const NewPositionLabel: React.FC<NewPositionLabelProps> = ({ newPosition, actualPosition }) => {
  var label: string | number = newPosition <= 0 ? '-' : newPosition;
  if (actualPosition > -1 && newPosition < actualPosition)
    label = `${newPosition} (-${actualPosition - newPosition})`;
  return <>{label}</>;
};

interface ActualRacerStatsNewProps {
  leaderboard: any[];
  overlayInfo: any;
  raceFormat: string;
}

const ActualRacerStatsNew: React.FC<ActualRacerStatsNewProps> = ({ leaderboard, overlayInfo, raceFormat }) => {
  const { t } = useTranslation();
  //const { actualRacer, leaderboard = [] } = props;

  const [timerIsRunning, SetTimerIsRunning] = useState<boolean>(false);
  const [timeLeftInMs, SetTimeLeftInMs] = useState<number>(0);
  const [fastestRaceLap, SetFastestRaceLap] = useState<any>({});
  const [fastestRaceAvg, SetFastestRaceAvg] = useState<any>({});
  const [gapToLeader, SetGapToLeader] = useState<string>('-');
  const [fastestEventLapTime, SetFastestEventLapTime] = useState<number | undefined>();
  const [fastestEventAvgLap, SetFastestEventAvgLap] = useState<any>();
  const [actualPosition, SetActualPosition] = useState<number | undefined>();
  const [newPosition, SetNewPosition] = useState<number | undefined>();
  const [selectedRacer, SetSelectedRacer] = useState<string>('');

  const calculateGapToLeaderValue = () => {
    var leaderTime = 0;
    var fastestRacerTime = null;

    if (raceFormat === RaceTypeEnum.BEST_LAP_TIME && fastestEventLapTime && fastestRaceLap) {
      leaderTime = fastestEventLapTime;
      fastestRacerTime = fastestRaceLap.time;
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

  const manageTimer = (overlayInfo: any) => {
    SetTimeLeftInMs(overlayInfo.timeLeftInMs ? overlayInfo.timeLeftInMs : 0);
    if (overlayInfo.raceStatus === 'RACE_IN_PROGRESS') {
      SetTimerIsRunning(true);
    } else {
      SetTimerIsRunning(false);
    }
  };

  const calculatePositions = (username?: string, fastestRaceLap?: any, fastestRaceAvg?: any) => {
    if (leaderboard?.length > 0 && username) {
      // actual position
      const actualPosition = leaderboard.findIndex((entry) => entry.username === username);

      var newPosition = null;
      if (raceFormat === RaceTypeEnum.BEST_LAP_TIME) {
        newPosition = leaderboard.findIndex((entry) => entry.fastestLapTime > fastestRaceLap?.time);
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

  const updateUI = (overlayInfo: any) => {
    var lapsSortedByTime: any[] = [];

    var fastestRaceLap: any = {};
    if (overlayInfo.laps) {
      lapsSortedByTime = overlayInfo.laps
        .filter((lap: any) => lap.isValid)
        .sort((a: any, b: any) => {
          return a.time > b.time ? 1 : b.time > a.time ? -1 : 0;
        });
      fastestRaceLap = lapsSortedByTime[0];
    }
    SetFastestRaceLap(fastestRaceLap);

    SetFastestRaceAvg(getFacestAvgFromOverlayInfo(overlayInfo));

    calculateGapToLeaderValue();
    calculatePositions(overlayInfo.username, fastestRaceLap, fastestRaceAvg);
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
      calculatePositions(undefined, undefined, undefined);
    }
  }, [leaderboard, raceFormat]);

  useLayoutEffect(() => {
    if (!overlayInfo) return;
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
              {t(`commentator.race.status.${overlayInfo?.raceStatus ?? 'NO_RACER_SELECTED'}`)}
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
                newPosition={newPosition || 0}
                actualPosition={actualPosition || 0}
              ></NewPositionLabel>
            </ValueWithLabel>
          </Grid>

          <Grid gridDefinition={gridDefinition}>
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
          </Grid>
        </SpaceBetween>
      </Container>
    </>
  );
};

export { ActualRacerStatsNew };
