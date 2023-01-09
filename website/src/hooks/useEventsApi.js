import { API, graphqlOperation } from 'aws-amplify';
import { useEffect, useState } from 'react';
import * as queries from '../graphql/queries';
// import * as mutations from '../graphql/mutations';
import { onAddedEvent, onDeletedEvents, onUpdatedEvent } from '../graphql/subscriptions';

export const useEventsApi = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [events, setEvents] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');

  // initial data load
  useEffect(() => {
    // Get Events
    async function getAllEvents() {
      setIsLoading(true);
      const response = await API.graphql({
        query: queries.getAllEvents,
      });
      // console.log('getAllEvents');
      // console.log(response.data.getAllEvents);
      setEvents([...response.data.getAllEvents]);
      setIsLoading(false);
    }
    getAllEvents();

    return () => {
      // Unmounting
    };
  }, []);

  // subscribe to data changes and append them to local array
  useEffect(() => {
    const subscription = API.graphql(graphqlOperation(onAddedEvent)).subscribe({
      next: (event) => {
        console.log(event);
        setEvents([...events, event.value.data.onAddedEvent]);
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [events]);

  // subscribe to updated events and update local array
  useEffect(() => {
    const subscription = API.graphql(graphqlOperation(onUpdatedEvent)).subscribe({
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
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [events]);

  // subscribe to delete data changes and delete them from local array
  useEffect(() => {
    const subscription = API.graphql(graphqlOperation(onDeletedEvents)).subscribe({
      next: (event) => {
        const eventIdsToDelete = event.value.data.onDeletedEvents.map((event) => event.eventId);

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

    return () => {
      subscription.unsubscribe();
    };
  }, [events]);

  return [events, isLoading, errorMessage];
};
