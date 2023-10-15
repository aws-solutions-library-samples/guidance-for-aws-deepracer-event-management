import { API, Auth, graphqlOperation } from 'aws-amplify';
import { useEffect, useState } from 'react';
import { getAllModels } from '../graphql/queries';
import { onAddedModel, onDeletedModel, onUpdatedModel } from '../graphql/subscriptions';
import { useStore } from '../store/store';

// CONSTANTS
const MODELS_GET_LIMIT = 200;

export const useModelsApi = (allowedToFetchAllModels = false) => {
  const [, dispatch] = useStore();
  const [subscriptionVariables, setSubscriptionVariables] = useState({});

  // If a user is not allowed to fetch all models the sub need to be provided to filter the subscription.
  useEffect(() => {
    if (allowedToFetchAllModels) {
      setSubscriptionVariables({});
    } else {
      const sub = Auth.user.attributes.sub;
      setSubscriptionVariables({ sub: sub });
    }
  }, [allowedToFetchAllModels]);

  // initial data load
  useEffect(() => {
    const getModelApiCall = async (nextToken = undefined) => {
      const response = await API.graphql(
        graphqlOperation(getAllModels, { limit: MODELS_GET_LIMIT, nextToken: nextToken })
      );
      const models = response.data.getAllModels.models;
      dispatch('ADD_MODELS', models);
      return response.data.getAllModels.nextToken;
    };

    const getModels = async () => {
      dispatch('MODELS_IS_LOADING', true);
      try {
        let nextToken = undefined;
        nextToken = await getModelApiCall(nextToken);

        dispatch('MODELS_IS_LOADING', false);

        while (nextToken) {
          nextToken = await getModelApiCall(nextToken);
        }
      } catch (error) {
        addErrorNotifications('getAllModels query', error.errors, dispatch);
      } finally {
        dispatch('MODELS_IS_LOADING', false);
      }
    };

    getModels();

    return () => {
      // Unmounting
    };
  }, [dispatch]);

  // subscribe to data changes and append them to local array
  useEffect(() => {
    const subscription = API.graphql(
      graphqlOperation(onAddedModel, subscriptionVariables)
    ).subscribe({
      next: (event) => {
        const addedModel = event.value.data.onAddedModel;
        dispatch('UPDATE_MODEL', addedModel);
      },
      error: (error) => {
        const errors = error.error.errors;
        addErrorNotifications('onAddedModel subscription', errors, dispatch);
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [subscriptionVariables, dispatch]);

  // subscribe to delete data changes and delete them from local array
  useEffect(() => {
    const subscription = API.graphql(
      graphqlOperation(onDeletedModel, subscriptionVariables)
    ).subscribe({
      next: (event) => {
        const deletedModel = event.value.data.onDeletedModel;
        dispatch('DELETE_MODELS', [deletedModel]);
      },
      error: (error) => {
        const errors = error.error.errors;
        addErrorNotifications('onDeletedModel subscription', errors, dispatch);
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [subscriptionVariables, dispatch]);

  useEffect(() => {
    const subscription = API.graphql(
      graphqlOperation(onUpdatedModel, subscriptionVariables)
    ).subscribe({
      next: (event) => {
        const updatedModel = event.value.data.onUpdatedModel;
        dispatch('UPDATE_MODEL', updatedModel);
      },
      error: (error) => {
        const errors = error.error.errors;
        addErrorNotifications('onUpdateModel subscription', errors, dispatch);
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [subscriptionVariables, dispatch]);
};

// adds an error notification for each API error
const addErrorNotifications = (apiMethodName, errors, dispatch) => {
  errors.forEach((element, index) => {
    const errorMessage = `${apiMethodName}: ${element.message}`;
    const notificationId = `${apiMethodName}Error${index}`;

    dispatch('ADD_NOTIFICATION', {
      header: errorMessage,
      type: 'error',
      dismissible: true,
      dismissLabel: 'Dismiss message',
      id: notificationId,
      onDismiss: () => {
        dispatch('DISMISS_NOTIFICATION', notificationId);
      },
    });
  });
};
