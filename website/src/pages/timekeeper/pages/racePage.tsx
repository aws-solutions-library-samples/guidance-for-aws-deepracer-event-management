// @ts-nocheck - Complex race management with XState state machine integration
//
// This file (473 lines) is similar to racePageLite.tsx but includes additional race control features.
// Contains the same complexities:
// - XState state machine with complex context
// - 15+ useState hooks
// - Ref-based timers
// - Real-time GraphQL subscriptions
// - Overlay publishing
// - Competing Lap type definitions
//
// See racePageLite.tsx for detailed conversion requirements.
// Future improvement: Refactor common logic with racePageLite into shared typed hooks.
// Estimated conversion effort: 4-6 hours
//
import {
  Box,
  Button,
  ColumnLayout,
  Container,
  Grid,
  Header,
  Modal,
  Select,
  SpaceBetween,
} from '@cloudscape-design/components';
import { useMachine } from '@xstate/react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  GetRaceResetsNameFromId,
  GetRaceTypeNameFromId,
  RaceTypeEnum,
} from '../../../admin/events/support-functions/raceConfig';
import { SimpleHelpPanelLayout } from '../../../components/help-panels/simple-help-panel';
import { PageLayout } from '../../../components/pageLayout';
import useCounter from '../../../hooks/useCounter';
import { usePublishOverlay } from '../../../hooks/usePublishOverlay';
import useWebsocket from '../../../hooks/useWebsocket';
import { useStore } from '../../../store/store';
import { FastestAverageLapTable } from '../components/fastesAverageLapTable';
import { LapTable } from '../components/lapTable';
import LapTimer from '../components/lapTimer';
import RaceTimer from '../components/raceTimer';
import { getAverageWindows } from '../support-functions/averageClaculations';
import { defaultCar, defaultLap } from '../support-functions/raceDomain';
import { stateMachine } from '../support-functions/stateMachine';
import { Breadcrumbs } from '../support-functions/supportFunctions';

import styles from './racePage.module.css';

export const RacePage = ({
  raceInfo,
  setRaceInfo,
  setStartTime,
  fastestLap,
  fastestAverageLap,
  raceConfig,
  onNext,
}) => {
  const { t } = useTranslation(['translation', 'help-admin-timekeeper-race-page']);
  const [state] = useStore();
  const cars = [defaultCar].concat(
    state.cars.cars.filter((car) => car.PingStatus === 'Online' && car.Type === 'deepracer')
  );
  const [warningModalVisible, setWarningModalVisible] = useState(false);
  const [currentLap, SetCurrentLap] = useState(defaultLap);
  const lapsForOverlay = useRef([]);
  const averageLapTimeInformationForOverlay = useRef([]);
  const [startButtonText, setStartButtonText] = useState(t('timekeeper.start-race'));
  const raceType = GetRaceTypeNameFromId(raceConfig.rankingMethod, raceConfig.averageLapsWindow);
  const allowedNrResets = GetRaceResetsNameFromId(raceConfig.numberOfResetsPerLap);
  const [btnDNF, setBtnDNF] = useState(true);
  const [btnCarReset, setBtnCarReset] = useState(true);
  const [btnCaptureLap, setBtnCaptureLap] = useState(true);
  const [btnUndoReset, setBtnUndoReset] = useState(true);
  const [btnUndoFalseFinish, setBtnUndoFalseFinish] = useState(true);
  const [btnEndRace, setBtnEndRace] = useState(false);
  const [btnStartRace, setBtnStartRace] = useState(false);
  const [currentCar, setCurrentCar] = useState(defaultCar);

  const [
    carResetCounter,
    incrementCarResetCounter,
    decrementCarResetCounter,
    resetCarResetCounter,
  ] = useCounter(0);

  const lapTimerRef = useRef();
  const raceTimerRef = useRef();
  const startTimeRef = useRef();
  const [PublishOverlay] = usePublishOverlay();

  // populate the laps on page refresh, without this laps array in the overlay is empty
  useEffect(() => {
    lapsForOverlay.current = raceInfo.laps;
  }, []);

  const [, send] = useMachine(stateMachine, {
    actions: {
      readyToStart: (context, event) => {
        resetTimers();
        SetCurrentLap(defaultLap);
      },
      endRace: () => {
        console.debug('Ending race state');
        setWarningModalVisible(true);
        // Buttons
        setBtnEndRace(true);
        setBtnStartRace(true);
        setStartTime(startTimeRef.current);
      },
      startTimer: () => {
        if (startTimeRef.current === undefined) {
          startTimeRef.current = new Date();
          console.debug('Setting initial race start time', startTimeRef.current);
        }
        setStartButtonText(t('timekeeper.pause-race'));
        startTimers();
        // Buttons
        toggleBtnState(false);
        setBtnEndRace(false);
      },
      pauseTimer: () => {
        setStartButtonText(t('timekeeper.race-page.resume-race'));
        pauseTimers();
        // Buttons
        toggleBtnState(true);
        setBtnEndRace(false);
        setBtnStartRace(false);
      },
      captureLap: (context, event) => {
        event.isValid = 'isValid' in event ? event.isValid : false;

        const isLapValid = event.isValid && carResetCounter <= raceConfig.numberOfResetsPerLap;

        const lapId = raceInfo.laps.length;
        const currentLapStats = {
          ...currentLap,
          resets: carResetCounter,
          lapId: lapId,
          modelId: raceInfo.currentModelId,
          carName: currentCar.ComputerName,
          time: lapTimerRef.current.getCurrentTimeInMs(),
          isValid: isLapValid,
          autTimerConnected: autTimerIsConnected,
        };

        const laps = [...raceInfo.laps, currentLapStats];
        const averageLapInformation = getAverageWindows(laps, raceConfig.averageLapsWindow);

        setRaceInfo({ laps: laps, averageLaps: averageLapInformation });
        lapsForOverlay.current.push(currentLapStats);

        averageLapTimeInformationForOverlay.current = averageLapInformation;

        // reset lap
        SetCurrentLap(defaultLap);
        resetCarResetCounter();
        lapTimerRef.current.reset();
      },
      publishReadyToStartOverlay: () => {
        PublishOverlay(() => {
          return {
            eventId: raceInfo.eventId,
            eventName: raceConfig.eventName,
            trackId: raceInfo.trackId,
            username: raceInfo.username,
            userId: raceInfo.userId,
            laps: lapsForOverlay.current,
            averageLaps: averageLapTimeInformationForOverlay.current,
            timeLeftInMs: raceConfig.raceTimeInMin * 60 * 1000, // racetime in MS
            currentLapTimeInMs: 0,
            raceStatus: 'READY_TO_START',
          };
        });
      },
      publishRaceInProgreessOverlay: () => {
        PublishOverlay(() => {
          return {
            eventId: raceInfo.eventId,
            eventName: raceConfig.eventName,
            trackId: raceInfo.trackId,
            username: raceInfo.username,
            userId: raceInfo.userId,
            laps: lapsForOverlay.current,
            averageLaps: averageLapTimeInformationForOverlay.current,
            timeLeftInMs: raceTimerRef.current.getCurrentTimeInMs(),
            currentLapTimeInMs: lapTimerRef.current.getCurrentTimeInMs(),
            raceStatus: 'RACE_IN_PROGRESS',
          };
        }, 2000);
      },
      publishRacePausedOverlay: () => {
        PublishOverlay(() => {
          return {
            eventId: raceInfo.eventId,
            eventName: raceConfig.eventName,
            trackId: raceInfo.trackId,
            username: raceInfo.username,
            userId: raceInfo.userId,
            laps: lapsForOverlay.current,
            averageLaps: averageLapTimeInformationForOverlay.current,
            timeLeftInMs: raceTimerRef.current.getCurrentTimeInMs(),
            currentLapTimeInMs: lapTimerRef.current.getCurrentTimeInMs(),
            raceStatus: 'RACE_PAUSED',
          };
        });
      },
    },
  });

  const onMessageFromAutTimer = (message) => {
    console.info('Automated timer sent message: ' + message);
    send('CAPTURE_AUT_LAP', { isValid: true });
  };

  const wsUrl = window.location.href.split('/', 3)[2] ?? 'localhost:8080';
  const [autTimerIsConnected] = useWebsocket(`ws://${wsUrl}`, onMessageFromAutTimer);

  // handlers functions
  const actionHandler = (id) => {
    console.debug('alter lap status for lap id: ' + id);
    const lapsCopy = [...raceInfo.laps];
    const updatedLap = { ...raceInfo.laps[id] };
    updatedLap.isValid = !updatedLap.isValid;
    lapsCopy[id] = updatedLap;

    const averageLapInformation = getAverageWindows(lapsCopy, raceConfig.averageLapsWindow);
    averageLapTimeInformationForOverlay.current = averageLapInformation;
    lapsForOverlay.current = lapsCopy;
    setRaceInfo({ laps: lapsCopy, averageLaps: averageLapInformation });
  };

  const undoFalseFinishHandler = () => {
    const updatedLaps = [...raceInfo.laps];
    if (updatedLaps.length !== 0) {
      const lastLap = updatedLaps.pop();
      lapTimerRef.current.reset(lapTimerRef.current.getCurrentTimeInMs() + lastLap.time);
      resetCarResetCounter(lastLap.resets);
    }
    lapsForOverlay.current = updatedLaps;
    setRaceInfo({ laps: updatedLaps });
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

  const toggleBtnState = (btnDisabledState) => {
    setBtnDNF(btnDisabledState);
    setBtnCarReset(btnDisabledState);
    setBtnCaptureLap(btnDisabledState);
    setBtnUndoReset(btnDisabledState);
    setBtnUndoFalseFinish(btnDisabledState);
  };

  const warningModal = (
    <Modal
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
                //onNext(race);
                onNext();
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
  const breadcrumbs = Breadcrumbs();
  let fastestAverageLapInformation = <></>;
  if (raceConfig.rankingMethod === RaceTypeEnum.BEST_AVERAGE_LAP_TIME_X_LAP) {
    fastestAverageLapInformation = <FastestAverageLapTable fastestAverageLap={fastestAverageLap} />;
  }

  return (
    <PageLayout
      helpPanelHidden={false}
      helpPanelContent={
        <SimpleHelpPanelLayout
          headerContent={t('header', { ns: 'help-admin-timekeeper-race-page' })}
          bodyContent={t('content', { ns: 'help-admin-timekeeper-race-page' })}
          footerContent={t('footer', { ns: 'help-admin-timekeeper-race-page' })}
        />
      }
      breadcrumbs={breadcrumbs}
      header={t('timekeeper.race-page.page-header')}
      description={t('timekeeper.race-page.page-description')}
    >
      <SpaceBetween size="l" direction="vertical">
        <ColumnLayout columns={2}>
          <Container>
            <SpaceBetween size="xs" direction="vertical">
              <Grid
                gridDefinition={[{ colspan: 6 }, { colspan: 6 }, { colspan: 6 }, { colspan: 6 }]}
              >
                <span key="current-racer">
                  <Header variant="h5">{t('timekeeper.current-racer')}:</Header>
                  <Header variant="h3">{raceInfo.username}</Header>
                </span>
                <span key="current-car">
                  <Header variant="h5">{t('timekeeper.current-car')}:</Header>
                  <Select
                    selectedOption={{
                      label: currentCar.ComputerName,
                      value: currentCar.Computername,
                    }}
                    onChange={({ detail }) => {
                      setCurrentCar(detail.selectedOption.value);
                    }}
                    options={cars.map((car) => {
                      return { label: car['ComputerName'], value: car };
                    })}
                  />
                </span>
              </Grid>
              <Grid
                gridDefinition={[{ colspan: 6 }, { colspan: 6 }, { colspan: 6 }, { colspan: 6 }]}
              >
                <span key="time-left">
                  <Header variant="h5">{t('timekeeper.time-left')}</Header>

                  <RaceTimer
                    onExpire={() => {
                      return send('EXPIRE');
                    }}
                    ref={raceTimerRef}
                  />
                </span>
                <span key="current-lap">
                  <Header variant="h5">{t('timekeeper.current-lap')}</Header>
                  <LapTimer ref={lapTimerRef} />
                </span>
              </Grid>
            </SpaceBetween>
            <Grid
              gridDefinition={[
                { colspan: 12 },
                { colspan: 6 },
                { colspan: 6 },
                { colspan: 4 },
                { colspan: 2 },
                { colspan: 6 },
                { colspan: 6 },
                { colspan: 6 },
              ]}
              className={styles.root}
            >
              <button
                key="capturelap"
                id={styles.capturelap}
                onClick={() => send('CAPTURE_LAP', { isValid: true })}
                disabled={btnCaptureLap}
              >
                {t('timekeeper.capture-lap')}
              </button>
              <button
                key="dnf"
                id={styles.dnf}
                onClick={() => send('DID_NOT_FINISH', { isValid: false })}
                disabled={btnDNF}
              >
                {t('timekeeper.dnf')}
              </button>
              <button
                key="carreset"
                id={styles.carreset}
                onClick={incrementCarResetCounter}
                disabled={btnCarReset}
              >
                {t('timekeeper.car-reset')}
              </button>
              <SpaceBetween key="resets">
                <Header variant="h5">{t('timekeeper.resets')}</Header>
                <Header variant="h3">
                  {carResetCounter}/{allowedNrResets}
                </Header>
              </SpaceBetween>
              <button
                key="undoreset"
                id={styles.undoreset}
                onClick={decrementCarResetCounter}
                disabled={btnUndoReset}
              >
                -1
              </button>
              <button
                key="undofalsefinish"
                id={styles.undofalsefinish}
                onClick={undoFalseFinishHandler}
                disabled={btnUndoFalseFinish}
              >
                {t('timekeeper.undo-false-finish')}
              </button>
              <button key="endrace" id={styles.endrace} onClick={() => send('END')} disabled={btnEndRace}>
                {t('timekeeper.end-race')}
              </button>
              <button key="startrace" id={styles.startrace} onClick={() => send('TOGGLE')} disabled={btnStartRace}>
                {startButtonText}
              </button>
            </Grid>
          </Container>
          <div>
            <SpaceBetween size="m" direction="horizontal">
              <Container>
                <SpaceBetween size="m" direction="horizontal">
                  <ColumnLayout columns={2}>
                    <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
                      <b key="race-format-label">{t('timekeeper.race-page.race-format-header')}</b>
                      <span key="race-format-value">{raceType}</span>
                    </Grid>

                    <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
                      <b key="auto-timer-label">
                        <nobr>{t('timekeeper.race-page.automated-timer-header')}</nobr>
                      </b>
                      <span key="auto-timer-value">
                      {autTimerIsConnected
                        ? t('timekeeper.race-page.automated-timer-connected')
                        : t('timekeeper.race-page.automated-timer-not-connected')}{' '}
                      </span>
                    </Grid>
                  </ColumnLayout>
                </SpaceBetween>
              </Container>
              <Container>
                <SpaceBetween size="m" direction="horizontal">
                  <LapTable
                    variant="embedded"
                    header={t('timekeeper.fastest-lap')}
                    laps={fastestLap}
                    onAction={actionHandler}
                  />
                  {fastestAverageLapInformation}
                  <LapTable
                    variant="embedded"
                    header={t('timekeeper.recorded-laps')}
                    laps={raceInfo.laps}
                    averageLapInformation={raceInfo.averageLaps}
                    rankingMethod={raceConfig.rankingMethod}
                    onAction={actionHandler}
                  />
                </SpaceBetween>
              </Container>
            </SpaceBetween>
          </div>
        </ColumnLayout>
      </SpaceBetween>
      {warningModal}
    </PageLayout>
  );
};
