import { API } from 'aws-amplify';
import { useEffect, useState } from 'react';
import * as queries from '../graphql/queries';

export const useCarsApi = (userHasAccess = false) => {
  const [isLoading, setIsLoading] = useState(false);
  const [cars, setCars] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');

  // initial data load
  useEffect(() => {
    if (userHasAccess) {
      async function getCars(online) {
        setIsLoading(true);
        const response = await API.graphql({
          query: queries.carsOnline,
          variables: { online: online },
        });
        setCars((prevState) => {
          const updatedCars = [...prevState];
          const carsFetched = response.data.carsOnline;

          // Deduplicate cars before updaing state
          const duplicatedCarsToDelete = carsFetched.map((newCar) => {
            const index = updatedCars.findIndex(
              (existingCar) => existingCar.InstanceId === newCar.InstanceId
            );
            if (index > -1) {
              return index;
            }
          });
          duplicatedCarsToDelete.sort().reverse();
          duplicatedCarsToDelete.map((index) => updatedCars.splice(index, 1));
          return [...updatedCars, ...carsFetched];
        });

        setIsLoading(false);
      }
      getCars(true);
      getCars(false);
      // TODO currently get duplicated items in dev mode
    }
    return () => {
      // Unmounting
    };
  }, [userHasAccess]);

  // // subscribe to data changes and append them to local array
  // useEffect(() => {
  //   const subscription = API.graphql(graphqlOperation(onAddedEvent)).subscribe({
  //     next: (event) => {
  //       console.log(event);
  //       setEvents([...events, event.value.data.onAddedEvent]);
  //     },
  //   });

  //   return () => {
  //     subscription.unsubscribe();
  //   };
  // }, [cars]);

  // // subscribe to updated events and update local array
  // useEffect(() => {
  //   const subscription = API.graphql(graphqlOperation(onUpdatedEvent)).subscribe({
  //     next: (event) => {
  //       console.log(event);
  //       const updatedEvent = event.value.data.onUpdatedEvent;

  //       setEvents((prevState) => {
  //         const indexOfUpdatedEvent = events.findIndex(
  //           (event) => event.eventId === updatedEvent.eventId
  //         );
  //         const modifiedEvents = [...prevState];
  //         modifiedEvents[indexOfUpdatedEvent] = updatedEvent;
  //         return modifiedEvents;
  //       });
  //     },
  //   });

  //   return () => {
  //     subscription.unsubscribe();
  //   };
  // }, [events]);

  // // subscribe to delete data changes and delete them from local array
  // useEffect(() => {
  //   const subscription = API.graphql(graphqlOperation(onDeletedEvents)).subscribe({
  //     next: (event) => {
  //       const eventIdsToDelete = event.value.data.onDeletedEvents.map((event) => event.eventId);

  //       setEvents((prevState) => {
  //         const indexes = [];
  //         eventIdsToDelete.map((eventId) => {
  //           const index = events.findIndex((event) => event.eventId === eventId);
  //           if (index > -1) {
  //             indexes.push(index);
  //           }
  //         });

  //         // To make sure events with highest index are deleted first
  //         indexes.sort().reverse();

  //         if (indexes) {
  //           const updatedState = [...prevState];
  //           indexes.map((index) => updatedState.splice(index, 1));
  //           return updatedState;
  //         }
  //         return prevState;
  //       });
  //     },
  //   });

  //   return () => {
  //     subscription.unsubscribe();
  //   };
  // }, [events]);

  return [cars, isLoading, errorMessage];
};
