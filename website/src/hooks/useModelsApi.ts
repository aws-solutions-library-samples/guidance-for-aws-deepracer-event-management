import { useEffect, useState } from 'react';
import { graphqlQuery, graphqlSubscribe } from '../graphql/graphqlHelpers';
import { getAllModels } from '../graphql/queries';
import { onAddedModel, onDeletedModel, onUpdatedModel } from '../graphql/subscriptions';
import { Dispatch, useStore } from '../store/store';
import { Model } from '../types/domain';
import { getCurrentAuthUser } from './useAuth';

// CONSTANTS
const MODELS_GET_LIMIT = 200;

interface SubscriptionVariables {
    sub?: string;
}

interface GraphQLError {
    message: string;
}

interface GetAllModelsData {
    getAllModels: {
        models: Model[];
        nextToken: string | null;
    };
}

export const useModelsApi = (allowedToFetchAllModels: boolean = false): void => {
    const [, dispatch] = useStore();
    const [subscriptionVariables, setSubscriptionVariables] = useState<SubscriptionVariables>({});

    // If a user is not allowed to fetch all models the sub need to be provided to filter the subscription.
    useEffect(() => {
        async function getSubscriptionVariables(): Promise<void> {
            if (allowedToFetchAllModels) {
                setSubscriptionVariables({});
            } else {
                const authUser = await getCurrentAuthUser();
                const sub = authUser.sub;
                setSubscriptionVariables({ sub: sub });
            }
        }
        getSubscriptionVariables();
    }, [allowedToFetchAllModels]);

    // initial data load
    useEffect(() => {
        const getModelApiCall = async (nextToken: string | null = null): Promise<string | null> => {
            const response = await graphqlQuery<GetAllModelsData>(getAllModels, {
                limit: MODELS_GET_LIMIT,
                nextToken: nextToken,
            });
            const models = response.getAllModels.models;
            dispatch('ADD_MODELS', models);
            return response.getAllModels.nextToken;
        };

        const getModels = async (): Promise<void> => {
            dispatch('MODELS_IS_LOADING', true);
            try {
                let nextToken: string | null = null;
                nextToken = await getModelApiCall(nextToken);

                dispatch('MODELS_IS_LOADING', false);

                while (nextToken) {
                    nextToken = await getModelApiCall(nextToken);
                }
            } catch (error: any) {
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
        const subscription = graphqlSubscribe<{ onAddedModel: Model }>(
            onAddedModel,
            subscriptionVariables
        ).subscribe({
            next: (event) => {
                const addedModel: Model = event.value.data.onAddedModel;
                dispatch('UPDATE_MODEL', addedModel);
            },
            error: (error: any) => {
                const errors: GraphQLError[] = error.error.errors;
                addErrorNotifications('onAddedModel subscription', errors, dispatch);
            },
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [subscriptionVariables, dispatch]);

    // subscribe to delete data changes and delete them from local array
    useEffect(() => {
        const subscription = graphqlSubscribe<{ onDeletedModel: Model }>(
            onDeletedModel,
            subscriptionVariables
        ).subscribe({
            next: (event) => {
                const deletedModel: Model = event.value.data.onDeletedModel;
                dispatch('DELETE_MODELS', [deletedModel]);
            },
            error: (error: any) => {
                const errors: GraphQLError[] = error.error.errors;
                addErrorNotifications('onDeletedModel subscription', errors, dispatch);
            },
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [subscriptionVariables, dispatch]);

    useEffect(() => {
        const subscription = graphqlSubscribe<{ onUpdatedModel: Model }>(
            onUpdatedModel,
            subscriptionVariables
        ).subscribe({
            next: (event) => {
                const updatedModel: Model = event.value.data.onUpdatedModel;
                dispatch('UPDATE_MODEL', updatedModel);
            },
            error: (error: any) => {
                const errors: GraphQLError[] = error.error.errors;
                addErrorNotifications('onUpdateModel subscription', errors, dispatch);
            },
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [subscriptionVariables, dispatch]);
};

// adds an error notification for each API error
const addErrorNotifications = (
    apiMethodName: string,
    errors: GraphQLError[],
    dispatch: Dispatch
): void => {
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
