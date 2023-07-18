import { API, graphqlOperation } from 'aws-amplify';
import { useEffect, useState } from 'react';
import { deleteRaces } from '../graphql/mutations';
import { getRaces } from '../graphql/queries';
import { onAddedRace, onDeletedRaces } from '../graphql/subscriptions';
import { usePermissionsContext } from '../store/permissions/permissionsProvider';
import { useUsersApi } from './useUsersApi';

export const useRacesApi = (eventId) => {
  const permissions = usePermissionsContext();
  const [isLoading, setIsLoading] = useState(true);
  const [races, setRaces] = useState([]);
  const [users] = useUsersApi(permissions.api.users);

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

  const getUserNameFromId = (userId) => {
    if (userId == null) return;
    const user = users.find((user) => user.sub === userId);
    if (user == null) return userId;

    return user.Username;
  };

  // initial data load, need to wait for users to be loaded before getting the races
  // TODO fetching races and users can be done in parallel and then merged when both of them exist
  //      suspect this can be improved with a re-write - DS
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

        // Add in the username
        const racesData = races.map((r) => ({
          ...r,
          username: getUserNameFromId(r.userId),
        }));

        setRaces(racesData);
        setIsLoading(false);
      }
      queryApi();
    }

    return () => {
      // Unmounting
    };
  }, [eventId, users]);

  // subscribe to data changes and append them to local array
  useEffect(() => {
    let subscription = undefined;
    if (eventId) {
      subscription = API.graphql(graphqlOperation(onDeletedRaces, { eventId: eventId })).subscribe({
        next: (event) => {
          const deletedRaces = event.value.data.onDeletedRaces;
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
          const addedRace = event.value.data.onAddedRace;

          // Add in the username
          addedRace['username'] = getUserNameFromId(addedRace['userId']);

          setRaces((prevState) => [...prevState, addedRace]);
        },
      });
    }

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [eventId, users]);

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
