import { API, Auth, graphqlOperation } from 'aws-amplify';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getAllCarLogsAssets } from '../graphql/queries';
import { onAddedCarLogsAsset, onDeletedCarLogsAsset } from '../graphql/subscriptions';
import { useStore } from '../store/store';

// CONSTANTS
const ASSETS_GET_LIMIT = 200;

export const useCarLogsApi = (allowedToFetchAllAssets = false) => {
  const { t } = useTranslation();
  const [, dispatch] = useStore();
  const [subscriptionVariables, setSubscriptionVariables] = useState({});

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
          dismissLabel: t('carlogs.assets.notifications.dismiss-message'),
          id: notificationId,
          onDismiss: () => {
            dispatch('DISMISS_NOTIFICATION', notificationId);
          },
        });
      });
    },
    [t]
  );

  // If a user is not allowed to fetch all assets the sub need to be provided to filter the subscription.
  useEffect(() => {
    if (allowedToFetchAllAssets) {
      setSubscriptionVariables({});
    } else {
      const sub = Auth.user.attributes.sub;
      setSubscriptionVariables({ sub: sub });
    }
  }, [allowedToFetchAllAssets, addErrorNotifications]);

  // initial data load
  useEffect(() => {
    const getAssetApiCall = async (nextToken = undefined) => {
      const response = await API.graphql(
        graphqlOperation(getAllCarLogsAssets, { limit: ASSETS_GET_LIMIT, nextToken: nextToken })
      );
      const assets = response.data.getAllCarLogsAssets.assets;
      dispatch('ADD_ASSETS', assets);
      return response.data.getAllCarLogsAssets.nextToken;
    };

    const getAssets = async () => {
      dispatch('ASSETS_IS_LOADING', true);
      try {
        let nextToken = undefined;
        nextToken = await getAssetApiCall(nextToken);

        dispatch('ASSETS_IS_LOADING', false);

        while (nextToken) {
          nextToken = await getAssetApiCall(nextToken);
        }
      } catch (error) {
        addErrorNotifications('getAllCarLogsAssets query', error.errors, dispatch);
      } finally {
        dispatch('ASSETS_IS_LOADING', false);
      }
    };

    getAssets();

    return () => {
      // Unmounting
    };
  }, [dispatch, addErrorNotifications]);

  // subscribe to data changes and append them to local array
  useEffect(() => {
    const subscription = API.graphql(
      graphqlOperation(onAddedCarLogsAsset, subscriptionVariables)
    ).subscribe({
      next: (event) => {
        const addedAsset = event.value.data.onAddedCarLogsAsset;
        dispatch('UPDATE_ASSET', addedAsset);
      },
      error: (error) => {
        const errors = error.error.errors;
        addErrorNotifications('onAddedCarLogsAsset subscription', errors, dispatch);
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [subscriptionVariables, dispatch, addErrorNotifications]);

  // subscribe to delete data changes and delete them from local array
  useEffect(() => {
    const subscription = API.graphql(
      graphqlOperation(onDeletedCarLogsAsset, subscriptionVariables)
    ).subscribe({
      next: (event) => {
        const deletedAsset = event.value.data.onDeletedCarLogsAsset;
        dispatch('DELETE_ASSET', [deletedAsset]);
      },
      error: (error) => {
        const errors = error.error.errors;
        addErrorNotifications('onDeletedCarLogsAsset subscription', errors, dispatch);
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [subscriptionVariables, dispatch, addErrorNotifications]);
};
