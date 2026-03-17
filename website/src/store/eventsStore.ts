import { initStore } from './store';
import { GlobalState, EventsState } from './storeTypes';
import { Event } from '../types/domain';

const configureStore = (): void => {
  const actions = {
    ADD_EVENTS: (curState: GlobalState, events: Event[]): Partial<GlobalState> => {
      console.debug('ADD_EVENTS DISPATCH FUNCTION');
      const updatedEvents: EventsState = { ...(curState.events || { events: [], isLoading: false }) };
      updatedEvents.events = events;
      return { events: updatedEvents };
    },
    UPDATE_EVENT: (curState: GlobalState, event: Event): Partial<GlobalState> => {
      console.debug('UPDATE_EVENT DISPATCH FUNCTION');
      const currentEvents = curState.events?.events || [];
      const updatedEvents: EventsState = { ...(curState.events || { events: [], isLoading: false }) };
      const eventIndex = currentEvents.findIndex((e) => e.eventId === event.eventId);
      if (eventIndex === -1) {
        updatedEvents.events.push(event);
      } else {
        updatedEvents.events[eventIndex] = event;
      }
      return { events: updatedEvents };
    },
    DELETE_EVENTS: (curState: GlobalState, eventIdsToDelete: string[]): Partial<GlobalState> => {
      console.debug('DELETE_EVENT DISPATCH FUNCTION');
      const currentEvents = curState.events?.events || [];
      const updatedEvents: EventsState = { 
        ...(curState.events || { events: [], isLoading: false }),
        events: currentEvents.filter((event) => !eventIdsToDelete.includes(event.eventId))
      };
      return { events: updatedEvents };
    },
    EVENTS_IS_LOADING: (curState: GlobalState, isLoading: boolean): Partial<GlobalState> => {
      console.debug('EVENTS_IS_LOADING DISPATCH FUNCTION', isLoading);
      const updatedEvents: EventsState = { ...(curState.events || { events: [], isLoading: false }) };
      updatedEvents.isLoading = isLoading;
      return { events: updatedEvents };
    },
  };

  initStore(actions, { events: { events: [], isLoading: true } });
};

export default configureStore;
