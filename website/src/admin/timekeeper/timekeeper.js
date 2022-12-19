// TODO ensure automatic timer (websocket) is working properly

import { Box, Button, Container, Grid, Header, SpaceBetween } from '@cloudscape-design/components';
import React, { useContext, useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';
import useCounter from '../../hooks/useCounter';
import useTimer from '../../hooks/useTimer';
import { eventContext } from '../../store/EventProvider';
import SideNavContext from '../../store/SideNavContext';
import { CountDownTimer } from './count-down-timer';
import { EndSessionModal } from './end-session-modal';
import { LapTable } from './lap-table';
import { RacerSelectionModal } from './racer-selector-modal';
import styles from './timekeeper.module.css';

const Timekeeper = () => {
  const { t } = useTranslation();
  const [racerSelecorModalIsVisible, SetRacerSelectorModalIsVisible] = useState(true);
  const [endSessionModalIsVisible, SetEndSessionModalIsVisible] = useState(false);
  const [timerIsReset, SetTimerIsReset] = useState(false);

  const [username, SetUsername] = useState();
  const lapTemplate = {
    id: null,
    time: 0,
    resets: 0,
    crashes: 0,
    isValid: false,
  };
  const [currentLap, SetCurrentLap] = useState(lapTemplate);

  const [laps, SetLaps] = useState([]);
  const [fastestLap, SetFastestLap] = useState([]);

  const [isLastLap, SetIsLastLap] = useState(false);

  const connected = false; // TODO remove when activating websocket (automated timer)
  // const { message, connected } = useWebsocket('ws://localhost:8080');
  const { setNavigationOpen } = useContext(SideNavContext);
  const { events, selectedEvent, setSelectedEvent } = useContext(eventContext);

  const [
    carResetCounter,
    incrementCarResetCounter,
    decrementCarResetCounter,
    resetCarResetCounter,
  ] = useCounter(0);

  const [time, timeInMilliseconds, lapTimerIsRunning, startLapTimer, pauseLapTimer, resetLapTimer] =
    useTimer(8);

  // closes sidenav when time keeper page is open
  useEffect(() => {
    setNavigationOpen(false);
  }, [setNavigationOpen]);

  // Find the fastest lap
  useEffect(() => {
    if (laps.length) {
      // Get all valid laps
      const validLaps = laps.filter((o) => {
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
  }, [laps]);

  // handlers functions
  const endSessionHandler = () => {
    SetEndSessionModalIsVisible(true);
  };

  const captureNewLapHandler = (lapIsValid) => {
    const lapId = laps.length;
    const currentLapStats = {
      ...currentLap,
      resets: carResetCounter,
      id: lapId,
      time: timeInMilliseconds,
      isValid: lapIsValid,
    };

    SetLaps((prevState) => {
      return [...prevState, currentLapStats];
    });
    SetCurrentLap(lapTemplate);
    resetCarResetCounter();
    resetLapTimer();

    // Check if race is over and this is the last lap
    if (isLastLap) {
      pauseLapTimer();
    }
  };

  const submitRaceHandler = () => {
    console.log('Submit race');
    resetRace();
  };

  const abandonRaceHandler = () => {
    console.log('Abandon race');
    resetRace();
  };

  const raceIsOverHandler = () => {
    console.log('Race is over!');
    SetIsLastLap(true);
  };

  const raceStartedHandler = (username) => {
    console.log('Start race for user: ' + username);
    SetUsername(username);
    SetRacerSelectorModalIsVisible(false);
    SetTimerIsReset(false);
  };

  const actionHandler = (id) => {
    console.log('alter lap status for lap id: ' + id);
    const lapsCopy = [...laps];
    const updatedLap = { ...laps[id] };
    updatedLap.isValid = !updatedLap.isValid;
    lapsCopy[id] = updatedLap;
    SetLaps(lapsCopy);
  };

  const raceHandler = () => {
    console.warn('username: ' + username);
    if (username === undefined) {
      SetRacerSelectorModalIsVisible(true);
      pauseLapTimer();
    } else if (lapTimerIsRunning) {
      pauseLapTimer();
    } else {
      startLapTimer();
    }
  };

  const endSessionModalDismissed = () => {
    SetEndSessionModalIsVisible(false);
  };

  const racerSelectionModalDismissedHandler = () => {
    SetRacerSelectorModalIsVisible(false);
    // TODO display warning that a racer needs to be selected
  };

  const undoFalseFinishHandler = () => {
    SetLaps((prevState) => {
      const updatedLaps = [...prevState];
      const lastLap = updatedLaps.pop();
      resetLapTimer(timeInMilliseconds + lastLap.time);
      return updatedLaps;
    });
  };

  // support functions
  const resetRace = () => {
    console.log('Reseting race');
    SetUsername();
    SetTimerIsReset(true);
    pauseLapTimer();
    resetLapTimer();
    SetLaps([]);
    SetIsLastLap(false);
    SetCurrentLap(lapTemplate);

    // Restart racer selection
    SetEndSessionModalIsVisible(false);
    SetRacerSelectorModalIsVisible(true);
  };

  return (
    <Box margin={{ top: 'l' }} textAlign="center">
      <RacerSelectionModal
        onRacerSelected={raceStartedHandler}
        onDismiss={racerSelectionModalDismissedHandler}
        visible={racerSelecorModalIsVisible}
        events={events}
        onSelectedEvent={setSelectedEvent}
      />
      <EndSessionModal
        onSubmitRace={submitRaceHandler}
        onAbandonRace={abandonRaceHandler}
        onDismiss={endSessionModalDismissed}
        onAction={actionHandler}
        username={username}
        laps={laps}
        selectedEvent={selectedEvent}
        visible={endSessionModalIsVisible}
      />

      <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
        <Container>
          <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
            <Header>{t('timekeeper.current-racer')}:</Header>
            <Header>{username}</Header>
          </Grid>
          <hr></hr>
          <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }, { colspan: 6 }, { colspan: 6 }]}>
            <Header>{t('timekeeper.time-left')}: </Header>
            <CountDownTimer
              duration={selectedEvent.raceTimeInSec * 1000}
              isReset={timerIsReset}
              isRunning={lapTimerIsRunning}
              onExpire={raceIsOverHandler}
            />
            <Header>{t('timekeeper.current-lap')}:</Header>
            <Header>
              {time.minutes}:{time.seconds}:{time.milliseconds}
            </Header>
            {/* <LapTimer isReset={lapTimerIsReset} isRunning={lapTimerIsRunning} ref={lapTimerRef} /> */}
          </Grid>
          <hr></hr>
          <Grid
            gridDefinition={[
              { colspan: 6 },
              { colspan: 6 },
              { colspan: 12 },
              { colspan: 12 },
              { colspan: 12 },
              { colspan: 2 },
              { colspan: 3 },
              { colspan: 7 },
              { colspan: 12 },
              { colspan: 6 },
              { colspan: 6 },
            ]}
            className={styles.root}
          >
            <Button onClick={captureNewLapHandler.bind(null, false)} disabled={!lapTimerIsRunning}>
              {t('timekeeper.dnf')}
            </Button>
            <Button onClick={incrementCarResetCounter} disabled={!lapTimerIsRunning}>
              {t('timekeeper.car-reset')}
            </Button>
            <Button onClick={captureNewLapHandler.bind(null, true)} disabled={!lapTimerIsRunning}>
              {t('timekeeper.capture-lap')}
            </Button>
            <div>{connected ? 'Automated timer connected' : 'Automated timer not connected'} </div>
            <hr></hr>
            <Grid>
              <div>{t('timekeeper.resets')}:</div>
              <div>
                {carResetCounter}/{selectedEvent.numberOfResets}
              </div>
            </Grid>
            <Button onClick={decrementCarResetCounter} disabled={!lapTimerIsRunning}>
              -1
            </Button>
            <Button disabled={!lapTimerIsRunning} onClick={undoFalseFinishHandler}>
              {t('timekeeper.undo-false-finish')}
            </Button>
            <hr></hr>
            <Button onClick={endSessionHandler}>{t('timekeeper.end-race')}</Button>
            <Button onClick={() => raceHandler()}>
              {!lapTimerIsRunning ? t('timekeeper.start-race') : t('timekeeper.pause-race')}
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
            <LapTable header={t('timekeeper.recorded-laps')} laps={laps} onAction={actionHandler} />
          </SpaceBetween>
        </Grid>
      </Grid>
    </Box>
  );
};

export { Timekeeper };
