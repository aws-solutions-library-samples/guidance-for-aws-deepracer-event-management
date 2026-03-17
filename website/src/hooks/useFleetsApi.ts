import { useEffect } from 'react';
import { graphqlMutate, graphqlSubscribe } from '../graphql/graphqlHelpers';
import * as queries from '../graphql/queries';
import { onAddedFleet, onDeletedFleets, onUpdatedFleet } from '../graphql/subscriptions';
import { useStore } from '../store/store';
import { Fleet } from '../types/domain';

export function useFleetsApi(userHasAccess: boolean = false): void {
    const [, dispatch] = useStore();

    // initial data load
    useEffect(() => {
        if (userHasAccess) {
            console.debug('GET FLEETS');
            async function getAllFleets(): Promise<void> {
                dispatch('FLEETS_IS_LOADING', true);
                const response = await graphqlMutate<{ getAllFleets: Fleet[] }>(
                    queries.getAllFleets
                );
                const fleets = response.getAllFleets.map((fleet) => {
                    const updatedCarIds = fleet.deviceIds ? fleet.deviceIds : [];
                    return { ...fleet, deviceIds: updatedCarIds };
                });
                dispatch('ADD_FLEETS', fleets);
                dispatch('FLEETS_IS_LOADING', false);
            }
            getAllFleets();
        }
        return () => {
            // Unmounting
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userHasAccess]);

    // subscribe to data changes and append them to local array
    useEffect(() => {
        let subscription: { unsubscribe: () => void } | undefined;
        if (userHasAccess) {
            subscription = graphqlSubscribe<{ onAddedFleet: Fleet }>(onAddedFleet).subscribe({
                next: (event) => {
                    dispatch('UPDATE_FLEET', event.value.data.onAddedFleet);
                },
                error: (error: any) => console.warn(error),
            });
        }
        return () => {
            if (subscription) {
                subscription.unsubscribe();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userHasAccess]);

    // subscribe to updated fleets and update local array
    useEffect(() => {
        let subscription: { unsubscribe: () => void } | undefined;
        if (userHasAccess) {
            subscription = graphqlSubscribe<{ onUpdatedFleet: Fleet }>(onUpdatedFleet).subscribe({
                next: (event) => {
                    const updatedFleet: Fleet = event.value.data.onUpdatedFleet;
                    dispatch('UPDATE_FLEET', updatedFleet);
                },
                error: (error: any) => console.warn(error),
            });
        }
        return () => {
            if (subscription) {
                subscription.unsubscribe();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userHasAccess]);

    // subscribe to delete data changes and delete them from local array
    useEffect(() => {
        let subscription: { unsubscribe: () => void } | undefined;
        if (userHasAccess) {
            subscription = graphqlSubscribe<{ onDeletedFleets: Fleet[] }>(
                onDeletedFleets
            ).subscribe({
                next: (event) => {
                    console.debug('DELETED FLEET: start: ' + JSON.stringify(event.value.data));
                    const fleetIdsToDelete: string[] = event.value.data.onDeletedFleets.map(
                        (fleet: Fleet) => fleet.fleetId
                    );
                    dispatch('DELETE_FLEETS', fleetIdsToDelete);
                },
                error: (error: any) => {
                    console.warn(error);
                },
            });
        }

        return () => {
            if (subscription) {
                subscription.unsubscribe();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userHasAccess]);
}
