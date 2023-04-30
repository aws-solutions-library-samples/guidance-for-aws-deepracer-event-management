import { Box, Button, FormField, Modal, Select, SpaceBetween } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GetTrackTypeNameFromId } from '../admin/events/support-functions/raceConfig';
import {
  useEventsContext,
  useSelectedEventContext,
  useSelectedEventDispatch,
  useUsersContext,
} from '../store/storeProvider';
import { getCurrentDateTime } from '../support-functions/time';

const sortEventsInBuckets = (events) => {
  const currentDateTime = getCurrentDateTime();
  const now = currentDateTime.format('YYYY-MM-DD');
  const weekAhead = currentDateTime.add(7, 'day').format('YYYY-MM-DD');

  const dateSortedEvents = events.sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));
  const pastEvents = [];
  const currentEvents = [];
  const futureEvents = [];
  const eventsWithMissingDate = [];
  for (let i = 0; i < dateSortedEvents.length; i++) {
    if (dateSortedEvents[i].eventDate >= now && dateSortedEvents[i].eventDate < weekAhead) {
      currentEvents.push(dateSortedEvents[i]);
    } else if (dateSortedEvents[i].eventDate < now) {
      pastEvents.push(dateSortedEvents[i]);
    } else if (dateSortedEvents[i].eventDate > now) {
      futureEvents.push(dateSortedEvents[i]);
    } else eventsWithMissingDate.push(dateSortedEvents[i]);
  }
  return [currentEvents, futureEvents, pastEvents, eventsWithMissingDate];
};

export const EventSelectorModal = ({ visible, onDismiss, onOk }) => {
  const { t } = useTranslation();
  const [events] = useEventsContext();
  const selectedEvent = useSelectedEventContext();
  const setSelectedEvent = useSelectedEventDispatch();
  const [config, SetConfig] = useState({ ...selectedEvent });
  const [eventSelectionIsNotValid, setEventSelectionIsNotValid] = useState(true);
  const [eventSelectItems, setEventSelectItems] = useState([]);

  const [users, usersIsLoading, getUserNameFromId] = useUsersContext();

  const GetEventOptionFromId = (id) => {
    if (!id) return;

    const selectedEvent = events.find((event) => event.eventId === id);
    if (selectedEvent) {
      return { label: selectedEvent.eventName, value: selectedEvent.eventId };
    }
    return undefined;
  };

  const GetEventOptions = (event) => {
    const eventDate = event.eventDate;
    const eventLead = getUserNameFromId(event.createdBy);
    const trackType = GetTrackTypeNameFromId(event.tracks[0].raceConfig.trackType);
    const trackId = 1;
    return {
      label: event.eventName,
      value: event.eventId,
      description: t('events.selector.option-description', { eventDate, eventLead }),
      tags: [
        t('events.selector.track', { trackId }),
        t('events.selector.track-type', { trackType }),
      ],
    };
  };

  useEffect(() => {
    if (events) {
      const [currentEvents, futureEvents, pastEvents, eventsWithMissingDate] =
        sortEventsInBuckets(events);
      setEventSelectItems(() => {
        return [
          {
            label: t('events.selector.current-events'),
            options: currentEvents.map((event) => GetEventOptions(event)),
          },
          {
            label: t('events.selector.future-events'),
            options: futureEvents.map((event) => GetEventOptions(event)),
          },
          {
            label: t('events.selector.past-events'),
            options: pastEvents.map((event) => GetEventOptions(event)),
          },
          {
            label: t('events.selector.events-with-missing-date'),
            options: eventsWithMissingDate.map((event) => GetEventOptions(event)),
          },
        ];
      });
    }
  }, [events, users]);

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
      <FormField>
        <Select
          selectedOption={GetEventOptionFromId(config.eventId)}
          onChange={(detail) => {
            configHandler({ eventId: detail.detail.selectedOption.value });
          }}
          options={eventSelectItems}
          selectedAriaLabel={t('timekeeper.racer-selector.selected')}
          filteringType="auto"
          virtualScroll
          autoFocus
          invalid={eventSelectionIsNotValid}
          loadingText={t('timekeeper.racer-selector.loading-events')}
        />
      </FormField>
    </Modal>
  );
};
