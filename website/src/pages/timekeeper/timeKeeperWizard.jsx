import {
  Wizard
} from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import {
  useSelectedEventContext,
  useSelectedTrackContext,
} from '../../store/contexts/storeProvider';
import { useStore } from '../../store/store';
import { ModelSelector } from './components/modelSelector';
import { RaceSetupPage } from './pages/raceSetupPage';
import { getAverageWindows } from './support-functions/averageClaculations';
import { defaultRace } from './support-functions/raceDomain';

export const TimekeeperWizard = () => {
  const { t } = useTranslation();
  const [activeStepIndex, setActiveStepIndex] = useLocalStorage('DREM-timekeeper-state', 0);
  const [raceConfig, setRaceConfig] = useLocalStorage('DREM-timekeeper-race-config', {});
  const [race, setRace] = useLocalStorage('DREM-timekeeper-current-race', defaultRace);
  const [fastestLap, SetFastestLap] = useState([]);
  const [fastestAverageLap, setFastestAverageLap] = useState([]);
  const selectedEvent = useSelectedEventContext();
  const selectedTrack = useSelectedTrackContext();
  const [eventSelectModalVisible, setEventSelectModalVisible] = useState(false);
  const [selectedModels, setSelectedModels] = useState([]);

  useEffect(() => {
    console.log(selectedModels)
  },[selectedModels])

  useEffect(() => {
    console.log(race.username)
    setSelectedModels([])
  },[race.username])

  // Show event selector modal if no event has been selected, timekeeper must have an event selected to work
  useEffect(() => {
    if (selectedEvent.eventId == null) {
      setEventSelectModalVisible(true);
    }
  }, [selectedEvent]);

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
  }, [selectedEvent, selectedTrack, setRace, setRaceConfig]);

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
    console.info(race);
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

  // var raceDetails = {
  //   race: race,
  //   config: selectedEvent.raceConfig,
  // };
  // raceDetails.config['eventName'] = selectedEvent.eventName;
  // raceDetails.race['eventId'] = selectedEvent.eventId;
  // raceDetails.race['laps'] = [];

  // useEffect(() => {
  //   console.info(raceDetails);
  //   setRace({ ...race, ...raceDetails.race });
  //   setRaceConfig({ ...raceConfig, ...raceDetails.config });
  //   // setActiveStepIndex(1);
  // }, [raceDetails]);

  // var raceSetupHandler = (event) => {
  //   console.info(event);
  //   setRace({ ...race, ...event.race });
  //   setRaceConfig({ ...raceConfig, ...event.config });

  //   setActiveStepIndex(1);
  // };

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

  // const stateMachine = (activeStep) => {
  //   let pageToDisplay = undefined;
  //   switch (activeStep) {
  //     case 0:
  //       pageToDisplay = <RaceSetupPage onNext={raceSetupHandler} />;
  //       break;
  //     case 1:
  //       pageToDisplay = (
  //         <RacePage
  //           raceInfo={race}
  //           setRaceInfo={raceInfoHandler}
  //           fastestLap={fastestLap}
  //           fastestAverageLap={fastestAverageLap}
  //           raceConfig={raceConfig}
  //           onNext={raceIsDoneHandler}
  //         />
  //       );
  //       break;
  //     case 2:
  //       pageToDisplay = (
  //         <RaceFinishPage
  //           eventName={raceConfig.eventName}
  //           raceInfo={race}
  //           fastestLap={fastestLap}
  //           fastestAverageLap={fastestAverageLap}
  //           raceConfig={raceConfig}
  //           onAction={actionHandler}
  //           onNext={resetRacehandler}
  //         />
  //       );
  //       break;
  //     default:
  //       break;
  //   }
  //   return pageToDisplay;
  // };

  async function handleOnNavigate(detail) {
    console.log(detail);
    setActiveStepIndex(detail.requestedStepIndex)
  }

  // const pageToDisplay = stateMachine(activeStepIndex);
  // JSX
  return <Wizard
      i18nStrings={{
      stepNumberLabel: (stepNumber) => `Step ${stepNumber}`,
      collapsedStepsLabel: (stepNumber, stepsCount) =>
        `Step ${stepNumber} of ${stepsCount}`,
      skipToButtonLabel: (step, stepNumber) => `Skip to ${step.title}`,
      navigationAriaLabel: t("common.steps"),
      cancelButton: t("button.cancel"),
      previousButton: t("button.previous"),
      nextButton: t("button.next"),
      submitButton: t("button.finish"),
      optional: t("button.optional"),
    }}
    onNavigate={({ detail }) => handleOnNavigate(detail)}
    onSubmit={({ detail }) => {
      console.log("Start Race")
    }}
    onCancel={() => {
      console.log("Reset Wizard")
    }}
    activeStepIndex={activeStepIndex}
    isLoadingNextStep={false}
    allowSkipTo={false}
    steps={[
      {
        title: t("timekeeper.wizard.select-racer"),
        content: (
          <RaceSetupPage race={race} setRace={setRace}/>
        ),
        isOptional: false,
      },
      {
        title: t("timekeeper.wizard.select-models"),
        content: (
          <ModelSelector query={{
            tokens: [{ propertyKey: 'username', value: race.username, operator: '=' }],
            operation: 'and',
          }}
          selectedModels={selectedModels}
          setSelectedModels={setSelectedModels}
          />
        ),
        isOptional: false,
      },
      {
        title: t("timekeeper.wizard.select-car"),
        content: (
          <p>Select car</p>
        ),
        isOptional: false,
      },
      {
        title: t("timekeeper.wizard.upload-progress"),
        content: (
          <p>Upload progress</p>
        ),
        isOptional: false,
      },
    ]}
  />;
};
