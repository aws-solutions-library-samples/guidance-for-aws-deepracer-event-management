import { Form, FormField, Grid, Input, Select, SpaceBetween } from '@cloudscape-design/components';
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';

const EventInputForm = forwardRef((props, ref) => {
  const defaultEvent = {
    eventName: '',
    fleetId: undefined,
    raceTimeInSec: 180,
    numberOfResets: 99,
  };
  const [newEvent, setNewEvent] = useState(defaultEvent);
  const [newEventNameErrorText, setNewEventNameErrorText] = useState('');
  const [selectedFleet, setSelectedFleet] = useState('');
  const [fleetsAsSelectOptions, setFleetsAsSelectOptions] = useState([]);
  // const [newEventRacingTimeErrorText, setNewEventRacingTimeErrorText] = useState('');
  // const [newEventResetsErrorText, setNewEventResetsErrorText] = useState('');

  const { events, event, onButtonDisabled, fleets } = props;
  useImperativeHandle(ref, () => ({
    getEvent: () => {
      const tempEvent = { ...newEvent };
      setNewEvent(defaultEvent);
      return tempEvent;
    },
  }));

  const mapFleetIdtoFleetName = useCallback(
    (fleetId) => {
      // console.info('current fleetId=' + fleetId);
      if (fleets && fleetId) {
        //   console.info(fleets);
        const currentFleet = fleets.find((fleet) => fleet.fleetId === fleetId);
        //   console.info(currentFleet);
        if (currentFleet) {
          //     console.info();
          //     console.info('currentFleet.name=' + currentFleet.name);
          setSelectedFleet({ label: currentFleet.fleetName, value: fleetId });
        }
      }
    },
    [fleets]
  );

  useEffect(() => {
    if (fleets) {
      setFleetsAsSelectOptions(
        fleets.map((fleet) => {
          return { label: fleet.fleetName, value: fleet.fleetId };
        })
      );
    }
  }, [fleets]);

  useEffect(() => {
    if (event) {
      setNewEvent(event);
      mapFleetIdtoFleetName(event.fleetId);
    }
  }, [event, mapFleetIdtoFleetName]);

  useEffect(() => {
    mapFleetIdtoFleetName(newEvent.fleetId);
  }, [newEvent, mapFleetIdtoFleetName]);

  // Event name input validation
  useEffect(() => {
    if (
      events &&
      events
        .map((event) => {
          return event.eventName;
        })
        .includes(newEvent.eventName)
    ) {
      // console.info(newEvent.eventName);
      setNewEventNameErrorText('Event already exists');
      onButtonDisabled(true);
    } else {
      setNewEventNameErrorText('');
      onButtonDisabled(false);
    }
  }, [newEvent.eventName, events, onButtonDisabled]);

  return (
    <Form>
      <SpaceBetween direction="vertical" size="l">
        <FormField label="Event Name" errorText={newEventNameErrorText}>
          <Input
            value={newEvent.eventName}
            placeholder="Awesome Event"
            onChange={(event) => {
              setNewEvent((prevState) => {
                return { ...prevState, eventName: event.detail.value.replace(/^\s+/g, '') };
              });
            }}
          />
        </FormField>
        <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
          <FormField label="Racing time (in seconds)">
            <Input
              value={newEvent.raceTimeInSec}
              // placeholder={defaultEvent.raceTimeInSec}
              onChange={(event) => {
                setNewEvent((prevState) => {
                  return { ...prevState, raceTimeInSec: event.detail.value };
                });
              }}
            />
          </FormField>
          <FormField label="Number of Resets (per lap)">
            <Input
              value={newEvent.numberOfResets}
              placeholder={defaultEvent.numberOfResets}
              onChange={(event) => {
                setNewEvent((prevState) => {
                  return { ...prevState, numberOfResets: event.detail.value };
                });
              }}
            />
          </FormField>
        </Grid>
        <FormField label="Car Fleet">
          <Select
            selectedOption={selectedFleet}
            onChange={({ detail }) => {
              // console.info('setting fleet ' + detail.selectedOption.label);
              setNewEvent((prevState) => {
                return { ...prevState, fleetId: detail.selectedOption.value };
              });
            }}
            options={fleetsAsSelectOptions}
            selectedAriaLabel="Selected"
            filteringType="auto"
            virtualScroll
            placeholder="Choose a car fleet used to deliver the event"
            loadingText="Loading Car fleets"
          />
        </FormField>
      </SpaceBetween>
    </Form>
  );
});

export { EventInputForm };
