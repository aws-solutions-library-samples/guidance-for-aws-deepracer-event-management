import { API, graphqlOperation } from 'aws-amplify';
import { useCallback, useEffect, useState } from 'react';
import { deleteRaces } from '../graphql/mutations';
import { getRaces } from '../graphql/queries';
import { onAddedRace, onDeletedRaces } from '../graphql/subscriptions';
import { useUsersContext } from '../store/storeProvider';
// import * as mutations from '../graphql/mutations';
import { convertMsToString } from '../support-functions/time';

export const useRacesApi = (eventId) => {
  const [users, usersIsLoading] = useUsersContext();
  const [isLoading, setIsLoading] = useState(true);
  const [races, setRaces] = useState([]);
  //const [errorMessage, setErrorMessage] = useState('');

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

  const addTimeHr = useCallback((race) => {
    race.laps = race.laps.map((lap) => {
      lap['timeHr'] = convertMsToString(lap.time);
      return lap;
    });
    return race;
  }, []);

  const fixLapIDs = useCallback((race) => {
    race.laps = race.laps.map((lap) => {
      lap['lapId'] = ('0' + (parseInt(lap['lapId']) + 1)).slice(-2);
      return lap;
    });
    return race;
  }, []);

  const addUserName = useCallback(
    (race) => {
      const user = users.find((user) => user.sub === race.userId);
      console.debug(user);
      if (user) {
        race['username'] = user.Username;
      } else {
        race['username'] = 'Username not found'; //TODO add to localisation
      }
      return race;
    },
    [users]
  );

  // initial data load, need to wait for users to be loaded before getting the races
  // TODO fetching races and users can be done in parallell and then merged when both of them exist
  useEffect(() => {
    if (!eventId) {
      // used to display a message that an event need to be selected
      setIsLoading(false);
    } else if (eventId && usersIsLoading) {
      // used to display the loading resources after an event has been selected
      setIsLoading(true);
    } else if (!usersIsLoading) {
      console.debug(eventId);
      async function queryApi() {
        const response = await API.graphql(graphqlOperation(getRaces, { eventId: eventId }));
        console.debug('getRaces');
        const races = response.data.getRaces;
        races.map((race) => addUserName(race));
        races.map((race) => addTimeHr(race));
        races.map((race) => fixLapIDs(race));
        setRaces(races);
        setIsLoading(false);
      }
      queryApi();
    }

    return () => {
      // Unmounting
    };
  }, [eventId, addUserName, addTimeHr, usersIsLoading]);

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
          const raceWithUsername = addUserName(addedRace);
          const raceWithTimeHr = addTimeHr(addedRace);
          console.log(raceWithUsername);
          setRaces((prevState) => [...prevState, raceWithUsername, raceWithTimeHr]);
        },
      });
    }

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [eventId, addUserName, addTimeHr]);

  const sendDelete = async (variables) => {
    try {
      setIsLoading(true);
      console.debug(variables);
      API.graphql(graphqlOperation(deleteRaces));
      const response = await API.graphql(graphqlOperation(deleteRaces, variables));
      console.log(response);
      setIsLoading(false);
    } catch (error) {
      console.debug(error);
      setIsLoading(false);
    }
  };

  return [races, isLoading, sendDelete]; //, errorMessage];
};
