// TODO ensure automatic timer (websocket) is working properly

import {
  Box,
  Button,
  ColumnLayout,
  Container,
  Grid,
  Header,
  SpaceBetween,
} from '@cloudscape-design/components';
import React, { useContext, useEffect, useRef, useState } from 'react';

import { useMachine } from '@xstate/react';
import { useTranslation } from 'react-i18next';
import useCounter from '../../hooks/useCounter';
import useMutation from '../../hooks/useMutation';
import useWebsocket from '../../hooks/useWebsocket';
import { useSideNavOptionsDispatch } from '../../store/appLayoutProvider';
import { eventContext } from '../../store/eventProvider';
import { usersContext } from '../../store/usersProvider';
import { GetRaceResetsNameFromId, GetRaceTypeNameFromId } from '../events/raceConfig';
import { EndSessionModal } from './endSessionModal';
import { LapTable } from './lapTable';
import LapTimer from './lapTimer';
import { defaultLap, defaultRace } from './raceDomain';
import { RaceSetupModal } from './raceSetupModal';
import RaceTimer from './raceTimer';
import { stateMachine } from './stateMachine';
import styles from './timekeeper.module.css';

export const Timekeeper = () => {
  const { t } = useTranslation();
  const [raceSetupModalIsVisible, SetRacerSelectorModalIsVisible] = useState(true);
  const [endSessionModalIsVisible, SetEndSessionModalIsVisible] = useState(false);
  const [timersAreRunning, SetTimersAreRunning] = useState(false);

  const { events, selectedEvent, setSelectedEvent } = useContext(eventContext);
  const [users, isLoadingRacers] = useContext(usersContext);

  const [race, setRace] = useState({ ...defaultRace, eventId: selectedEvent.eventId ?? null });

  const [currentLap, SetCurrentLap] = useState(defaultLap);
  const [fastestLap, SetFastestLap] = useState([]);

  const sideNavOptionsDispatch = useSideNavOptionsDispatch();

  const raceType = GetRaceTypeNameFromId(selectedEvent.tracks[0].raceConfig.rankingMethod);
  const allowedNrResets = GetRaceResetsNameFromId(
    selectedEvent.tracks[0].raceConfig.numberOfResetsPerLap
  );

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

  const GetUsernameFromId = (userId) => {
    if (!userId) return '';
    const userObj = users.find((o) => {
      return o.sub === userId;
    });
    if (!userObj) return '';
    return userObj.Username;
  };

  const [, send] = useMachine(stateMachine, {
    actions: {
      resetRace: () => {
        //console.log('Reseting race state');
        setRace((prevState) => {
          return { ...prevState, userId: null, currentModelId: null, currentCarId: null };
        });
        resetTimers();
        setRace({ ...defaultRace, eventId: selectedEvent.eventId ?? null });
        SetCurrentLap(defaultLap);

        // Restart racer selection
        SetEndSessionModalIsVisible(false);
        SetRacerSelectorModalIsVisible(true);
      },
      readyToStart: (context, event) => {
        //console.log('readyToStart race for user ' + event.userId);

        resetTimers();
        SetEndSessionModalIsVisible(false);
        SetRacerSelectorModalIsVisible(false);
      },
      endRace: () => {
        // console.log('Ending race state');
        // So the timers are paused before displaying the modal, else the race timer keeps counting down...
        setTimeout(() => {
          SetEndSessionModalIsVisible(true);
          SetRacerSelectorModalIsVisible(false);
        }, 100);
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

        const isLapValid =
          event.isValid &&
          carResetCounter <= selectedEvent.tracks[0].raceConfig.numberOfResetsPerLap;

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
          setoverlayPublishTimerId(
            setInterval(() => {
              const overlayInfo = {
                eventId: selectedEvent.eventId,
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
          eventId: selectedEvent.eventId,
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
          eventId: selectedEvent.eventId,
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

  const UpdateRace = (attr) => {
    if (attr.eventId) setSelectedEvent(events.find((event) => event.eventId === attr.eventId));

    setRace((prevState) => {
      return { ...prevState, ...attr };
    });
  };

  const onMessageFromAutTimer = (message) => {
    console.info('Automated timer sent message: ' + message);
    send('CAPTURE_AUT_LAP', { isValid: true });
  };

  //TODO fix so that useWebsocket is invoked only on local networks
  const wsUrl = window.location.href.split('/', 3)[2] ?? 'localhost:8080';
  const [autTimerIsConnected] = useWebsocket(`ws://${wsUrl}`, onMessageFromAutTimer);

  // closes sidenav when time keeper page is open
  useEffect(() => {
    sideNavOptionsDispatch({ type: 'SIDE_NAV_IS_OPEN', value: false });
  }, [sideNavOptionsDispatch]);

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

  const endSessionModalDismissed = () => {
    SetEndSessionModalIsVisible(false);
    send('RESUME');
  };

  const raceSetupModalDismissedHandler = () => {
    SetRacerSelectorModalIsVisible(false);
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
    if (selectedEvent.tracks && selectedEvent.tracks[0].raceConfig.raceTimeInMin) {
      raceTimerRef.current.reset(selectedEvent.tracks[0].raceConfig.raceTimeInMin * 60 * 1000);
    } else {
      raceTimerRef.current.reset(0 * 60 * 1000);
    }
    lapTimerRef.current.reset();
  };

  // JSX
  return (
    <Box margin={{ top: 'l' }} textAlign="center">
      <RaceSetupModal
        onOk={(userObj) => send('READY', { ...userObj })}
        onDismiss={raceSetupModalDismissedHandler}
        onChange={UpdateRace}
        events={events}
        config={race}
        visible={raceSetupModalIsVisible}
        allRacersFromBackend={users}
        isLoadingRacers={isLoadingRacers}
      />
      <EndSessionModal
        onSubmitRace={() => {
          return send('END');
        }}
        onAbandonRace={() => {
          return send('END');
        }}
        onDismiss={endSessionModalDismissed}
        onAction={actionHandler}
        race={race}
        fastestLap={fastestLap}
        selectedEvent={selectedEvent}
        visible={endSessionModalIsVisible}
      />
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
                <Header variant="h2">{GetUsernameFromId(race.userId)}</Header>

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
                {t('timekeeper.dnf')}
              </Button>
              <Button onClick={incrementCarResetCounter}>{t('timekeeper.car-reset')}</Button>
              <Button
                onClick={() => send('CAPTURE_LAP', { isValid: true })}
                disabled={!timersAreRunning}
              >
                {t('timekeeper.capture-lap')}
              </Button>

              <hr></hr>
              <SpaceBetween>
                <Header variant="h3">{t('timekeeper.resets')}:</Header>
                <Header variant="h3">
                  {carResetCounter}/{allowedNrResets}
                </Header>
              </SpaceBetween>
              <Button onClick={decrementCarResetCounter}>-1</Button>
              <Button onClick={undoFalseFinishHandler}>{t('timekeeper.undo-false-finish')}</Button>
              <hr></hr>
              <Button onClick={() => send('END')}>{t('timekeeper.end-race')}</Button>
              <Button onClick={() => send('TOGGLE')}>
                {!timersAreRunning ? t('timekeeper.start-race') : t('timekeeper.pause-race')}
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
    </Box>
  );
};
