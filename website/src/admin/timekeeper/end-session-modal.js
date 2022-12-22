import {
  Box,
  Button,
  Modal,
  SpaceBetween,
  Spinner,
  StatusIndicator,
} from '@cloudscape-design/components';
import React, { useState } from 'react';

import useMutation from '../../hooks/useMutation';
import { LapTable } from './lap-table';

const EndSessionModal = (props) => {
  const [message, SetMessage] = useState('');
  const [buttonsIsDisabled, SetButtonsIsDisabled] = useState(false);
  const [sendMutation, loading] = useMutation();

  const messageDisplayTime = 2500;
  const {
    onSubmitRace,
    laps,
    selectedEvent,
    username,
    visible,
    onAction,
    onDismiss,
    onAbandonRace,
  } = props;

  const submitRaceHandler = async () => {
    console.info('Submiting Race...');
    SetButtonsIsDisabled(true);
    const response = sendMutation('addRace', {
      eventId: selectedEvent.eventId,
      username: username,
      laps: laps,
    });
    if (response) {
      SetMessage(
        <span>
          <StatusIndicator type="info">Race submitted</StatusIndicator>
        </span>
      );
      setTimeout(() => {
        onSubmitRace();
        SetMessage('');
        SetButtonsIsDisabled(false);
      }, messageDisplayTime);
    } else {
      SetMessage(
        <span>
          <StatusIndicator type="error">Could not submit race. Please try again!</StatusIndicator>
        </span>
      );
      setTimeout(() => {
        SetMessage('');
        SetButtonsIsDisabled(false);
      }, messageDisplayTime);
    }
  };

  const discardRaceHandler = () => {
    SetButtonsIsDisabled(true);
    SetMessage(
      <span>
        <StatusIndicator type="warning">Warning, race has been deleted</StatusIndicator>
      </span>
    );
    setTimeout(() => {
      onAbandonRace();
      SetMessage('');
      SetButtonsIsDisabled(false);
    }, messageDisplayTime);
  };

  return (
    <Modal
      onDismiss={() => onDismiss()}
      visible={visible}
      closeAriaLabel="Close modal"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" disabled={buttonsIsDisabled} onClick={discardRaceHandler}>
              Discard Race
            </Button>
            <Button variant="primary" disabled={buttonsIsDisabled} onClick={submitRaceHandler}>
              Submit Race
            </Button>
          </SpaceBetween>
        </Box>
      }
      header="Discard or Submit Race?"
    >
      {loading && (
        <span>
          Submitting race <Spinner />
        </span>
      )}
      {!loading && message}
      {!loading && message.length === 0 && <LapTable laps={laps} onAction={onAction} />}
    </Modal>
  );
};

export { EndSessionModal };
