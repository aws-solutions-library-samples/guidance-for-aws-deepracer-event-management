import { API, graphqlOperation } from 'aws-amplify';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listCars } from '../graphql/queries';
import { onUpdatedCarsStatus } from '../graphql/subscriptions';
import { useStore } from '../store/store';

export const useCarsApi = (userHasAccess = false) => {
  const { t } = useTranslation();
  const [state, dispatch] = useStore();
  const [reload, setReload] = useState(false);

  useEffect(() => {
    if (state.cars.refresh) {
      setReload((prev) => !prev);
    }
  }, [state.cars.refresh]);

  // adds an error notification for each API error
  const addErrorNotifications = useCallback(
    (apiMethodName, errors, dispatch) => {
      errors.forEach((element, index) => {
        const errorMessage = `${apiMethodName}: ${element.message}`;
        const notificationId = `${apiMethodName}Error${index}`;

        dispatch('ADD_NOTIFICATION', {
          header: errorMessage,
          type: 'error',
          dismissible: true,
          dismissLabel: t('devices.notifications.dismiss-message'),
          id: notificationId,
          onDismiss: () => {
            dispatch('DISMISS_NOTIFICATION', notificationId);
          },
        });
      });
    },
    [t]
  );

  // initial data load
  useEffect(() => {
    try {
      if (userHasAccess) {
        async function getCars(online) {
          const response = await API.graphql(graphqlOperation(listCars, { online: online }));
          dispatch('ADD_CARS', response.data.listCars);
        }
        dispatch('CARS_IS_LOADING', true);
        getCars(true);
        getCars(false);
        dispatch('CARS_IS_LOADING', false);
      }
    } catch (error) {
      addErrorNotifications('listCars query', error.errors, dispatch);
    } finally {
      dispatch('CARS_IS_LOADING', false);
    }
    return () => {
      // Unmounting
    };
  }, [userHasAccess, dispatch, reload, addErrorNotifications]);

  // subscribe to data changes and append them to local array
  useEffect(() => {
    const subscription = API.graphql(graphqlOperation(onUpdatedCarsStatus)).subscribe({
      next: (event) => {
        const updatedCars = event.value.data.onUpdatedCarsStatus;
        dispatch('ADD_CARS', updatedCars);
      },
      error: (error) => {
        const errors = error.error.errors;
        addErrorNotifications('onUpdatedCarsStatus subscription', errors, dispatch);
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [dispatch, addErrorNotifications]);

  return {};
};
