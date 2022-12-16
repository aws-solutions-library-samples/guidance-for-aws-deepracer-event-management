import { API, graphqlOperation } from 'aws-amplify';
import { useEffect, useState } from 'react';
import * as queries from '../graphql/queries';
//import * as mutations from '../graphql/mutations';
import * as subscriptions from '../graphql/subscriptions';

export function ListOfEvents(setIsLoading) {
  const [events, setEvents] = useState([]);

  // initial data load
  useEffect(() => {
    // Get Events
    async function getAllEvents() {
      const response = await API.graphql({
        query: queries.getAllEvents,
      });
      //console.log('getAllEvents');
      //console.log(response.data.getAllEvents);
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
    const subscription = API.graphql(graphqlOperation(subscriptions.addedEvent)).subscribe({
      next: (event) => {
        //console.log(event);
        setEvents([...events, event.value.data.addedEvent]);
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [events]);

  // subscribe to delete data changes and delete them from local array
  useEffect(() => {
    const subscription = API.graphql(graphqlOperation(subscriptions.deletedEvent)).subscribe({
      next: (event) => {
        //console.log(event.value.data.deletedEvent.eventId);
        const index = events.map((e) => e.eventId).indexOf(event.value.data.deletedEvent.eventId);
        //console.log(index);
        var tempEvents = [...events];
        if (index !== -1) {
          tempEvents.splice(index, 1);
          setEvents(tempEvents);
        }
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [events]);

  return events;
}
