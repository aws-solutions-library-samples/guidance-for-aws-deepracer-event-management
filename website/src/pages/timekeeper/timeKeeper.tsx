import React, { useEffect, useState } from 'react';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import {
  useSelectedEventContext,
  useSelectedTrackContext,
} from '../../store/contexts/storeProvider';
import { useStore } from '../../store/store';
import { RaceFinishPage } from './pages/raceFinishPage';
import { RacePage } from './pages/racePage';
import { RaceSetupPage } from './pages/raceSetupPage';
import { getAverageWindows } from './support-functions/averageClaculations';
import { defaultRace } from './support-functions/raceDomain';

interface Lap {
  lapTime: number;
  [key: string]: any;
}

/**
 * Timekeeper component for managing race timing and lap tracking
 * Handles race setup, active race timing, and race completion
 */
export const Timekeeper = (): JSX.Element => {
  const [activeStepIndex, setActiveStepIndex] = useLocalStorage<number>('DREM-timekeeper-state', 0);
  const [raceConfig, setRaceConfig] = useLocalStorage<any>('DREM-timekeeper-race-config', {});
  const [race, setRace] = useLocalStorage<any>('DREM-timekeeper-current-race', defaultRace);
  const [fetchLogsEnable, setFetchLogsEnable] = useState<boolean>(false);
  const [fastestLap, setFastestLap] = useState<Lap[]>([]);
  const [fastestAverageLap, setFastestAverageLap] = useState<Lap[]>([]);
  const [startTime, setStartTime] = useState<number | undefined>(undefined);
  const selectedEvent = useSelectedEventContext();
  const selectedTrack = useSelectedTrackContext();

  const [state, dispatch] = useStore();
  // change event info and race config when a user select another event
  useEffect(() => {
    if (selectedEvent?.eventId !== race.eventId) {
      let raceDetails: any = selectedEvent?.raceConfig;
      raceDetails['eventName'] = selectedEvent?.eventName;
      setRaceConfig(raceDetails);

      const modifiedRace = { ...race, eventId: selectedEvent?.eventId };
      setRace(modifiedRace);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEvent, selectedTrack]);

  // Reset the timekeeper when navigating away from the timekeeper
  useEffect(() => {
    return () => {
      setRaceConfig({});
      setActiveStepIndex(0);
      setRace(defaultRace);
      setFetchLogsEnable(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    dispatch('SIDE_NAV_IS_OPEN', false);
  }, [dispatch]);

  // Find the fastest lap and fastest average window
  useEffect(() => {
    if (race.laps && race.laps.length) {
      // Get all valid laps
      const validLaps = race.laps.filter((o: Lap) => {
        return o.isValid === true;
      });
      if (validLaps.length) {
        // Find fastest time
        var res = Math.min.apply(
          Math,
          validLaps.map((o: Lap) => {
            return o.time;
          })
        );
        // Get object with the fastest time
        const obj = validLaps.find((o: Lap) => {
          return o.time === res;
        });
        setFastestLap(obj ? [obj] : []);
        // Find if any car is able to log
        if (!fetchLogsEnable) {
          validLaps.some((lap: Lap) => {
            const car = state.cars?.cars.find((car: any) => {
              return car.ComputerName === lap.carName && car.LoggingCapable;
            });
            if (car) {
              setFetchLogsEnable(true);
              return true;
            } else {
              return false;
            }
          });
        }
      } else {
        setFastestLap([]);
      }
    } else {
      setFastestLap([]);
    }

    race.averageLaps = getAverageWindows(race.laps, raceConfig.averageLapsWindow);
    if (race.averageLaps.length > 0) {
      const fastestAvgLap = race.averageLaps.reduce((acc: any, currentValue: any) => {
        return acc.avgTime > currentValue.avgTime ? currentValue : acc;
      });
      setFastestAverageLap([fastestAvgLap]);
    } else {
      setFastestAverageLap([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [race.laps]);

  // handlers functions
  const actionHandler = (id: number): void => {
    console.debug('alter lap status for lap id: ' + id);
    const lapsCopy = [...race.laps];
    const updatedLap = { ...race.laps[id] };
    updatedLap.isValid = !updatedLap.isValid;
    lapsCopy[id] = updatedLap;
    setRace({ ...race, laps: lapsCopy });
  };

  const raceSetupHandler = (event: any): void => {
    console.info(event);
    setRace({ ...race, ...event.race });
    setRaceConfig({ ...raceConfig, ...event.config });

    setActiveStepIndex(1);
  };

  const raceIsDoneHandler = (): void => {
    setActiveStepIndex(2);
  };

  const raceInfoHandler = (event: any): void => {
    console.info('Race Info Handler');
    console.info(event);
    setRace({ ...race, ...event });
  };

  const resetRacehandler = (): void => {
    setRace(defaultRace);
    setRaceConfig({});
    setFastestLap([]);
    setFastestAverageLap([]);
    setStartTime(undefined);
    setActiveStepIndex(0);
    setFetchLogsEnable(false);
  };

  const stateMachine = (activeStep: number): JSX.Element | undefined => {
    let pageToDisplay = undefined;
    switch (activeStep) {
      case 0:
        pageToDisplay = <RaceSetupPage onNext={raceSetupHandler} />;
        break;
      case 1:
        pageToDisplay = (
          <RacePage
            raceInfo={race}
            setRaceInfo={raceInfoHandler}
            fastestLap={fastestLap}
            fastestAverageLap={fastestAverageLap}
            raceConfig={raceConfig}
            setStartTime={setStartTime}
            onNext={raceIsDoneHandler}
          />
        );
        break;
      case 2:
        pageToDisplay = (
          <RaceFinishPage
            eventName={raceConfig.eventName}
            raceInfo={race}
            fastestLap={fastestLap as any}
            fastestAverageLap={fastestAverageLap as any}
            raceConfig={raceConfig}
            onAction={actionHandler}
            onNext={resetRacehandler}
            startTime={startTime ? new Date(startTime) : new Date()}
            fetchLogsEnable={fetchLogsEnable}
          />
        );
        break;
      default:
        break;
    }
    return pageToDisplay;
  };

  const pageToDisplay = stateMachine(activeStepIndex);
  // JSX
  return <>{pageToDisplay}</>;
};
