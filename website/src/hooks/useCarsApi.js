import { API } from 'aws-amplify';
import { useEffect, useState } from 'react';
import * as queries from '../graphql/queries';
import { useStore } from '../store/store';

export const useCarsApi = (userHasAccess = false) => {
  const [, dispatch] = useStore();
  const [reload, setReload] = useState(false);

  const triggerReload = () => {
    setReload((prev) => !prev);
  };

  // initial data load
  useEffect(() => {
    if (userHasAccess) {
      async function getCars(online) {
        const response = await API.graphql({
          query: queries.listCars,
          variables: { online: online },
        });
        dispatch('ADD_CARS', response.data.listCars);
      }
      dispatch('CARS_IS_LOADING', true);
      getCars(true);
      getCars(false);
      dispatch('CARS_IS_LOADING', false);
    }
    return () => {
      // Unmounting
    };
  }, [userHasAccess, dispatch, reload]);

  return {
    triggerReload,
  };
};
