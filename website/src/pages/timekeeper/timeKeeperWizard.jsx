import {
  Form,
  Wizard
} from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import useMutation from '../../hooks/useMutation';
import {
  useSelectedEventContext,
  useSelectedTrackContext,
} from '../../store/contexts/storeProvider';
import { useStore } from '../../store/store';
import { CarSelector } from './components/carSelector';
import { ModelSelector } from './components/modelSelector';
import { UploadModelToCar } from './components/uploadModelsToCar';
import { RaceFinishPage } from './pages/raceFinishPageLite';
import { RacePage } from './pages/racePageLite';
import { RaceSetupPage } from './pages/raceSetupPageLite';
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
  const [selectedCars, setSelectedCars] = useState([]);
  const [errorText, setErrorText] = useState('');
  const [nextButtonText, setNextButtonText] = useState(t("button.next"));
  const [isLoadingNextStep, setIsLoadingNextStep] = useState(false);
  const [sendMutation, loading, errorMessage, data] = useMutation();
  const messageDisplayTime = 4000;
  const notificationId = '';

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
    dispatch('SIDE_NAV_IS_OPEN', true);
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

  useEffect(() => {
    if(activeStepIndex === 1 && selectedModels.length === 0){
      console.log("skip")
      setNextButtonText(t("button.skip"))
    } else {
      console.log("next")
      setNextButtonText(t("button.next"))
    }
  },[activeStepIndex,selectedModels])

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
    setIsLoadingNextStep(false)
    setActiveStepIndex(5);
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
    setErrorText(t(""));

    setActiveStepIndex(0);
  };

  async function handleOnNavigate(detail) {
    console.log("handleOnNavigate", detail);
    if (detail.requestedStepIndex === 1 && race.username === null) {
      console.log("race", race);
      setErrorText(t("timekeeper.wizard.select-racer-error"));
    } else if (detail.requestedStepIndex === 2 && selectedModels.length === 0) {
      console.log("skip");
      setActiveStepIndex(4)
      setIsLoadingNextStep(true)
    } else {
      setIsLoadingNextStep(false)
      setActiveStepIndex(detail.requestedStepIndex)
      setErrorText(t(""));
    }
  }

  // Clear the notification is submit is successful and go back to racer selector page again
  useEffect(() => {
    if (!loading && !errorMessage && data) {
      setTimeout(() => {
        dispatch('DISMISS_NOTIFICATION', notificationId);
        //SetButtonsIsDisabled(false);
        resetRacehandler();
      }, messageDisplayTime);
    }
  }, [errorMessage, loading]);

  const submitRaceHandler = async () => {
    //SetButtonsIsDisabled(true);
    console.log(race);

    sendMutation('updateOverlayInfo', {
      eventId: race.eventId,
      eventName: raceConfig.eventName,
      trackId: race.trackId,
      username: race.username,
      userId: race.userId,
      laps: race.laps,
      averageLaps: race.averageLaps,
      timeLeftInMs: 0,
      raceStatus: 'RACE_SUBMITTED',
    });
    sendMutation('addRace', { ...race });
  };

  const discardRaceHandler = () => {
    //SetButtonsIsDisabled(true);
    //setWarningModalVisible(false);
    dispatch('ADD_NOTIFICATION', {
      type: 'warning',
      content: t('timekeeper.end-session.race-discarded'),
      id: notificationId,
      dismissible: true,
      onDismiss: () => {
        dispatch('DISMISS_NOTIFICATION', notificationId);
      },
    });
    setTimeout(() => {
      //SetButtonsIsDisabled(false);
      dispatch('DISMISS_NOTIFICATION', notificationId);
      resetRacehandler();
    }, messageDisplayTime);
  };

  // const pageToDisplay = stateMachine(activeStepIndex);
  // JSX
  return <>
    <Form errorText={errorText}>
      <Wizard
          i18nStrings={{
          stepNumberLabel: (stepNumber) => `Step ${stepNumber}`,
          collapsedStepsLabel: (stepNumber, stepsCount) =>
            `Step ${stepNumber} of ${stepsCount}`,
          skipToButtonLabel: (step, stepNumber) => `Skip to ${step.title}`,
          navigationAriaLabel: t("common.steps"),
          cancelButton: t("button.cancel"),
          previousButton: t("button.previous"),
          nextButton: nextButtonText,
          submitButton: t("button.submit-race"),
          optional: t("button.optional"),
        }}
        onNavigate={({ detail }) => handleOnNavigate(detail)}
        onSubmit={({ detail }) => {
          console.log("Submit Race");
          submitRaceHandler();
        }}
        onCancel={() => {
          console.log("Reset Wizard")
          resetRacehandler();
        }}
        activeStepIndex={activeStepIndex}
        isLoadingNextStep={isLoadingNextStep}
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
            isOptional: true,
          },
          {
            title: t("timekeeper.wizard.select-car"),
            content: (
              <CarSelector query={{
                tokens: [{ propertyKey: 'fleetName', value: selectedTrack.fleetId, operator: '=' }],
                operation: 'and',
              }}
              selectedCars={selectedCars} setSelectedCars={setSelectedCars}/>
            ),
            isOptional: true,
          },
          {
            title: t("timekeeper.wizard.upload-progress"),
            content: (
              <UploadModelToCar cars={selectedCars} event={selectedEvent} modelsToUpload={selectedModels}/>
            ),
            isOptional: false,
          },
          {
            title: t("timekeeper.wizard.timekeeper"),
            content: (
              <RacePage
                raceInfo={race}
                setRaceInfo={raceInfoHandler}
                fastestLap={fastestLap}
                fastestAverageLap={fastestAverageLap}
                raceConfig={raceConfig}
                onNext={raceIsDoneHandler}
              />
            ),
            isOptional: false,
          },
          {
            title: t("timekeeper.wizard.submit-race"),
            content: (
              <RaceFinishPage
                eventName={raceConfig.eventName}
                raceInfo={race}
                fastestLap={fastestLap}
                fastestAverageLap={fastestAverageLap}
                raceConfig={raceConfig}
                onAction={actionHandler}
                onNext={resetRacehandler}
                submitRaceHandler={submitRaceHandler}
                discardRaceHandler={discardRaceHandler}
              />
            ),
            isOptional: false,
          },
        ]}
      />
    </Form>
  </>;
};
