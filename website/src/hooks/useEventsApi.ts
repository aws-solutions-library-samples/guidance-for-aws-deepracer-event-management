import { useEffect } from 'react';
import { graphqlMutate, graphqlSubscribe } from '../graphql/graphqlHelpers';
import * as queries from '../graphql/queries';
import { onAddedEvent, onDeletedEvents, onUpdatedEvent } from '../graphql/subscriptions';
import { useStore } from '../store/store';
import { Event } from '../types/domain';

export const useEventsApi = (
    selectedEvent: Event | null,
    setSelectedEvent: (event: Event) => void,
    userHasAccess: boolean = false
): void => {
    const [, dispatch] = useStore();

    // initial data load
    useEffect(() => {
        if (userHasAccess) {
            async function getEvents(): Promise<void> {
                dispatch('EVENTS_IS_LOADING', true);
                const response = await graphqlMutate<{ getEvents: Event[] }>(queries.getEvents);
                const events = response.getEvents;
                const eventsInNewFormat = events.filter((event) => event.raceConfig !== null);
                dispatch('ADD_EVENTS', eventsInNewFormat);
                dispatch('EVENTS_IS_LOADING', false);
            }
            getEvents();
        }
        return () => {
            // Unmounting
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userHasAccess]);

    // subscribe to data changes and append them to local array
    useEffect(() => {
        let onAddEventSubscription: { unsubscribe: () => void } | undefined;
        if (userHasAccess) {
            onAddEventSubscription = graphqlSubscribe<{ onAddedEvent: Event }>(
                onAddedEvent
            ).subscribe({
                next: (event) => {
                    console.debug('onAddedEvent received', event);
                    dispatch('UPDATE_EVENT', event.value.data.onAddedEvent);
                },
            });
        }
        return () => {
            if (onAddEventSubscription) {
                onAddEventSubscription.unsubscribe();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userHasAccess]);

    // subscribe to updated events and update local array
    useEffect(() => {
        let onUpdatedEventSubscription: { unsubscribe: () => void } | undefined;
        if (userHasAccess) {
            onUpdatedEventSubscription = graphqlSubscribe<{ onUpdatedEvent: Event }>(
                onUpdatedEvent
            ).subscribe({
                next: (event) => {
                    console.debug(event);
                    const updatedEvent: Event = event.value.data.onUpdatedEvent;

                    dispatch('UPDATE_EVENT', updatedEvent);

                    //update the selected event if it has been updated
                    if (selectedEvent != null && updatedEvent.eventId === selectedEvent.eventId) {
                        console.debug('update the selected event');
                        setSelectedEvent(updatedEvent);
                    }
                },
            });
        }
        return () => {
            if (onUpdatedEventSubscription) {
                onUpdatedEventSubscription.unsubscribe();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userHasAccess, selectedEvent]);

    // subscribe to delete data changes and delete them from local array
    useEffect(() => {
        let onDeletedEventsSubscription: { unsubscribe: () => void } | undefined;
        if (userHasAccess) {
            onDeletedEventsSubscription = graphqlSubscribe<{ onDeletedEvents: string[] }>(
                onDeletedEvents
            ).subscribe({
                next: (event) => {
                    const eventIdsToDelete: string[] = event.value.data.onDeletedEvents.map(
                        (evt: string) => JSON.parse(evt).eventId
                    );
                    dispatch('DELETE_EVENTS', eventIdsToDelete);
                },
            });
        }
        return () => {
            if (onDeletedEventsSubscription) {
                onDeletedEventsSubscription.unsubscribe();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userHasAccess]);
};
