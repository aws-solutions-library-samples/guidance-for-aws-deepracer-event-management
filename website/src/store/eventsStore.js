import { initStore } from './store';

const configureStore = () => {
  const actions = {
    ADD_EVENTS: (curState, events) => {
      console.debug('ADD_EVENTS DISPATCH FUNCTION');
      const updatedEvents = { ...curState.events };
      updatedEvents.events = events;
      return { events: updatedEvents };
    },
    UPDATE_EVENT: (curState, event) => {
      console.debug('UPDATE_EVENT DISPATCH FUNCTION');
      const updatedEvents = { ...curState.events };
      const eventIndex = curState.events.events.findIndex((e) => e.eventId === event.eventId);
      if (eventIndex === -1) {
        updatedEvents.events.push(event);
      } else {
        updatedEvents.events[eventIndex] = event;
      }
      return { events: updatedEvents };
    },
    DELETE_EVENTS: (curState, eventIdsToDelete) => {
      console.debug('DELETE_EVENT DISPATCH FUNCTION');
      const updatedEvents = { ...curState.events };
      updatedEvents.events = updatedEvents.events.filter((event) => {
        return !eventIdsToDelete.find((eventIdToDelete) => {
          return eventIdToDelete === event.eventId;
        });
      });
      return { events: updatedEvents };
    },
    EVENTS_IS_LOADING: (curState, isLoading) => {
      console.debug('EVENTS_IS_LOADING DISPATCH FUNCTION', isLoading);
      const updatedEvents = { ...curState.events };
      updatedEvents.isLoading = isLoading;
      return { events: updatedEvents };
    },
  };

  initStore(actions, { events: { events: [], isLoading: true } });
};

export default configureStore;
