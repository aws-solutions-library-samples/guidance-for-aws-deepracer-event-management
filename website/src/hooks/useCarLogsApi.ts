import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { graphqlQuery, graphqlSubscribe } from '../graphql/graphqlHelpers';
import { getAllCarLogsAssets } from '../graphql/queries';
import { onAddedCarLogsAsset, onDeletedCarLogsAsset } from '../graphql/subscriptions';
import { Dispatch, useStore } from '../store/store';
import { CarLogAsset } from '../types/domain';
import { getCurrentAuthUser } from './useAuth';

// CONSTANTS
const ASSETS_GET_LIMIT = 200;

interface SubscriptionVariables {
    sub?: string;
}

interface GraphQLError {
    message: string;
}

interface GetAllCarLogsAssetsData {
    getAllCarLogsAssets: {
        assets: CarLogAsset[];
        nextToken: string | null;
    };
}

interface UseCarLogsApiReturn {
    triggerReload: () => void;
}

export const useCarLogsApi = (allowedToFetchAllAssets: boolean = false): UseCarLogsApiReturn => {
    const { t } = useTranslation();
    const [, dispatch] = useStore();
    const [reload, setReload] = useState<boolean>(false);
    const [subscriptionVariables, setSubscriptionVariables] = useState<SubscriptionVariables>({});

    const triggerReload = (): void => {
        setReload((prev) => !prev);
    };

    // adds an error notification for each API error
    const addErrorNotifications = useCallback(
        (apiMethodName: string, errors: GraphQLError[], dispatch: Dispatch): void => {
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
        async function getSubscriptionVariables(): Promise<void> {
            if (allowedToFetchAllAssets) {
                setSubscriptionVariables({});
            } else {
                const authUser = await getCurrentAuthUser();
                const sub = authUser.sub;
                setSubscriptionVariables({ sub: sub });
            }
        }
        getSubscriptionVariables();
    }, [allowedToFetchAllAssets, addErrorNotifications]);

    // initial data load
    useEffect(() => {
        const getAssetApiCall = async (nextToken: string | null = null): Promise<string | null> => {
            const response = await graphqlQuery<GetAllCarLogsAssetsData>(getAllCarLogsAssets, {
                limit: ASSETS_GET_LIMIT,
                nextToken: nextToken,
            });
            const assets = response.getAllCarLogsAssets.assets;
            dispatch('ADD_ASSETS', assets);
            return response.getAllCarLogsAssets.nextToken;
        };

        const getAssets = async (): Promise<void> => {
            dispatch('ASSETS_IS_LOADING', true);
            try {
                let nextToken: string | null = null;
                nextToken = await getAssetApiCall(nextToken);

                dispatch('ASSETS_IS_LOADING', false);

                while (nextToken) {
                    nextToken = await getAssetApiCall(nextToken);
                }
            } catch (error: any) {
                addErrorNotifications('getAllCarLogsAssets query', error.errors, dispatch);
            } finally {
                dispatch('ASSETS_IS_LOADING', false);
            }
        };

        getAssets();

        return () => {
            // Unmounting
        };
    }, [dispatch, addErrorNotifications, reload]);

    // subscribe to data changes and append them to local array
    useEffect(() => {
        const subscription = graphqlSubscribe<{ onAddedCarLogsAsset: CarLogAsset }>(
            onAddedCarLogsAsset,
            subscriptionVariables
        ).subscribe({
            next: (event) => {
                const addedAsset: CarLogAsset = event.value.data.onAddedCarLogsAsset;
                dispatch('UPDATE_ASSET', addedAsset);
            },
            error: (error: any) => {
                const errors: GraphQLError[] = error.error.errors;
                addErrorNotifications('onAddedCarLogsAsset subscription', errors, dispatch);
            },
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [subscriptionVariables, dispatch, addErrorNotifications]);

    // subscribe to delete data changes and delete them from local array
    useEffect(() => {
        const subscription = graphqlSubscribe<{ onDeletedCarLogsAsset: CarLogAsset }>(
            onDeletedCarLogsAsset,
            subscriptionVariables
        ).subscribe({
            next: (event) => {
                const deletedAsset: CarLogAsset = event.value.data.onDeletedCarLogsAsset;
                dispatch('DELETE_ASSET', [deletedAsset]);
            },
            error: (error: any) => {
                const errors: GraphQLError[] = error.error.errors;
                addErrorNotifications('onDeletedCarLogsAsset subscription', errors, dispatch);
            },
        });

        return () => {
            subscription.unsubscribe();
        };
    }, [subscriptionVariables, dispatch, addErrorNotifications]);

    return {
        triggerReload,
    };
};
