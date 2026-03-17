import {
  Box,
  Button,
  Form,
  FormField,
  Modal,
  Select,
  SpaceBetween,
} from '@cloudscape-design/components';
import type { SelectProps } from '@cloudscape-design/components';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GetTrackTypeNameFromId } from '../admin/events/support-functions/raceConfig';
import { useUsers } from '../hooks/useUsers';
import {
  useSelectedEventContext,
  useSelectedEventDispatch,
  useSelectedTrackContext,
  useSelectedTrackDispatch,
} from '../store/contexts/storeProvider';
import { useStore } from '../store/store';
import { getCurrentDateTime } from '../support-functions/time';
import { Event, Track } from '../types/domain';

interface EventBuckets {
  currentEvents: Event[];
  futureEvents: Event[];
  pastEvents: Event[];
  eventsWithMissingDate: Event[];
}

const sortEventsInBuckets = (events: Event[]): [Event[], Event[], Event[], Event[]] => {
  const currentDateTime = getCurrentDateTime();
  const now = currentDateTime.format('YYYY-MM-DD');
  const weekAhead = currentDateTime.add(7, 'day').format('YYYY-MM-DD');

  const dateSortedEvents = events.sort((a, b) => {
    const dateA = a.eventDate ? new Date(a.eventDate).getTime() : 0;
    const dateB = b.eventDate ? new Date(b.eventDate).getTime() : 0;
    return dateA - dateB;
  });
  const pastEvents: Event[] = [];
  const currentEvents: Event[] = [];
  const futureEvents: Event[] = [];
  const eventsWithMissingDate: Event[] = [];
  for (let i = 0; i < dateSortedEvents.length; i++) {
    const eventDate = dateSortedEvents[i].eventDate;
    if (eventDate && eventDate >= now && eventDate < weekAhead) {
      currentEvents.push(dateSortedEvents[i]);
    } else if (eventDate && eventDate < now) {
      pastEvents.push(dateSortedEvents[i]);
    } else if (eventDate && eventDate > now) {
      futureEvents.push(dateSortedEvents[i]);
    } else {
      eventsWithMissingDate.push(dateSortedEvents[i]);
    }
  }
  return [currentEvents, futureEvents, pastEvents, eventsWithMissingDate];
};

interface EventSelectorModalProps {
  visible: boolean;
  onDismiss: () => void;
  onOk: () => void;
}

export const EventSelectorModal: React.FC<EventSelectorModalProps> = ({ visible, onDismiss, onOk }) => {
  const { t } = useTranslation();
  const selectedEvent = useSelectedEventContext();
  const setSelectedEvent = useSelectedEventDispatch();
  const selectedTrack = useSelectedTrackContext();
  const setSelectedTrack = useSelectedTrackDispatch();
  const [config, SetConfig] = useState<Partial<Event>>({ ...selectedEvent });
  const [eventSelectionIsNotValid, setEventSelectionIsNotValid] = useState<boolean>(true);
  const [eventSelectItems, setEventSelectItems] = useState<SelectProps.OptionGroup[]>([]);
  const [nextSelectedTrack, setNextSelectedTrack] = useState<Track | undefined>(selectedTrack);
  const [nextSelectedTrackInvalid, setNextSelectedTrackInvalid] = useState<boolean>(true);
  const [trackSelectItems, setTrackSelectItems] = useState<SelectProps.Option[]>([]);

  const [state] = useStore();
  const events = state.events?.events || [];
  const [users, , getUserNameFromId] = useUsers();

  const GetEventOptionFromId = (id: string | undefined): SelectProps.Option | undefined => {
    if (!id) return;

    const selectedEvent = events.find((event) => event.eventId === id);
    if (selectedEvent) {
      return { label: selectedEvent.eventName, value: selectedEvent.eventId };
    }
    return undefined;
  };

  const GetEventOptions = useCallback(
    (event: Event): SelectProps.Option => {
      const eventDate = event.eventDate;
      const eventLead = getUserNameFromId(event.createdBy || '');
      const trackType = event.raceConfig ? GetTrackTypeNameFromId(event.raceConfig.trackType) : '';
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

  const changeEventAndTrack = (): void => {
    const event = events.find((event) => event.eventId === config.eventId);
    if (event && setSelectedEvent && nextSelectedTrack && setSelectedTrack) {
      setSelectedEvent(event);
      setSelectedTrack(nextSelectedTrack);
      onOk();
    }
  };

  const configHandler = (attr: Partial<Event>): void => {
    SetConfig((prevState) => {
      return { ...prevState, ...attr };
    });
  };

  useEffect(() => {
    const selectedEvent = events.find((event) => event.eventId === config.eventId);
    if (selectedEvent && selectedEvent.tracks) {
      setNextSelectedTrackInvalid(!selectedEvent.tracks.includes(nextSelectedTrack as Track));
    }
  }, [config, events, nextSelectedTrack]);

  useEffect(() => {
    // set track select options
    console.debug(config);
    const selectedEvent = events.find((event) => event.eventId === config.eventId);
    if (selectedEvent && selectedEvent.tracks) {
      console.debug(selectedEvent);
      const options = selectedEvent.tracks
        .filter((track) => track.trackId !== 'combined') // filter out the combined leaderboard
        .map((track) => {
          return { value: track.trackId, label: track.leaderBoardTitle || track.trackId };
        });

      setTrackSelectItems(options);
    }
  }, [config, events]);

  useEffect(() => {
    // set next selected track to default track if new selected event
    const selectedEvent = events.find((event) => event.eventId === config.eventId);
    if (selectedEvent && selectedEvent.tracks && !selectedEvent.tracks.includes(nextSelectedTrack as Track)) {
      setNextSelectedTrack(selectedEvent.tracks[0]);
    }
  }, [config, events, nextSelectedTrack]);

  const GetSelectedTrackOption = (): SelectProps.Option | undefined => {
    if (nextSelectedTrack) {
      return {
        label: nextSelectedTrack.leaderBoardTitle || 'x',
        value: nextSelectedTrack.trackId,
      };
    }
    return undefined;
  };

  const trackSelectHandler = (detail: { trackId: string }): void => {
    const selectedEvent = events.find((event) => event.eventId === config.eventId);
    if (selectedEvent && selectedEvent.tracks) {
      setNextSelectedTrack(selectedEvent.tracks.find((item) => item.trackId === detail.trackId));
    }
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
              selectedOption={GetEventOptionFromId(config.eventId) || null}
              onChange={(detail) => {
                configHandler({ eventId: detail.detail.selectedOption.value as string });
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
              selectedOption={GetSelectedTrackOption() || null}
              onChange={(detail) => {
                trackSelectHandler({ trackId: detail.detail.selectedOption.value as string });
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
