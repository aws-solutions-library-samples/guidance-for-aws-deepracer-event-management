import ColumnLayout from '@cloudscape-design/components/column-layout';
import { API, graphqlOperation } from 'aws-amplify';
import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import { getRaces } from '../graphql/queries';
import { onNewOverlayInfo } from '../graphql/subscriptions';
import { eventContext } from '../store/eventProvider';

import { RaceTimeAsString } from '../components/raceTimeAsString';
import RaceTimer from '../components/raceTimer';

import { Box } from '@cloudscape-design/components';

const ActualRacerStats = () => {
    const { t } = useTranslation();

    const { selectedEvent } = useContext(eventContext);
    const [actualRacer, SetActualRacer] = useState({});

    const [fastesRacerTime, SetFastesRacerTime] = useState({});
    const [slowestRacerTime, SetSlowestRacerTime] = useState({});
    const [lapsCount, SetLapsCount] = useState(0);
    const [invalidCount, SetInvalidCount] = useState(0);

    const [restsSum, SetRestsSum] = useState(0);
    const [avaerageResetsPerLap, SetAvaerageResetsPerLap] = useState(0);

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
                  SetTimeLeftInMs(eventData.timeLeftInMs);
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
      const lapsSorted = laps
        .filter((lap) => lap.isValid === true)
        .sort((a, b) => a.time > b.time);

      SetFastesRacerTime(lapsSorted[0] || {});
      SetSlowestRacerTime(lapsSorted.pop() || {});
      SetLapsCount(lapCount);
      SetInvalidCount(lapCount - lapsSorted.length);
    }

    const calculateOfftrackInformation = (laps) => {
      if(laps.length > 0) {
        const lapCount = laps.length;

        const validLaps = laps.filter((lap) => lap.isValid === true);
        const resets = validLaps.reduce((count, lap) => count + lap.resets, 0);
        const avaerageResetsPerLap = resets > 0 && validLaps.length > 0 ? resets / validLaps.length : 0;

        console.log("Resets: " + resets);
        console.log("Average Resets: " + avaerageResetsPerLap);
      }
    }

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
            caclulateLapsInformation(laps);
            calculateOfftrackInformation(laps);
          };
    
          loadUserLaps();
        }
    }, [actualRacer, selectedEvent]);

    const ValueWithLabel = ({ label, children }) => (
        <div>
          <Box variant="h3">{label}</Box>
          <Box variant="h2">{children}</Box>
        </div>
    );

    return (
        <Container
            header={
              <Header variant="h2" description={t('commentator.race.actualRacerStats')}>
                Actual Racer: <Box color="text-status-info" display="inline" variant='h2'>{actualRacer.username}</Box>
              </Header>
            }
          >
            <ColumnLayout columns={2} borders="vertical">
              <ColumnLayout columns={2}>
                
                
                <ValueWithLabel label={t('commentator.race.racerFastestLap')}>
                  <RaceTimeAsString timeInMS={fastesRacerTime.time}></RaceTimeAsString>
                </ValueWithLabel>
                <ValueWithLabel label={t('commentator.race.racerSlowestLap')}>
                  <RaceTimeAsString timeInMS={slowestRacerTime.time}></RaceTimeAsString>
                </ValueWithLabel>
                <ValueWithLabel label={t('commentator.race.lapCount')}>{lapsCount}</ValueWithLabel>
                <ValueWithLabel label={t('commentator.race.invalidLapCount')}>
                  {invalidCount}
                </ValueWithLabel>
              </ColumnLayout>


              <ColumnLayout columns={2}>
                <ValueWithLabel label={t('commentator.race.currentLapTime')}>
                  <RaceTimeAsString
                    timeInMS={actualRacer.currentLapTimeInMs}
                    showMills={false}
                  ></RaceTimeAsString>
                </ValueWithLabel>
                <ValueWithLabel label={t('commentator.race.timeLeft')}>
                  <RaceTimer timerIsRunning={timerIsRunning} timeLeftInMs={timeLeftInMs} />
                </ValueWithLabel>
              </ColumnLayout>
            </ColumnLayout>

            
          </Container>
    )
}

export { ActualRacerStats };

