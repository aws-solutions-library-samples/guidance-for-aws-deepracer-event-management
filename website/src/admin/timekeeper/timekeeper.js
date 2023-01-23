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
import useWebsocket from '../../hooks/useWebsocket';
import { eventContext } from '../../store/EventProvider';
import SideNavContext from '../../store/SideNavContext';
import { GetRaceResetsNameFromId, GetRaceTypeNameFromId } from '../events/race-config';
import { EndSessionModal } from './end-session-modal';
import { LapTable } from './lap-table';
import LapTimer from './LapTimer';
import { defaultLap, defaultRace } from './race-domain';
import { RaceSetupModal } from './race-setup-modal';
import RaceTimer from './RaceTimer';
import { stateMachine } from './stateMachine';
import styles from './timekeeper.module.css';

export const Timekeeper = () => {
  const { t } = useTranslation();
  const [raceSetupModalIsVisible, SetRacerSelectorModalIsVisible] = useState(true);
  const [endSessionModalIsVisible, SetEndSessionModalIsVisible] = useState(false);
  const [timersAreRunning, SetTimersAreRunning] = useState(false);

  const { events, selectedEvent, setSelectedEvent } = useContext(eventContext);
  const [race, setRace] = useState({ ...defaultRace, eventId: selectedEvent.eventId ?? null });

  const [currentLap, SetCurrentLap] = useState(defaultLap);
  const [fastestLap, SetFastestLap] = useState([]);

  const { setNavigationOpen } = useContext(SideNavContext);

  const raceType = GetRaceTypeNameFromId(selectedEvent.raceRankingMethod);
  const allowedNrResets = GetRaceResetsNameFromId(selectedEvent.raceNumberOfResets);

  const [
    carResetCounter,
    incrementCarResetCounter,
    decrementCarResetCounter,
    resetCarResetCounter,
  ] = useCounter(0);

  const lapTimerRef = useRef();
  const raceTimerRef = useRef();
  const [overlayPublishTimerId, setoverlayPublishTimerId] = useState();

  const [, send] = useMachine(stateMachine, {
    actions: {
      resetRace: () => {
        //console.log('Reseting race state');
        setRace((prevState) => {
          return { ...prevState, username: null, currentModelId: null, currentCarId: null };
        });
        resetTimers();
        setRace({ ...defaultRace, eventId: selectedEvent.eventId ?? null });
        SetCurrentLap(defaultLap);

        // Restart racer selection
        SetEndSessionModalIsVisible(false);
        SetRacerSelectorModalIsVisible(true);
      },
      readyToStart: (context, event) => {
        //console.log('readyToStart race for user ' + event.username);

        resetTimers();
        SetEndSessionModalIsVisible(false);
        SetRacerSelectorModalIsVisible(false);
      },
      endRace: () => {
        // console.log('Ending race state');
        SetEndSessionModalIsVisible(true);
        SetRacerSelectorModalIsVisible(false);
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
        const isLapValid = event.isValid && carResetCounter <= selectedEvent.raceNumberOfResets;

        const lapId = race.laps.length;
        const currentLapStats = {
          ...currentLap,
          resets: carResetCounter,
          id: lapId,
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
          // setoverlayPublishTimerId(
          //   setInterval(() => {
          //     const overlayInfo = {
          //       eventId: selectedEvent.eventId,
          //       username: username,
          //       timeLeftInMs: raceTimerRef.current.getCurrentTimeInMs(),
          //       currentLapTimeInMs: lapTimerRef.current.getCurrentTimeInMs(),
          //     };
          //     console.log('Publishing overlay info: ' + JSON.stringify(overlayInfo));
          //     SendMutation('updateOverlayInfo', overlayInfo);
          //   }, 5000)
          // );
          console.log('TODO: starting new overlay publish timer, id=' + overlayPublishTimerId);
        }
      },
      stopPublishOverlayInfo: () => {
        console.log('Stop Publishing overlay info, id: ' + overlayPublishTimerId);
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
    setNavigationOpen(false);
  }, [setNavigationOpen]);

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
    if (selectedEvent.raceTimeInMin) {
      raceTimerRef.current.reset(selectedEvent.raceTimeInMin * 60 * 1000);
    } else {
      raceTimerRef.current.reset(0 * 60 * 1000);
    }
    lapTimerRef.current.reset();
  };

  // JSX
  return (
    <Box margin={{ top: 'l' }} textAlign="center">
      <RaceSetupModal
        onOk={(username) => send('READY', { username: username })}
        onDismiss={raceSetupModalDismissedHandler}
        onChange={UpdateRace}
        events={events}
        config={race}
        visible={raceSetupModalIsVisible}
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
        // username={race.username}
        // laps={race.laps}
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
              <Button onClick={() => send('CAPTURE_LAP', { isValid: false })}>
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
          <Grid gridDefinition={[{ colspan: 12 }, { colspan: 12 }]}>
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
        </Grid>
      </SpaceBetween>
    </Box>
  );
};
