import {
  Box,
  Button,
  Form,
  FormField,
  Modal,
  Select,
  SpaceBetween,
} from '@cloudscape-design/components';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GetTrackTypeNameFromId } from '../admin/events/support-functions/raceConfig';
import {
  useEventsContext,
  useSelectedEventContext,
  useSelectedEventDispatch,
  useSelectedTrackContext,
  useSelectedTrackDispatch,
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
  const selectedTrack = useSelectedTrackContext();
  const setSelectedTrack = useSelectedTrackDispatch();
  const [config, SetConfig] = useState({ ...selectedEvent });
  const [eventSelectionIsNotValid, setEventSelectionIsNotValid] = useState(true);
  const [eventSelectItems, setEventSelectItems] = useState([]);
  const [nextSelectedTrack, setNextSelectedTrack] = useState(selectedTrack);
  const [nextSelectedTrackInvalid, setNextSelectedTrackInvalid] = useState(true);
  const [trackSelectItems, setTrackSelectItems] = useState([]);

  const [users, usersIsLoading, getUserNameFromId] = useUsersContext();

  const GetEventOptionFromId = (id) => {
    if (!id) return;

    const selectedEvent = events.find((event) => event.eventId === id);
    if (selectedEvent) {
      return { label: selectedEvent.eventName, value: selectedEvent.eventId };
    }
    return undefined;
  };

  const GetEventOptions = useCallback(
    (event) => {
      const eventDate = event.eventDate;
      const eventLead = getUserNameFromId(event.createdBy);
      const trackType = GetTrackTypeNameFromId(event.raceConfig.trackType);
      const trackId = 1;
      return {
        label: event.eventName,
        value: event.eventId,
        description: t('events.selector.option-description', { eventDate, eventLead }),
        tags: [t('events.selector.track-type', { trackType })],
      };
    },
    [getUserNameFromId, t]
  );

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
  }, [GetEventOptions, events, t, users]);

  useEffect(() => {
    if (config.eventId == null) {
      setEventSelectionIsNotValid(true);
    } else {
      setEventSelectionIsNotValid(false);
    }
  }, [config]);

  const changeEventAndTrack = () => {
    const event = events.find((event) => event.eventId === config.eventId);
    setSelectedEvent(event);
    setSelectedTrack(nextSelectedTrack);
    onOk();
  };

  const configHandler = (attr) => {
    SetConfig((prevState) => {
      return { ...prevState, ...attr };
    });
  };

  useEffect(() => {
    const selectedEvent = events.find((event) => event.eventId === config.eventId);
    if (selectedEvent) {
      setNextSelectedTrackInvalid(!selectedEvent.tracks.includes(nextSelectedTrack));
    }
  }, [config, events, nextSelectedTrack]);

  useEffect(() => {
    // set track select options
    console.log(config);
    const selectedEvent = events.find((event) => event.eventId === config.eventId);
    if (selectedEvent) {
      console.log(selectedEvent);
      const options = selectedEvent.tracks
        .filter((track) => track.trackId !== 'combined') // filter out the combined leaderboard
        .map((track) => {
          return { value: track.trackId, label: track.leaderBoardTitle };
        });

      setTrackSelectItems(options);
    }
  }, [config, events]);

  useEffect(() => {
    // set next selected track to default track if new selected event
    const selectedEvent = events.find((event) => event.eventId === config.eventId);
    if (selectedEvent && !selectedEvent.tracks.includes(nextSelectedTrack)) {
      setNextSelectedTrack(selectedEvent.tracks[0]);
    }
  }, [config, events, nextSelectedTrack]);

  const GetSelectedTrackOption = () => {
    if (nextSelectedTrack) {
      return {
        label: nextSelectedTrack.leaderBoardTitle || 'x',
        value: nextSelectedTrack.trackId,
      };
    }
    return undefined;
  };

  const trackSelectHandler = (detail) => {
    const selectedEvent = events.find((event) => event.eventId === config.eventId);
    setNextSelectedTrack(selectedEvent.tracks.find((item) => item.trackId === detail.trackId));
  };

  return (
    <Modal visible={visible} header={t('event-selector-modal.event-section-header')}>
      <Form
        actions={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={onDismiss}>
                {t('button.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={changeEventAndTrack}
                disabled={eventSelectionIsNotValid && nextSelectedTrackInvalid}
              >
                {t('button.ok')}
              </Button>
            </SpaceBetween>
          </Box>
        }
      >
        <SpaceBetween size={'l'}>
          <FormField label={'Event'}>
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
          <FormField label={t('event-selector-modal.select-track')}>
            <Select
              selectedOption={GetSelectedTrackOption()}
              onChange={(detail) => {
                trackSelectHandler({ trackId: detail.detail.selectedOption.value });
              }}
              options={trackSelectItems}
              selectedAriaLabel={t('timekeeper.racer-selector.selected')}
              filteringType="auto"
              autoFocus
              invalid={nextSelectedTrackInvalid}
              loadingText={t('timekeeper.racer-selector.loading-events')}
            />
          </FormField>
        </SpaceBetween>
      </Form>
    </Modal>
  );
};
