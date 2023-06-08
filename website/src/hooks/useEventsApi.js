import { API, graphqlOperation } from 'aws-amplify';
import { useEffect, useState } from 'react';
import * as queries from '../graphql/queries';
import { onAddedEvent, onDeletedEvents, onUpdatedEvent } from '../graphql/subscriptions';

export const useEventsApi = (selectedEvent, setSelectedEvent, userHasAccess = false) => {
  const [isLoading, setIsLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');

  // initial data load
  useEffect(() => {
    if (userHasAccess) {
      async function getEvents() {
        setIsLoading(true);
        const responseGetEvents = await API.graphql({
          query: queries.getEvents,
        });
        const events = responseGetEvents.data.getEvents;
        const eventsInNewFormat = events.filter((event) => event.raceConfig !== null); // TODO can be removed after testing
        console.info(eventsInNewFormat);
        setEvents([...eventsInNewFormat]);
        setIsLoading(false);
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
          console.log(event);
          setEvents([...events, event.value.data.onAddedEvent]);
        },
      });
    }
    return () => {
      if (onAddEventSubscription) {
        onAddEventSubscription.unsubscribe();
      }
    };
  }, [events, userHasAccess]);

  // subscribe to updated events and update local array
  useEffect(() => {
    let onUpdatedEventSubscription;
    if (userHasAccess) {
      onUpdatedEventSubscription = API.graphql(graphqlOperation(onUpdatedEvent)).subscribe({
        next: (event) => {
          console.log(event);
          const updatedEvent = event.value.data.onUpdatedEvent;

          setEvents((prevState) => {
            const indexOfUpdatedEvent = events.findIndex(
              (event) => event.eventId === updatedEvent.eventId
            );
            const modifiedEvents = [...prevState];
            modifiedEvents[indexOfUpdatedEvent] = updatedEvent;
            return modifiedEvents;
          });
          //update the selected event if it has been updated
          if (selectedEvent != null && updatedEvent.eventId === selectedEvent.eventId) {
            console.info('update the selected event');
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
  }, [events, userHasAccess]);

  // subscribe to delete data changes and delete them from local array
  useEffect(() => {
    let onDeletedEventsSubscription;
    if (userHasAccess) {
      onDeletedEventsSubscription = API.graphql(graphqlOperation(onDeletedEvents)).subscribe({
        next: (event) => {
          const eventIdsToDelete = event.value.data.onDeletedEvents.map(
            (event) => JSON.parse(event).eventId
          );

          setEvents((prevState) => {
            const indexes = [];
            eventIdsToDelete.map((eventId) => {
              const index = events.findIndex((event) => event.eventId === eventId);
              if (index > -1) {
                indexes.push(index);
              }
            });

            // To make sure events with highest index are deleted first
            indexes.sort().reverse();

            if (indexes) {
              const updatedState = [...prevState];
              indexes.map((index) => updatedState.splice(index, 1));
              return updatedState;
            }
            return prevState;
          });
        },
      });
    }
    return () => {
      if (onDeletedEventsSubscription) {
        onDeletedEventsSubscription.unsubscribe();
      }
    };
  }, [events, userHasAccess]);

  return [events, isLoading, errorMessage];
};
