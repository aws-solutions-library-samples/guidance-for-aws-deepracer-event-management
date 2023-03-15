import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSideNavOptionsDispatch } from '../../store/appLayoutProvider';
import { defaultRace } from './raceDomain';
import { RaceFinishPage } from './raceFinishPage';
import { RacePage } from './racePage';
import { RaceSetupPage } from './raceSetupPage';

export const Timekeeper = () => {
  const { t } = useTranslation();
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const [raceConfig, setRaceConfig] = useState({});
  const [race, setRace] = useState(defaultRace);
  const [fastestLap, SetFastestLap] = useState([]);

  const sideNavOptionsDispatch = useSideNavOptionsDispatch();

  useEffect(() => {
    sideNavOptionsDispatch({ type: 'SIDE_NAV_IS_OPEN', value: false });
  }, [sideNavOptionsDispatch]);

  // Find the fastest lap
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

  const raceSetupHandler = (event) => {
    console.info(event);
    setRace((prevState) => {
      const test = { ...prevState, ...event.race };
      return test;
    });
    setRaceConfig((prevState) => {
      const test = { ...prevState, ...event.config };
      return test;
    });
    setActiveStepIndex(1);
  };

  const raceIsDoneHandler = (event) => {
    console.info(event);
    setRace((prevState) => {
      const test = { ...prevState, ...event };
      return test;
    });
    setActiveStepIndex(2);
  };
  const resetRacehandler = () => {
    setRace(defaultRace);
    setActiveStepIndex(0);
  };

  const stateMachine = (activeStep) => {
    console.info(activeStep);
    let pageToDisplay = undefined;
    switch (activeStep) {
      case 0:
        pageToDisplay = <RaceSetupPage onNext={raceSetupHandler} />;
        break;
      case 1:
        pageToDisplay = (
          <RacePage raceInfo={race} raceConfig={raceConfig} onNext={raceIsDoneHandler} />
        );
        break;
      case 2:
        pageToDisplay = (
          <RaceFinishPage
            eventName={raceConfig.eventName}
            raceInfo={race}
            fastestLap={fastestLap}
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
