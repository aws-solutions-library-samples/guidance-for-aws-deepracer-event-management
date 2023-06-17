import { API, graphqlOperation } from 'aws-amplify';
import { useEffect, useState } from 'react';
import { deleteRaces } from '../graphql/mutations';
import { getRaces } from '../graphql/queries';
import { onAddedRace, onDeletedRaces } from '../graphql/subscriptions';

export const useRacesApi = (eventId) => {
  const [isLoading, setIsLoading] = useState(true);
  const [races, setRaces] = useState([]);

  const removeRace = (raceId) => {
    setRaces((prevState) => {
      const index = prevState.findIndex((race) => race.raceId === raceId);
      console.log(index);
      if (index >= 0) {
        const updatedRaces = [...prevState];
        updatedRaces.splice(index, 1);
        return updatedRaces;
      }
      return [...prevState];
    });
  };

  // initial data load, need to wait for users to be loaded before getting the races
  // TODO fetching races and users can be done in parallell and then merged when both of them exist
  useEffect(() => {
    if (!eventId) {
      // used to display a message that an event need to be selected
      setIsLoading(false);
    } else {
      console.debug(eventId);
      async function queryApi() {
        const response = await API.graphql(graphqlOperation(getRaces, { eventId: eventId }));
        console.debug('getRaces');
        const races = response.data.getRaces;
        setRaces(races);
        setIsLoading(false);
      }
      queryApi();
    }

    return () => {
      // Unmounting
    };
  }, [eventId]);

  // subscribe to data changes and append them to local array
  useEffect(() => {
    let subscription = undefined;
    if (eventId) {
      subscription = API.graphql(graphqlOperation(onDeletedRaces, { eventId: eventId })).subscribe({
        next: (event) => {
          console.log('onDeletedRaces');
          const deletedRaces = event.value.data.onDeletedRaces;
          console.log(deletedRaces);
          deletedRaces.raceIds.map((raceId) => removeRace(raceId));
        },
        error: (error) => {
          console.warn(error);
        },
      });
    }

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [eventId]);

  // subscribe to data changes and append them to local array
  useEffect(() => {
    let subscription = undefined;
    if (eventId) {
      subscription = API.graphql(graphqlOperation(onAddedRace, { eventId: eventId })).subscribe({
        next: (event) => {
          console.log('onAddedRace');
          const addedRace = event.value.data.onAddedRace;
          setRaces((prevState) => [...prevState, addedRace]);
        },
      });
    }

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [eventId]);

  const sendDelete = async (variables) => {
    setIsLoading(true);
    console.debug(variables);
    API.graphql(graphqlOperation(deleteRaces, variables))
      .catch((error) => {
        console.info(error);
      })
      .finally(setIsLoading(false));
  };

  return [races, isLoading, sendDelete];
};
