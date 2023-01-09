import { API, graphqlOperation } from 'aws-amplify';
import { useEffect, useState } from 'react';
import * as queries from '../graphql/queries';
import { onAddedFleet, onDeletedFleets, onUpdatedFleet } from '../graphql/subscriptions';

export function useFleetsApi() {
  const [fleets, setFleets] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // initial data load
  useEffect(() => {
    // Get Fleets
    async function getAllFleets() {
      setIsLoading(true);
      const response = await API.graphql({
        query: queries.getAllFleets,
      });
      // console.log('getAllFleets');
      // console.log(response.data.getAllFleets);
      const fleets = response.data.getAllFleets.map((fleet) => {
        const updatedCarIds = fleet.carIds ? fleet.carIds : [];
        return { ...fleet, carIds: updatedCarIds };
      });
      setFleets(fleets);
      setIsLoading(false);
    }
    getAllFleets();

    return () => {
      // Unmounting
    };
  }, []);

  // subscribe to data changes and append them to local array
  useEffect(() => {
    const subscription = API.graphql(graphqlOperation(onAddedFleet)).subscribe({
      next: (fleet) => {
        // console.log(fleet);
        setFleets([...fleets, fleet.value.data.onAddedFleet]);
      },
      error: (error) => console.warn(error),
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fleets]);

  // subscribe to updated fleets and update local array
  useEffect(() => {
    const subscription = API.graphql(graphqlOperation(onUpdatedFleet)).subscribe({
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

    return () => {
      subscription.unsubscribe();
    };
  }, [fleets]);

  // subscribe to delete data changes and delete them from local array
  useEffect(() => {
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
          subscribe();
        },
      });
    };
    const subscription = subscribe();
    // const subscription = API.graphql(graphqlOperation(subscriptions.onDeletedFleets)).subscribe({
    //   next: (fleet) => {
    //     const fleetIdsToDelete = fleet.value.data.deletedFleets.map((fleet) => fleet.fleetId);

    //     setFleets((prevState) => {
    //       const indexes = [];
    //       fleetIdsToDelete.map((fleetId) => {
    //         const index = fleets.findIndex((fleet) => fleet.fleetId === fleetId);
    //         if (index > -1) {
    //           indexes.push(index);
    //         }
    //       });

    //       // To make sure fleets with highest index are deleted first
    //       indexes.sort().reverse();

    //       if (indexes) {
    //         const updatedState = [...prevState];
    //         indexes.map((index) => updatedState.splice(index, 1));
    //         return updatedState;
    //       }
    //       return prevState;
    //     });
    //   },
    //   error: (error) => console.warn(error),
    // });

    return () => {
      subscription.unsubscribe();
    };
  }, [fleets]);

  return [fleets, isLoading];
}
