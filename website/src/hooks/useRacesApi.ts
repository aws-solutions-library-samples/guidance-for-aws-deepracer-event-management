import { useEffect } from 'react';
import { graphqlQuery, graphqlSubscribe } from '../graphql/graphqlHelpers';
import { getRaces } from '../graphql/queries';
import { onAddedRace, onDeletedRaces, onUpdatedRace } from '../graphql/subscriptions';
import { useStore } from '../store/store';
import { Race } from '../types';

interface GetRacesData {
    getRaces: Race[];
}

interface OnAddedRaceData {
    onAddedRace: Race;
}

interface OnUpdatedRaceData {
    onUpdatedRace: Race;
}

interface OnDeletedRacesData {
    onDeletedRaces: {
        raceIds: string[];
    };
}

export const useRacesApi = (userHasAccess: boolean, eventId: string | undefined): void => {
    const [, dispatch] = useStore();
    useEffect(() => {
        if (!eventId) {
            // used to display a message that an event need to be selected
            dispatch('RACES_IS_LOADING', false);
        } else if (eventId && userHasAccess) {
            console.debug(eventId);
            async function queryApi() {
                const response = await graphqlQuery<GetRacesData>(getRaces, {
                    eventId: eventId,
                });
                console.debug('getRaces');
                const races = response.getRaces;

                if (races) {
                    dispatch('NEW_RACES', races);
                }
                dispatch('RACES_IS_LOADING', false);
            }
            queryApi();
        }

        return () => {
            // Unmounting
        };
    }, [dispatch, eventId, userHasAccess]);

    // subscribe to data changes and append them to local array
    useEffect(() => {
        let subscription: { unsubscribe: () => void } | undefined;
        if (eventId && userHasAccess) {
            subscription = graphqlSubscribe<OnDeletedRacesData>(onDeletedRaces, {
                eventId: eventId,
            }).subscribe({
                next: (event) => {
                    const deletedRaces = event.value.data.onDeletedRaces;
                    if (deletedRaces) {
                        dispatch('DELETE_RACES', deletedRaces.raceIds);
                    }
                },
                error: (error: Error) => {
                    console.debug(error);
                },
            });
        }

        return () => {
            if (subscription) subscription.unsubscribe();
        };
    }, [dispatch, eventId, userHasAccess]);

    // subscribe to data changes and append them to local array
    useEffect(() => {
        let subscription: { unsubscribe: () => void } | undefined;
        if (eventId && userHasAccess) {
            subscription = graphqlSubscribe<OnAddedRaceData>(onAddedRace, {
                eventId: eventId,
            }).subscribe({
                next: (event) => {
                    const addedRace = event.value.data.onAddedRace;
                    if (addedRace) {
                        // Add in the username
                        (addedRace as any)['username'] = addedRace.userId;
                        dispatch('ADD_RACES', [addedRace]);
                    }
                },
            });
        }

        return () => {
            if (subscription) subscription.unsubscribe();
        };
    }, [dispatch, eventId, userHasAccess]);

    useEffect(() => {
        let subscription: { unsubscribe: () => void } | undefined;
        console.debug('ON UPDATE RACE SUBSCRIPTION SETUP', eventId, userHasAccess);
        if (eventId && userHasAccess) {
            subscription = graphqlSubscribe<OnUpdatedRaceData>(onUpdatedRace, {
                eventId: eventId,
            }).subscribe({
                next: (event) => {
                    console.debug('RACE UPDATE RECEIVED', event.value.data.onUpdatedRace);
                    const updatedRace = event.value.data.onUpdatedRace;
                    if (updatedRace) {
                        // Add in the username
                        (updatedRace as any)['username'] = updatedRace.userId;
                        dispatch('UPDATE_RACE', updatedRace);
                    }
                },
            });
        }

        return () => {
            if (subscription) subscription.unsubscribe();
        };
    }, [dispatch, eventId, userHasAccess]);
};
