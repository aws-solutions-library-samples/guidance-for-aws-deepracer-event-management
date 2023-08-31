import { API, graphqlOperation } from 'aws-amplify';
import { useEffect } from 'react';
import * as queries from '../graphql/queries';
import { onAddedFleet, onDeletedFleets, onUpdatedFleet } from '../graphql/subscriptions';
import { useStore } from '../store/store';

export function useFleetsApi(userHasAccess = false) {
  const [, dispatch] = useStore();

  // initial data load
  useEffect(() => {
    if (userHasAccess) {
      // Get Fleets
      console.debug('GET FLEETS');
      async function getAllFleets() {
        dispatch('FLEETS_IS_LOADING', true);
        const response = await API.graphql({
          query: queries.getAllFleets,
        });

        const fleets = response.data.getAllFleets.map((fleet) => {
          const updatedCarIds = fleet.carIds ? fleet.carIds : [];
          return { ...fleet, carIds: updatedCarIds };
        });
        dispatch('ADD_FLEETS', fleets);
        dispatch('FLEETS_IS_LOADING', false);
      }
      getAllFleets();
    }
    return () => {
      // Unmounting
    };
  }, [userHasAccess]);

  // subscribe to data changes and append them to local array
  useEffect(() => {
    let subscription;
    if (userHasAccess) {
      subscription = API.graphql(graphqlOperation(onAddedFleet)).subscribe({
        next: (fleet) => {
          dispatch('UPDATE_FLEET', fleet.value.data.onAddedFleet);
        },
        error: (error) => console.warn(error),
      });
    }
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [userHasAccess]);

  // subscribe to updated fleets and update local array
  useEffect(() => {
    let subscription;
    if (userHasAccess) {
      subscription = API.graphql(graphqlOperation(onUpdatedFleet)).subscribe({
        next: (fleet) => {
          const updatedFleet = fleet.value.data.onUpdatedFleet;
          dispatch('UPDATE_FLEET', updatedFleet);
          // setFleets((prevState) => {
          //   const indexOfUpdatedFleet = fleets.findIndex(
          //     (fleet) => fleet.fleetId === updatedFleet.fleetId
          //   );
          //   const modifiedFleets = [...prevState];
          //   modifiedFleets[indexOfUpdatedFleet] = updatedFleet;
          //   return modifiedFleets;
          // });
        },
        error: (error) => console.warn(error),
      });
    }
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [userHasAccess]);

  // subscribe to delete data changes and delete them from local array
  useEffect(() => {
    let subscription;
    if (userHasAccess) {
      const subscribe = () => {
        return API.graphql(graphqlOperation(onDeletedFleets)).subscribe({
          next: (fleet) => {
            console.debug('DELETED FLEET: start: ' + JSON.stringify(fleet.value.data));
            const fleetIdsToDelete = fleet.value.data.onDeletedFleets.map((fleet) => fleet.fleetId);
            dispatch('DELETE_FLEETS', fleetIdsToDelete);
          },
          error: (error) => {
            console.warn(error);
          },
        });
      };
      subscription = subscribe();
    }

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [userHasAccess]);
}
