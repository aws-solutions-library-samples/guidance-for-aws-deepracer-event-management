import { API } from 'aws-amplify';
import { useEffect } from 'react';
import * as queries from '../graphql/queries';
import { useStore } from '../store/store';

export const useCarsApi = (userHasAccess = false) => {
  const [, dispatch] = useStore();
  // initial data load
  useEffect(() => {
    if (userHasAccess) {
      async function getCars(online) {
        dispatch('CARS_IS_LOADING', true);
        const response = await API.graphql({
          query: queries.carsOnline,
          variables: { online: online },
        });
        dispatch('ADD_CARS', response.data.carsOnline);

        dispatch('CARS_IS_LOADING', false);
      }
      getCars(true);
      getCars(false);
    }
    return () => {
      // Unmounting
    };
  }, [userHasAccess]);
};
