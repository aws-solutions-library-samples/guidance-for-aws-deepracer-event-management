import { Box, Button, FormField, Modal, Select, SpaceBetween } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useEventsContext,
  useSelectedEventContext,
  useSelectedEventDispatch,
} from '../store/storeProvider';

export const EventSelectorModal = ({ visible, onDismiss, onOk }) => {
  const { t } = useTranslation();
  const [events] = useEventsContext();
  const selectedEvent = useSelectedEventContext();
  const setSelectedEvent = useSelectedEventDispatch();
  const [config, SetConfig] = useState({ ...selectedEvent });
  const [eventSelectionIsNotValid, setEventSelectionIsNotValid] = useState(true);

  const GetEventOptionFromId = (id) => {
    if (!id) return;

    const selectedEvent = events.find((event) => event.eventId === id);
    if (selectedEvent) {
      return { label: selectedEvent.eventName, value: selectedEvent.eventId };
    }
    return undefined;
  };

  useEffect(() => {
    if (config.eventId == null) {
      setEventSelectionIsNotValid(true);
    } else {
      setEventSelectionIsNotValid(false);
    }
  }, [config]);

  const changeEvent = () => {
    const event = events.find((event) => event.eventId === config.eventId);
    setSelectedEvent(event);
    onOk();
  };

  const configHandler = (attr) => {
    SetConfig((prevState) => {
      return { ...prevState, ...attr };
    });
  };

  return (
    <Modal
      visible={visible}
      footer={
        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={onDismiss}>
              {t('button.cancel')}
            </Button>
            <Button variant="primary" onClick={changeEvent} disabled={eventSelectionIsNotValid}>
              {t('button.ok')}
            </Button>
          </SpaceBetween>
        </Box>
      }
      header={t('timekeeper.racer-selector.select-event')}
    >
      <FormField label="Event">
        <Select
          selectedOption={GetEventOptionFromId(config.eventId)}
          onChange={(detail) => {
            configHandler({ eventId: detail.detail.selectedOption.value });
          }}
          options={events.map((event) => {
            return { label: event.eventName, value: event.eventId };
          })}
          selectedAriaLabel={t('timekeeper.racer-selector.selected')}
          filteringType="auto"
          virtualScroll
          invalid={eventSelectionIsNotValid}
          loadingText={t('timekeeper.racer-selector.loading-events')}
        />
      </FormField>
    </Modal>
  );
};
