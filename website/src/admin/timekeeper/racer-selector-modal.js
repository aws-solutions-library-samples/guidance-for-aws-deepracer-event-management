import {
  Box,
  Button,
  FormField,
  Grid,
  Modal,
  Select,
  SpaceBetween,
} from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';

import useQuery from '../../hooks/useQuery';

const RacerSelectionModal = (props) => {
  const emptySelection = { value: '', label: '' };
  const [selectedUser, SetSelectedUser] = useState({ value: '', label: '' });
  const [selectedEvent, SetSelectedEvent] = useState({ value: '', label: '' });
  const [isInvalid, SetIsInvalid] = useState(true);
  const [eventIsInvalid, SetEventIsInvalid] = useState(true);
  const [users, SetUsers] = useState([]);
  const [allRacersFromBackend, loading] = useQuery('getAllRacers');

  const { visible, onRacerSelected, onDismiss, events, onSelectedEvent } = props;

  useEffect(() => {
    if (selectedEvent.value !== '') {
      SetEventIsInvalid(false);
    } else {
      SetEventIsInvalid(true);
    }
  }, [selectedEvent]);

  useEffect(() => {
    console.info(allRacersFromBackend);
    if (allRacersFromBackend) {
      SetUsers(
        allRacersFromBackend.map((user) => {
          return { label: user.username, value: user.username };
        })
      );
    }
  }, [allRacersFromBackend]);

  useEffect(() => {
    if (selectedUser.value) {
      SetIsInvalid(false);
    } else {
      SetIsInvalid(true);
    }
  }, [selectedUser]);

  return (
    <Modal
      onDismiss={() => onDismiss()}
      visible={visible}
      closeAriaLabel="Close modal"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={() => onDismiss()}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={eventIsInvalid || isInvalid}
              onClick={() => {
                onRacerSelected(selectedUser.value);
                SetSelectedUser(emptySelection);
              }}
            >
              Ok
            </Button>
          </SpaceBetween>
        </Box>
      }
      header="Get ready to race!"
    >
      <Grid gridDefinition={[{ colspan: 12 }, { colspan: 12 }]}>
        <FormField label="Select event">
          <Select
            selectedOption={selectedEvent}
            onChange={(detail) => {
              SetSelectedEvent(detail.detail.selectedOption);
              console.info(detail.detail.selectedOption);
              const currentEvent = events.find(
                (event) => event.eventId === detail.detail.selectedOption.value
              );
              onSelectedEvent(currentEvent);
            }}
            options={events.map((event) => {
              return { label: event.eventName, value: event.eventId };
            })}
            selectedAriaLabel="Selected"
            filteringType="auto"
            virtualScroll
            invalid={eventIsInvalid}
            loadingText="Loading events"
            statusType={loading ? 'loading' : ''} // TODO fix properly, now use loading for fetching users
          />
        </FormField>
        <FormField label="Select racer">
          <Select
            selectedOption={selectedUser}
            onChange={({ detail }) => SetSelectedUser(detail.selectedOption)}
            options={users}
            selectedAriaLabel="Selected"
            filteringType="auto"
            virtualScroll
            invalid={isInvalid}
            loadingText="Loading racers"
            statusType={loading ? 'loading' : ''}
          />
        </FormField>
      </Grid>
    </Modal>
  );
};

export { RacerSelectionModal };
