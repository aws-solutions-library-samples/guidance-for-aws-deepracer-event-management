import { API, graphqlOperation } from 'aws-amplify';
import { useEffect } from 'react';
import { getRaces } from '../graphql/queries';
import { onAddedRace, onDeletedRaces, onUpdatedRace } from '../graphql/subscriptions';
import { useStore } from '../store/store';

export const useRacesApi = (userHasAccess, eventId) => {
  const [, dispatch] = useStore();
  useEffect(() => {
    if (!eventId) {
      // used to display a message that an event need to be selected
      dispatch('RACES_IS_LOADING', false);
    } else if (eventId && userHasAccess) {
      console.debug(eventId);
      async function queryApi() {
        const response = await API.graphql(graphqlOperation(getRaces, { eventId: eventId }));
        console.debug('getRaces');
        const races = response.data.getRaces;

        dispatch('NEW_RACES', races);
        dispatch('RACES_IS_LOADING', false);
      }
      queryApi();
    }

    return () => {
      // Unmounting
    };
  }, [dispatch, eventId, userHasAccess]);

  // subscribe to data changes and append them to local array
  useEffect(() => {
    let subscription;
    if (eventId && userHasAccess) {
      subscription = API.graphql(graphqlOperation(onDeletedRaces, { eventId: eventId })).subscribe({
        next: (event) => {
          const deletedRaces = event.value.data.onDeletedRaces;
          dispatch('DELETE_RACES', deletedRaces.raceIds);
        },
        error: (error) => {
          console.debug(error);
        },
      });
    }

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [dispatch, eventId, userHasAccess]);

  // subscribe to data changes and append them to local array
  useEffect(() => {
    let subscription;
    if (eventId && userHasAccess) {
      subscription = API.graphql(graphqlOperation(onAddedRace, { eventId: eventId })).subscribe({
        next: (event) => {
          const addedRace = event.value.data.onAddedRace;
          // Add in the username
          addedRace['username'] = addedRace['userId'];
          dispatch('ADD_RACES', [addedRace]);
        },
      });
    }

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [dispatch, eventId, userHasAccess]);

  useEffect(() => {
    let subscription;
    console.debug('ON UPDATE RACE SUBSCRIPTION SETUP', eventId, userHasAccess);
    if (eventId && userHasAccess) {
      subscription = API.graphql(graphqlOperation(onUpdatedRace, { eventId: eventId })).subscribe({
        next: (event) => {
          console.debug('RACE UPDATE RECEIVED', event.value.data.onUpdatedRace);
          const updatedRace = event.value.data.onUpdatedRace;
          // Add in the username
          updatedRace['username'] = updatedRace['userId'];
          dispatch('UPDATE_RACE', updatedRace);
        },
      });
    }

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [dispatch, eventId, userHasAccess]);
};
