// TODO fix edit event

import { Box, Button, Modal, SpaceBetween } from '@cloudscape-design/components';
import React, { useRef, useState } from 'react';
import { EventInputForm } from './EventInputForm';

const EditModal = (props) => {
  const [saveButtonDisabled, setSaveButtonDisabled] = useState(true);
  const editedEventRef = useRef();

  const { onDismiss, visible, event, fleets, onEdit } = props;

  const getEditedEvent = () => {
    const updatedEvent = editedEventRef.current.getEvent();
    onEdit(updatedEvent);
  };

  const saveButtonDisabledHandler = (state) => {
    setSaveButtonDisabled(state);
  };

  return (
    <Modal
      onDismiss={() => onDismiss()}
      visible={visible}
      closeAriaLabel="Close modal"
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss}>
              Cancel
            </Button>
            <Button variant="primary" disabled={saveButtonDisabled} onClick={getEditedEvent}>
              Save
            </Button>
          </SpaceBetween>
        </Box>
      }
      header="Edit Event"
    >
      <EventInputForm
        event={event}
        ref={editedEventRef}
        fleets={fleets}
        onButtonDisabled={saveButtonDisabledHandler}
      />
    </Modal>
  );
};

export { EditModal };
