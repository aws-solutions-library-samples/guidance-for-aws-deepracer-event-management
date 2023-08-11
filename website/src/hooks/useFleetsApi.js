import { API, graphqlOperation } from 'aws-amplify';
import { useEffect, useState } from 'react';
import * as queries from '../graphql/queries';
import { onAddedFleet, onDeletedFleets, onUpdatedFleet } from '../graphql/subscriptions';

export function useFleetsApi(userHasAccess = false) {
  const [fleets, setFleets] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // initial data load
  useEffect(() => {
    if (userHasAccess) {
      // Get Fleets
      console.info('GET FLEETS');
      async function getAllFleets() {
        setIsLoading(true);
        const response = await API.graphql({
          query: queries.getAllFleets,
        });

        const fleets = response.data.getAllFleets.map((fleet) => {
          const updatedCarIds = fleet.carIds ? fleet.carIds : [];
          return { ...fleet, carIds: updatedCarIds };
        });
        setFleets(fleets);
        setIsLoading(false);
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
          // console.debug(fleet);
          setFleets([...fleets, fleet.value.data.onAddedFleet]);
        },
        error: (error) => console.warn(error),
      });
    }
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [fleets, userHasAccess]);

  // subscribe to updated fleets and update local array
  useEffect(() => {
    let subscription;
    if (userHasAccess) {
      subscription = API.graphql(graphqlOperation(onUpdatedFleet)).subscribe({
        next: (fleet) => {
          const updatedFleet = fleet.value.data.onUpdatedFleet;

          setFleets((prevState) => {
            const indexOfUpdatedFleet = fleets.findIndex(
              (fleet) => fleet.fleetId === updatedFleet.fleetId
            );
            const modifiedFleets = [...prevState];
            modifiedFleets[indexOfUpdatedFleet] = updatedFleet;
            return modifiedFleets;
          });
        },
        error: (error) => console.warn(error),
      });
    }
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [fleets, userHasAccess]);

  // subscribe to delete data changes and delete them from local array
  useEffect(() => {
    let subscription;
    if (userHasAccess) {
      const subscribe = () => {
        return API.graphql(graphqlOperation(onDeletedFleets)).subscribe({
          next: (fleet) => {
            console.info('DELETED FLEET: start: ' + JSON.stringify(fleet.value.data));
            const fleetIdsToDelete = fleet.value.data.onDeletedFleets.map((fleet) => fleet.fleetId);

            setFleets((prevState) => {
              const indexes = [];
              fleetIdsToDelete.map((fleetId) => {
                const index = fleets.findIndex((fleet) => fleet.fleetId === fleetId);
                if (index > -1) {
                  indexes.push(index);
                }
              });

              // To make sure fleets with highest index are deleted first
              indexes.sort().reverse();

              if (indexes) {
                const updatedState = [...prevState];
                indexes.map((index) => updatedState.splice(index, 1));
                console.info('DELETED FLEET: ' + JSON.stringify(indexes));
                return updatedState;
              }
              return prevState;
            });
          },
          error: (error) => {
            console.warn(error);
            // subscribe();
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
  }, [fleets, userHasAccess]);

  return [fleets, isLoading];
}
