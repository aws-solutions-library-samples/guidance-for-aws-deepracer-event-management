import {
  Box,
  Button,
  ColumnLayout,
  Container,
  Grid,
  Header,
  Modal,
  SpaceBetween
} from '@cloudscape-design/components';
import React, { useEffect, useRef, useState } from 'react';

import { useMachine } from '@xstate/react';
import { useTranslation } from 'react-i18next';
import { PageLayout } from '../../components/pageLayout';
import useCounter from '../../hooks/useCounter';
import useMutation from '../../hooks/useMutation';
import useWebsocket from '../../hooks/useWebsocket';
import { GetRaceResetsNameFromId, GetRaceTypeNameFromId } from '../events/raceConfig';
import { LapTable } from './lapTable';
import LapTimer from './lapTimer';
import { defaultLap, defaultRace } from './raceDomain';
import RaceTimer from './raceTimer';
import { stateMachine } from './stateMachine';
import { breadcrumbs } from './supportFunctions';
import styles from './timekeeper.module.css';

export const RacePage = ({ raceInfo, raceConfig, onNext }) => {
  const { t } = useTranslation();
  const [warningModalVisible, setWarningModalVisible] = useState(false);
  const [timersAreRunning, SetTimersAreRunning] = useState(false);
  const [race, setRace] = useState({ ...defaultRace, ...raceInfo });
  console.info(race);
  const [currentLap, SetCurrentLap] = useState(defaultLap);
  const [fastestLap, SetFastestLap] = useState([]);

  const raceType = GetRaceTypeNameFromId(raceConfig.rankingMethod);
  const allowedNrResets = GetRaceResetsNameFromId(raceConfig.numberOfResetsPerLap);

  const [
    carResetCounter,
    incrementCarResetCounter,
    decrementCarResetCounter,
    resetCarResetCounter,
  ] = useCounter(0);

  const lapTimerRef = useRef();
  const raceTimerRef = useRef();
  const [overlayPublishTimerId, setoverlayPublishTimerId] = useState();
  const [SendMutation] = useMutation();

  const [, send] = useMachine(stateMachine, {
    actions: {
      resetRace: () => {
        //console.log('Reseting race state');
        //        setRace((prevState) => {
        //          return { ...prevState, userId: null, currentModelId: null, currentCarId: null };
        //        });
        resetTimers();
        //        setRace({ ...defaultRace, eventId: race.eventId ?? null });
        SetCurrentLap(defaultLap);

        // Restart racer selection
        //SetEndSessionModalIsVisible(false);
        //SetRacerSelectorModalIsVisible(true);
      },
      readyToStart: (context, event) => {
        //console.log('readyToStart race for user ' + event.userId);

        resetTimers();
        //SetEndSessionModalIsVisible(false);
        //SetRacerSelectorModalIsVisible(false);
      },
      endRace: () => {
        console.log('Ending race state');
        // So the timers are paused before displaying the modal, else the race timer keeps counting down...
        // setTimeout(() => {
        //   // SetEndSessionModalIsVisible(true);
        //   // SetRacerSelectorModalIsVisible(false);
        // }, 100);
        console.info('END RACE°!!!!!!!!');
        setWarningModalVisible(true);
        //onNext(race);
      },
      startTimer: () => {
        // console.log('Start Timer state');
        startTimers();
      },
      pauseTimer: () => {
        // console.log('Pause Timer state');
        pauseTimers();
      },
      captureLap: (context, event) => {
        // console.log('Capturing new lap');
        event.isValid = 'isValid' in event ? event.isValid : false;

        const isLapValid = event.isValid && carResetCounter <= raceConfig.numberOfResetsPerLap;

        const lapId = race.laps.length;
        const currentLapStats = {
          ...currentLap,
          resets: carResetCounter,
          lapId: lapId,
          modelId: race.currentModelId,
          carId: race.currentCarId,
          time: lapTimerRef.current.getCurrentTimeInMs(),
          isValid: isLapValid,
          autTimerConnected: autTimerIsConnected,
        };

        setRace((prevState) => {
          const laps = [...prevState.laps, currentLapStats];
          return { ...prevState, laps: laps };
        });

        // reset lap
        SetCurrentLap(defaultLap);
        resetCarResetCounter();
        lapTimerRef.current.reset();
      },
      startPublishOverlayInfo: () => {
        if (!overlayPublishTimerId) {
          console.info('starting to publishing timer');
          console.info(race);
          setoverlayPublishTimerId(
            setInterval(() => {
              const overlayInfo = {
                eventId: race.eventId,
                username: race.username,
                timeLeftInMs: raceTimerRef.current.getCurrentTimeInMs(),
                currentLapTimeInMs: lapTimerRef.current.getCurrentTimeInMs(),
                isActive: true,
              };
              SendMutation('updateOverlayInfo', overlayInfo);
            }, 400)
          );
        }
      },
      pausePublishOverlayInfo: () => {
        console.log('Pause Publishing overlay info, id: ' + overlayPublishTimerId);
        const overlayInfo = {
          eventId: race.eventId,
          username: race.username,
          timeLeftInMs: raceTimerRef.current.getCurrentTimeInMs(),
          currentLapTimeInMs: lapTimerRef.current.getCurrentTimeInMs(),
          isActive: true,
        };
        SendMutation('updateOverlayInfo', overlayInfo);
        clearInterval(overlayPublishTimerId);
        setoverlayPublishTimerId();
      },
      stopPublishOverlayInfo: () => {
        console.log('Stop Publishing overlay info, id: ' + overlayPublishTimerId);
        const overlayInfo = {
          eventId: race.eventId,
          username: race.username,
          timeLeftInMs: 0,
          currentLapTimeInMs: 0,
          isActive: false,
        };
        SendMutation('updateOverlayInfo', overlayInfo);
        clearInterval(overlayPublishTimerId);
        setoverlayPublishTimerId();
      },
    },
  });

  const onMessageFromAutTimer = (message) => {
    console.info('Automated timer sent message: ' + message);
    send('CAPTURE_AUT_LAP', { isValid: true });
  };

  //TODO fix so that useWebsocket is invoked only on local networks
  const wsUrl = window.location.href.split('/', 3)[2] ?? 'localhost:8080';
  const [autTimerIsConnected] = useWebsocket(`ws://${wsUrl}`, onMessageFromAutTimer);

  // //Clean up overlay pusblishin on reload
  // useEffect(() => {
  //     return () => {
  //         overlayPublishTimerId(overlayPublishTimerId)
  //     }
  // }, []);

  // Find the fastest lap
  useEffect(() => {
    if (race.laps.length) {
      // Get all valid laps
      const validLaps = race.laps.filter((o) => {
        return o.isValid === true;
      });
      if (validLaps.length) {
        // Find fastest time
        var res = Math.min.apply(
          Math,
          validLaps.map((o) => {
            return o.time;
          })
        );
        // Get object with the fastets time
        const obj = validLaps.find((o) => {
          return o.time === res;
        });
        SetFastestLap([obj]);
      } else {
        SetFastestLap([]);
      }
    } else {
      SetFastestLap([]);
    }
  }, [race.laps]);

  // handlers functions
  const actionHandler = (id) => {
    console.log('alter lap status for lap id: ' + id);
    const lapsCopy = [...race.laps];
    const updatedLap = { ...race.laps[id] };
    updatedLap.isValid = !updatedLap.isValid;
    lapsCopy[id] = updatedLap;
    setRace((prevState) => {
      return { ...prevState, laps: lapsCopy };
    });
  };

  const undoFalseFinishHandler = () => {
    setRace((prevState) => {
      const updatedLaps = [...prevState.laps];
      if (updatedLaps.length !== 0) {
        const lastLap = updatedLaps.pop();
        lapTimerRef.current.reset(lapTimerRef.current.getCurrentTimeInMs() + lastLap.time);
        resetCarResetCounter(lastLap.resets);
      }
      return { ...prevState, laps: updatedLaps };
    });
  };

  // support functions
  const startTimers = () => {
    lapTimerRef.current.start();
    raceTimerRef.current.start();
    SetTimersAreRunning(true);
  };

  const pauseTimers = () => {
    lapTimerRef.current.pause();
    raceTimerRef.current.pause();
    SetTimersAreRunning(false);
  };

  const resetTimers = () => {
    pauseTimers();
    if (raceConfig.raceTimeInMin) {
      raceTimerRef.current.reset(raceConfig.raceTimeInMin * 60 * 1000);
    } else {
      raceTimerRef.current.reset(0 * 60 * 1000);
    }
    lapTimerRef.current.reset();
  };

  const warningModal = (
    <Modal
      onDismiss={() => setWarningModalVisible(false)}
      visible={warningModalVisible}
      closeAriaLabel="End the race?"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button
              variant="link"
              onClick={() => {
                setWarningModalVisible(false);
                send('RESUME');
              }}
            >
              {t('button.cancel')}
            </Button>
            <Button variant="primary" onClick={() => onNext(race)}>
              {t('button.ok')}
            </Button>
          </SpaceBetween>
        </Box>
      }
      header="Warning!"
    >
      Are you sure you want to end the race?
    </Modal>
  );

  // JSX
  return (
    <PageLayout breadcrumbs={breadcrumbs} header="Time Keeper">
      <SpaceBetween size="l" direction="vertical">
        <Container>
          <ColumnLayout columns={2} variant="text-grid">
            <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
              <Header variant="h3">Race format: </Header>
              <Header variant="h3">{raceType} </Header>
            </Grid>
            <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
              <Header variant="h3">Automated timer: </Header>
              <Header variant="h3">{autTimerIsConnected ? 'Connected' : 'Not connected'} </Header>
            </Grid>
          </ColumnLayout>
        </Container>
        <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
          <Container>
            <SpaceBetween size="xs" direction="vertical">
              <Grid
                gridDefinition={[
                  { colspan: 6 },
                  { colspan: 6 },
                  { colspan: 6 },
                  { colspan: 6 },
                  { colspan: 6 },
                  { colspan: 6 },
                ]}
              >
                <Header>{t('timekeeper.current-racer')}:</Header>
                <Header variant="h2">{race.username}</Header>

                <Header>{t('timekeeper.time-left')}: </Header>
                <RaceTimer
                  onExpire={() => {
                    return send('EXPIRE');
                  }}
                  ref={raceTimerRef}
                />
                <Header>{t('timekeeper.current-lap')}:</Header>
                <LapTimer ref={lapTimerRef} />
              </Grid>
            </SpaceBetween>
            <hr></hr>
            <Grid
              gridDefinition={[
                { colspan: 6 },
                { colspan: 6 },
                { colspan: 12 },
                { colspan: 12 },
                { colspan: 3 },
                { colspan: 2 },
                { colspan: 7 },
                { colspan: 12 },
                { colspan: 6 },
                { colspan: 6 },
              ]}
              className={styles.root}
            >
              <Button onClick={() => send('DID_NOT_FINISH', { isValid: false })}>
                <Box textAlign="center" color="text-status-error" variant="h3">
                  {t('timekeeper.dnf')}
                </Box>
              </Button>
              <Button onClick={incrementCarResetCounter}>
                <Box textAlign="center" variant="h3">
                  {t('timekeeper.car-reset')}
                </Box>
              </Button>

              <Button
                onClick={() => send('CAPTURE_LAP', { isValid: true })}
                disabled={!timersAreRunning}
              >
                <Box textAlign="center" variant="h3">
                  {t('timekeeper.capture-lap')}
                </Box>
              </Button>

              <hr></hr>
              <SpaceBetween>
                <Header variant="h3">{t('timekeeper.resets')}:</Header>
                <Header variant="h3">
                  {carResetCounter}/{allowedNrResets}
                </Header>
              </SpaceBetween>
              <Button onClick={decrementCarResetCounter}>
                <Box textAlign="center" variant="h3">
                  -1
                </Box>
              </Button>
              <Button onClick={undoFalseFinishHandler}>
                <Box textAlign="center" variant="h3">
                  {t('timekeeper.undo-false-finish')}
                </Box>
              </Button>

              <hr></hr>
              <Button onClick={() => send('END')}>
                <Box textAlign="center" variant="h3">
                  {t('timekeeper.end-race')}
                </Box>
              </Button>
              <Button onClick={() => send('TOGGLE')}>
                <Box textAlign="center" variant="h3">
                  {!timersAreRunning ? t('timekeeper.start-race') : t('timekeeper.pause-race')}
                </Box>
              </Button>
            </Grid>
          </Container>
          <SpaceBetween size="m" direction="horizontal">
            <LapTable
              header={t('timekeeper.fastest-lap')}
              laps={fastestLap}
              onAction={actionHandler}
            />
            <LapTable
              header={t('timekeeper.recorded-laps')}
              laps={race.laps}
              onAction={actionHandler}
            />
          </SpaceBetween>
        </Grid>
      </SpaceBetween>
      {warningModal}
    </PageLayout>
  );
};
