import { API, graphqlOperation } from 'aws-amplify';
import { useEffect } from 'react';
import * as queries from '../graphql/queries';
import { onAddedEvent, onDeletedEvents, onUpdatedEvent } from '../graphql/subscriptions';
import { useStore } from '../store/store';

export const useEventsApi = (selectedEvent, setSelectedEvent, userHasAccess = false) => {
  const [, dispatch] = useStore();

  // initial data load
  useEffect(() => {
    if (userHasAccess) {
      async function getEvents() {
        dispatch('EVENTS_IS_LOADING', true);
        const responseGetEvents = await API.graphql({
          query: queries.getEvents,
        });
        const events = responseGetEvents.data.getEvents;
        const eventsInNewFormat = events.filter((event) => event.raceConfig !== null);
        dispatch('ADD_EVENTS', eventsInNewFormat);
        dispatch('EVENTS_IS_LOADING', false);
      }
      getEvents();
    }
    return () => {
      // Unmounting
    };
  }, [userHasAccess]);

  // subscribe to data changes and append them to local array
  useEffect(() => {
    let onAddEventSubscription;
    if (userHasAccess) {
      onAddEventSubscription = API.graphql(graphqlOperation(onAddedEvent)).subscribe({
        next: (event) => {
          console.debug('onAddedEvent received', event);
          dispatch('UPDATE_EVENT', event.value.data.onAddedEvent);
        },
      });
    }
    return () => {
      if (onAddEventSubscription) {
        onAddEventSubscription.unsubscribe();
      }
    };
  }, [userHasAccess]);

  // subscribe to updated events and update local array
  useEffect(() => {
    let onUpdatedEventSubscription;
    if (userHasAccess) {
      onUpdatedEventSubscription = API.graphql(graphqlOperation(onUpdatedEvent)).subscribe({
        next: (event) => {
          console.debug(event);
          const updatedEvent = event.value.data.onUpdatedEvent;

          dispatch('UPDATE_EVENT', updatedEvent);

          //update the selected event if it has been updated
          if (selectedEvent != null && updatedEvent.eventId === selectedEvent.eventId) {
            console.debug('update the selected event');
            setSelectedEvent(updatedEvent);
          }
        },
      });
    }
    return () => {
      if (onUpdatedEventSubscription) {
        onUpdatedEventSubscription.unsubscribe();
      }
    };
  }, [userHasAccess]);

  // subscribe to delete data changes and delete them from local array
  useEffect(() => {
    let onDeletedEventsSubscription;
    if (userHasAccess) {
      onDeletedEventsSubscription = API.graphql(graphqlOperation(onDeletedEvents)).subscribe({
        next: (event) => {
          const eventIdsToDelete = event.value.data.onDeletedEvents.map(
            (event) => JSON.parse(event).eventId
          );
          dispatch('DELETE_EVENTS', eventIdsToDelete);
        },
      });
    }
    return () => {
      if (onDeletedEventsSubscription) {
        onDeletedEventsSubscription.unsubscribe();
      }
    };
  }, [userHasAccess]);
};
