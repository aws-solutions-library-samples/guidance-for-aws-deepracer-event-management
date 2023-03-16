import {
  Box,
  Button,
  ColumnLayout,
  Container,
  Grid,
  Header,
  Modal,
  SpaceBetween,
} from '@cloudscape-design/components';
import React, { useEffect, useRef, useState } from 'react';

import { useMachine } from '@xstate/react';
import { useTranslation } from 'react-i18next';
import { PageLayout } from '../../components/pageLayout';
import useCounter from '../../hooks/useCounter';
import { usePublishOverlay } from '../../hooks/usePublishOverlay';
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
  const [race, setRace] = useState({ ...defaultRace, ...raceInfo });
  const [currentLap, SetCurrentLap] = useState(defaultLap);
  const [fastestLap, SetFastestLap] = useState([]);
  const lapsForOverlay = useRef([]);
  const [startButtonText, setStartButtonText] = useState(t('timekeeper.start-race'));
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
  const [PublishOverlay] = usePublishOverlay();

  const [, send] = useMachine(stateMachine, {
    actions: {
      readyToStart: (context, event) => {
        resetTimers();
        SetCurrentLap(defaultLap);
      },
      endRace: () => {
        console.log('Ending race state');
        setWarningModalVisible(true);
      },
      startTimer: () => {
        setStartButtonText(t('timekeeper.pause-race'));
        startTimers();
      },
      pauseTimer: () => {
        setStartButtonText(t('timekeeper.race-page.resume-race'));
        pauseTimers();
      },
      captureLap: (context, event) => {
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

        lapsForOverlay.current.push(currentLapStats);

        // reset lap
        SetCurrentLap(defaultLap);
        resetCarResetCounter();
        lapTimerRef.current.reset();
      },
      publishReadyToStartOverlay: () => {
        PublishOverlay(() => {
          return {
            eventId: race.eventId,
            eventName: raceConfig.eventName,
            trackId: race.trackId,
            username: race.username,
            userId: race.userId,
            laps: lapsForOverlay.current,
            timeLeftInMs: raceTimerRef.current.getCurrentTimeInMs(),
            currentLapTimeInMs: lapTimerRef.current.getCurrentTimeInMs(),
            raceStatus: 'READY_TO_START',
          };
        }, 2000);
      },
      publishRaceInProgreessOverlay: () => {
        PublishOverlay(() => {
          return {
            eventId: race.eventId,
            eventName: raceConfig.eventName,
            trackId: race.trackId,
            username: race.username,
            userId: race.userId,
            laps: lapsForOverlay.current,
            timeLeftInMs: raceTimerRef.current.getCurrentTimeInMs(),
            currentLapTimeInMs: lapTimerRef.current.getCurrentTimeInMs(),
            raceStatus: 'RACE_IN_PROGRESS',
          };
        });
      },
      publishRacePausedOverlay: () => {
        PublishOverlay(() => {
          return {
            eventId: race.eventId,
            eventName: raceConfig.eventName,
            trackId: race.trackId,
            username: race.username,
            userId: race.userId,
            laps: lapsForOverlay.current,
            timeLeftInMs: raceTimerRef.current.getCurrentTimeInMs(),
            currentLapTimeInMs: lapTimerRef.current.getCurrentTimeInMs(),
            raceStatus: 'RACE_PAUSED',
          };
        }, 5000);
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
      lapsForOverlay.current = updatedLaps;
      return { ...prevState, laps: updatedLaps };
    });
  };

  // support functions
  const startTimers = () => {
    lapTimerRef.current.start();
    raceTimerRef.current.start();
  };

  const pauseTimers = () => {
    lapTimerRef.current.pause();
    raceTimerRef.current.pause();
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
            <Button
              variant="primary"
              onClick={() => {
                onNext(race);
              }}
            >
              {t('timekeeper.end-race')}
            </Button>
          </SpaceBetween>
        </Box>
      }
      header={t('timekeeper.race-page.warning-modal.header')}
    >
      {t('timekeeper.race-page.warning-modal.text')}
    </Modal>
  );

  // JSX
  return (
    <PageLayout breadcrumbs={breadcrumbs}>
      <SpaceBetween size="l" direction="vertical">
        <Container>
          <ColumnLayout columns={3} variant="text-grid">
            <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
              <Header variant="h3">{t('timekeeper.race-page.race-format-header')}: </Header>
              <Header variant="h3">{raceType} </Header>
            </Grid>
            <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
              <Header variant="h3">{t('timekeeper.current-racer')}:</Header>
              <Header variant="h3">{race.username}</Header>
            </Grid>
            <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
              <Header variant="h3">{t('timekeeper.race-page.automated-timer-header')}: </Header>
              <Header variant="h3">
                {autTimerIsConnected
                  ? t('timekeeper.race-page.automated-timer-connected')
                  : t('timekeeper.race-page.automated-timer-not-connected')}{' '}
              </Header>
            </Grid>
          </ColumnLayout>
        </Container>
        <ColumnLayout columns={2} variant="text-grid">
          <Container>
            <SpaceBetween size="xs" direction="vertical">
              <Grid
                gridDefinition={[{ colspan: 6 }, { colspan: 6 }, { colspan: 6 }, { colspan: 6 }]}
              >
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
                { colspan: 3 },
                { colspan: 6 },
                { colspan: 12 },
                { colspan: 6 },
                { colspan: 6 },
              ]}
              className={styles.root}
            >
              <button id={styles.dnf} onClick={() => send('DID_NOT_FINISH', { isValid: false })}>
                {t('timekeeper.dnf')}
              </button>
              <button id={styles.carreset} onClick={incrementCarResetCounter}>
                {t('timekeeper.car-reset')}
              </button>

              <button id={styles.capturelap} onClick={() => send('CAPTURE_LAP', { isValid: true })}>
                {t('timekeeper.capture-lap')}
              </button>

              <hr></hr>
              <SpaceBetween>
                <Header variant="h3">{t('timekeeper.resets')}:</Header>
                <Header variant="h3">
                  {carResetCounter}/{allowedNrResets}
                </Header>
              </SpaceBetween>
              <button id={styles.undoreset} onClick={decrementCarResetCounter}>
                -1
              </button>
              <button id={styles.undofalsefinish} onClick={undoFalseFinishHandler}>
                {t('timekeeper.undo-false-finish')}
              </button>

              <hr></hr>
              <button id={styles.endrace} onClick={() => send('END')}>
                {t('timekeeper.end-race')}
              </button>
              <button id={styles.startrace} onClick={() => send('TOGGLE')} variant="primary">
                {startButtonText}
              </button>
            </Grid>
          </Container>
          <Container>
            <SpaceBetween size="m" direction="horizontal">
              <LapTable
                variant="embedded"
                header={t('timekeeper.fastest-lap')}
                laps={fastestLap}
                onAction={actionHandler}
              />

              <LapTable
                variant="embedded"
                header={t('timekeeper.recorded-laps')}
                laps={race.laps}
                onAction={actionHandler}
              />
            </SpaceBetween>
          </Container>
        </ColumnLayout>
      </SpaceBetween>
      {warningModal}
    </PageLayout>
  );
};
