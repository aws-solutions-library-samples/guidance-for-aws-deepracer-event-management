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

export const Timekeeper = () => {
  const [activeStepIndex, setActiveStepIndex] = useLocalStorage('DREM-timekeeper-state', 0);
  const [raceConfig, setRaceConfig] = useLocalStorage('DREM-timekeeper-race-config', {});
  const [race, setRace] = useLocalStorage('DREM-timekeeper-current-race', defaultRace);
  const [fastestLap, SetFastestLap] = useState([]);
  const [fastestAverageLap, setFastestAverageLap] = useState([]);
  const selectedEvent = useSelectedEventContext();
  const selectedTrack = useSelectedTrackContext();

  const [, dispatch] = useStore();
  // change event info and race config when a user select another event
  useEffect(() => {
    if (selectedEvent.eventId !== race.eventId) {
      let raceDetails = selectedEvent.raceConfig;
      raceDetails['eventName'] = selectedEvent.eventName;
      setRaceConfig(raceDetails);

      const modifiedRace = { ...race, eventId: selectedEvent.eventId };
      setRace(modifiedRace);
    }
  }, [selectedEvent, selectedTrack, race, setRace, setRaceConfig]);

  // Reset the timekeeper when navigating away from the timekeeper
  useEffect(() => {
    return () => {
      setRaceConfig({});
      setActiveStepIndex(0);
      setRace(defaultRace);
    };
  }, []);

  useEffect(() => {
    dispatch('SIDE_NAV_IS_OPEN', false);
  }, [dispatch]);

  // Find the fastest lap and fastest average window
  useEffect(() => {
    if (race.laps && race.laps.length) {
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
        // Get object with the fastest time
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

    race.averageLaps = getAverageWindows(race.laps, raceConfig.averageLapsWindow);
    if (race.averageLaps.length > 0) {
      const fastestAvgLap = race.averageLaps.reduce((acc, currentValue) => {
        return acc.avgTime > currentValue.avgTime ? currentValue : acc;
      });
      setFastestAverageLap([fastestAvgLap]);
    } else {
      setFastestAverageLap([]);
    }
  }, [race.laps]);

  // handlers functions
  const actionHandler = (id) => {
    console.debug('alter lap status for lap id: ' + id);
    const lapsCopy = [...race.laps];
    const updatedLap = { ...race.laps[id] };
    updatedLap.isValid = !updatedLap.isValid;
    lapsCopy[id] = updatedLap;
    setRace({ ...race, laps: lapsCopy });
  };

  const raceSetupHandler = (event) => {
    console.info(event);
    setRace({ ...race, ...event.race });
    setRaceConfig({ ...raceConfig, ...event.config });

    setActiveStepIndex(1);
  };

  const raceIsDoneHandler = () => {
    setActiveStepIndex(2);
  };

  const raceInfoHandler = (event) => {
    console.info('Race Info Handler');
    console.info(event);
    setRace({ ...race, ...event });
  };

  const resetRacehandler = () => {
    setRace(defaultRace);
    setRaceConfig({});
    SetFastestLap([]);
    setFastestAverageLap([]);

    setActiveStepIndex(0);
  };

  const stateMachine = (activeStep) => {
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
            onNext={raceIsDoneHandler}
          />
        );
        break;
      case 2:
        pageToDisplay = (
          <RaceFinishPage
            eventName={raceConfig.eventName}
            raceInfo={race}
            fastestLap={fastestLap}
            fastestAverageLap={fastestAverageLap}
            raceConfig={raceConfig}
            onAction={actionHandler}
            onNext={resetRacehandler}
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
