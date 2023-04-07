import ColumnLayout from '@cloudscape-design/components/column-layout';
import { API, graphqlOperation } from 'aws-amplify';
import React, { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import { getRaces } from '../graphql/queries';
import { onNewOverlayInfo } from '../graphql/subscriptions';
import { useSelectedEventContext } from '../store/storeProvider';

import { SpaceBetween } from '@cloudscape-design/components';
import { RaceTimeAsString } from '../components/raceTimeAsString';
import RaceTimer from '../components/raceTimer';

import { Box } from '@cloudscape-design/components';

const ActualRacerStats = () => {
  const { t } = useTranslation();

  const selectedEvent = useSelectedEventContext();
  const [actualRacer, SetActualRacer] = useState({});

  const [fastesRacerTime, SetFastesRacerTime] = useState({});
  const [slowestRacerTime, SetSlowestRacerTime] = useState({});
  const [lapsCount, SetLapsCount] = useState('-');
  const [invalidCount, SetInvalidCount] = useState('-');
  const [actualLapTime, SetActualLapTime] = useState(0);

  const [restsSum, SetRestsSum] = useState('-');
  const [avaerageResetsPerLap, SetAverageResetsPerLap] = useState('-');
  const [racesCount, SetRacesCount] = useState(0);

  const [subscription, SetSubscription] = useState();
  const [timerIsRunning, SetTimerIsRunning] = useState(false);
  const [timeLeftInMs, SetTimeLeftInMs] = useState(0);

  const ManageTimer = (raceStatus) => {
    if (raceStatus === 'RACE_IN_PROGRESS') {
      SetTimerIsRunning(true);
    } else {
      SetTimerIsRunning(false);
    }
  };

  const clearRacerStats = () => {
    SetFastesRacerTime({});
    SetSlowestRacerTime({});
    SetLapsCount('-');
    SetInvalidCount('-');
    SetRestsSum('-');
    SetAverageResetsPerLap('-');
    SetRacesCount('-');
  };

  useEffect(() => {
    if (selectedEvent) {
      if (subscription) {
        subscription.unsubscribe();
      }
      const eventId = selectedEvent.eventId;

      SetSubscription(
        API.graphql(graphqlOperation(onNewOverlayInfo, { eventId: eventId })).subscribe({
          next: (event) => {
            const eventData = event.value.data.onNewOverlayInfo;
            if (eventData.userId !== actualRacer.userId) {
              SetActualRacer(eventData);
            }

            if (eventData.raceStatus === 'NO_RACER_SELECTED') {
              clearRacerStats();
            }

            SetTimeLeftInMs(eventData.timeLeftInMs);
            SetActualLapTime(eventData.currentLapTimeInMs);
            ManageTimer(eventData.raceStatus);
          },
          error: (error) => console.warn(error),
        })
      );

      return () => {
        if (subscription) {
          subscription.unsubscribe();
        }
      };
    }
  }, [selectedEvent, actualRacer]);

  const caclulateLapsInformation = (laps) => {
    const lapCount = laps.length;
    const lapsSorted = laps.filter((lap) => lap.isValid === true).sort((a, b) => a.time > b.time);

    SetFastesRacerTime(lapsSorted[0] || {});
    SetSlowestRacerTime(lapsSorted.pop() || {});
    SetLapsCount(lapCount);
    SetInvalidCount(lapCount - lapsSorted.length);
  };

  const calculateOfftrackInformation = (laps) => {
    if (laps.length > 0) {
      const lapCount = laps.length;

      const validLaps = laps.filter((lap) => lap.isValid === true);
      const resets = validLaps.reduce((count, lap) => count + lap.resets, 0);
      const avaerageResetsPerLap =
        resets > 0 && validLaps.length > 0 ? resets / validLaps.length : 0;

      SetRestsSum(resets);
      SetAverageResetsPerLap(avaerageResetsPerLap.toFixed(1));
      console.log('Resets: ' + resets);
      console.log('Average Resets: ' + avaerageResetsPerLap);
    }
  };

  useEffect(() => {
    const eventId = selectedEvent.eventId;
    const userId = actualRacer.userId;

    if (eventId && userId) {
      console.info('Load data for ' + actualRacer.username);

      const loadUserLaps = async () => {
        const response = await API.graphql(
          graphqlOperation(getRaces, { eventId: eventId, userId: userId })
        );
        const laps = response.data.getRaces.flatMap((race) => race.laps);

        console.info(laps);
        SetRacesCount(response.data?.getRaces.length);
        caclulateLapsInformation(laps);
        calculateOfftrackInformation(laps);
      };

      loadUserLaps();
    }
  }, [actualRacer, selectedEvent]);

  const ValueWithLabel = ({ label, children, highlight = false }) => (
    <div>
      <Box variant="h3">{label}</Box>
      <Box color={highlight ? 'text-status-info' : 'text-label'} variant="h2">
        {children}
      </Box>
    </div>
  );

  const AverageLapsPerRace = () => {
    let value = '-';

    if (lapsCount !== '-' && racesCount !== '-' && racesCount > 0) {
      value = (lapsCount / racesCount).toFixed(1);
    } else if (racesCount == 0) {
      value = 0;
    }

    return <ValueWithLabel label={t('commentator.race.averagelapCount')}>{value}</ValueWithLabel>;
  };

  return (
    <>
      <SpaceBetween size="l">
        <Container
          header={
            <Header variant="h2" description={t('commentator.race.actualRacerStats')}>
              Current Racer:{' '}
              <Box color="text-status-info" display="inline" variant="h2">
                {actualRacer.username}
              </Box>
            </Header>
          }
        >
          <ColumnLayout columns={2}>
            <ValueWithLabel label={t('commentator.race.currentLapTime')} highlight={true}>
              <RaceTimeAsString timeInMS={actualLapTime} showMills={false}></RaceTimeAsString>
            </ValueWithLabel>
            <ValueWithLabel label={t('commentator.race.timeLeft')} highlight={true}>
              <RaceTimer timerIsRunning={timerIsRunning} timeLeftInMs={timeLeftInMs} />
            </ValueWithLabel>
          </ColumnLayout>
        </Container>

        <Container
          header={
            <Header variant="h2" description={t('commentator.race.historicalRacerStats')}>
              <Trans i18nKey="commentator.race.historicalRacerStats.header" count={racesCount}>
                Data from previous
                <Box color="text-status-info" display="inline" variant="h2">
                  {{ count: racesCount }}
                </Box>
                run
              </Trans>
            </Header>
          }
        >
          <ColumnLayout columns={2} borders="horizontal">
            <ValueWithLabel label={t('commentator.race.racerFastestLap')}>
              <RaceTimeAsString timeInMS={fastesRacerTime.time}></RaceTimeAsString>
            </ValueWithLabel>
            <ValueWithLabel label={t('commentator.race.racerSlowestLap')}>
              <RaceTimeAsString timeInMS={slowestRacerTime.time}></RaceTimeAsString>
            </ValueWithLabel>
            <ColumnLayout columns={2}>
              <ValueWithLabel label={t('commentator.race.lapCount')}>{lapsCount}</ValueWithLabel>
              <AverageLapsPerRace></AverageLapsPerRace>
            </ColumnLayout>

            <ValueWithLabel label={t('commentator.race.invalidLapCount')}>
              {invalidCount}
            </ValueWithLabel>

            <ColumnLayout columns={2}>
              <ValueWithLabel label={t('commentator.race.restSum')}>{restsSum}</ValueWithLabel>
              <ValueWithLabel label={t('commentator.race.averageResetsPerLap')}>
                {avaerageResetsPerLap}
              </ValueWithLabel>
            </ColumnLayout>
          </ColumnLayout>
        </Container>
      </SpaceBetween>
    </>
  );
};

export { ActualRacerStats };
