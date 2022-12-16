import { API, graphqlOperation } from 'aws-amplify';
import { useEffect, useState } from 'react';
import * as queries from '../graphql/queries';
//import * as mutations from '../graphql/mutations';
import * as subscriptions from '../graphql/subscriptions';

export function ListOfFleets(setIsLoading) {
  const [fleets, setFleets] = useState([]);

  // initial data load
  useEffect(() => {
    // Get Fleets
    async function getAllFleets() {
      const response = await API.graphql({
        query: queries.getAllFleets,
      });
      //console.log('getAllFleets');
      //console.log(response.data.getAllFleets);
      setFleets([...response.data.getAllFleets]);
      setIsLoading(false);
    }
    getAllFleets();

    return () => {
      // Unmounting
    };
  }, []);

  // subscribe to data changes and append them to local array
  useEffect(() => {
    const subscription = API.graphql(graphqlOperation(subscriptions.addedFleet)).subscribe({
      next: (fleet) => {
        //console.log(fleet);
        setFleets([...fleets, fleet.value.data.addedFleet]);
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fleets]);

  // subscribe to delete data changes and delete them from local array
  useEffect(() => {
    const subscription = API.graphql(graphqlOperation(subscriptions.deletedFleet)).subscribe({
      next: (fleet) => {
        //console.log(fleet.value.data.deletedFleet.fleetId);
        const index = fleets.map((e) => e.fleetId).indexOf(fleet.value.data.deletedFleet.fleetId);
        //console.log(index);
        var tempFleets = [...fleets];
        if (index !== -1) {
          tempFleets.splice(index, 1);
          setFleets(tempFleets);
        }
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fleets]);

  return fleets;
}
