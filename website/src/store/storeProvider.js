import React, { createContext, useContext, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { event } from '../admin/events/support-functions/eventDomain';
import { useCarsApi } from '../hooks/useCarsApi';
import { useEventsApi } from '../hooks/useEventsApi';
import { useFleetsApi } from '../hooks/useFleetsApi';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useRacesApi } from '../hooks/useRacesApi';
import { useUsersApi } from '../hooks/useUsersApi';
import { usePermissionsContext } from './permissions/permissionsProvider';

const racesContext = createContext();
export function useRacesContext() {
  return useContext(racesContext);
}

// CARS
const carsContext = createContext();
export function useCarsContext() {
  return useContext(carsContext);
}

// FLEETS
const fleetContext = createContext();
export function useFleetsContext() {
  return useContext(fleetContext);
}

// EVENTS
const defaultEvent = (t) => {
  const defEvent = { ...event };
  defEvent.eventName = t('event-provider.please-select-an-event');
  return defEvent;
};

const eventContext = createContext();
export function useEventsContext() {
  return useContext(eventContext);
}

const selectedEventContext = createContext();
export function useSelectedEventContext() {
  return useContext(selectedEventContext);
}

const selectedEventDispatch = createContext();
export function useSelectedEventDispatch() {
  return useContext(selectedEventDispatch);
}

const selectedTrackContext = createContext();
export function useSelectedTrackContext() {
  return useContext(selectedTrackContext);
}

const selectedTrackDispatch = createContext();
export function useSelectedTrackDispatch() {
  return useContext(selectedTrackDispatch);
}

// USERS
const userContext = createContext();
export function useUsersContext() {
  return useContext(userContext);
}

export const StoreProvider = (props) => {
  const { t } = useTranslation();
  const permissions = usePermissionsContext();

  const [selectedEvent, setSelectedEvent] = useLocalStorage('DREM-selected-event', defaultEvent(t));

  const [events, eventsIsLoading] = useEventsApi(
    selectedEvent,
    setSelectedEvent,
    permissions.api.events
  );
  const [users, usersIsLoading] = useUsersApi(permissions.api.users);
  const [fleets, fleetsIsLoading] = useFleetsApi(permissions.api.fleets);
  const [cars, carsIsLoading] = useCarsApi(permissions.api.cars);

  const [selectedTrack, setSelectedTrack] = useLocalStorage(
    'DREM-selected-event-track',
    selectedEvent.tracks[0]
  );

  const [races, racesIsLoading, sendDelete] = useRacesApi(selectedEvent.eventId);

  //reset selected event if event is deleted
  useEffect(() => {
    if ('eventId' in selectedEvent && eventsIsLoading === false) {
      const index = events.findIndex((event) => event.eventId === selectedEvent.eventId);
      if (index === -1) {
        console.info('reset selected event');
        setSelectedEvent(defaultEvent(t));
        setSelectedTrack(selectedEvent.tracks[0]);
      }
    }
  }, [events, selectedEvent, t, eventsIsLoading, setSelectedEvent, setSelectedTrack]);

  const getUserNameFromId = (userId) => {
    if (userId == null) return;

    const user = users.find((user) => user.sub === userId);
    if (user == null) return userId;

    return user.Username;
  };

  const getFleetNameFromId = (fleetId) => {
    if (fleetId == null) return;

    const fleet = fleets.find((fleet) => fleet.fleetId === fleetId);
    if (fleet == null) return fleetId;

    return fleet.fleetName;
  };

  return (
    <userContext.Provider value={[users, usersIsLoading, getUserNameFromId]}>
      <carsContext.Provider value={[cars, carsIsLoading]}>
        <fleetContext.Provider value={[fleets, fleetsIsLoading, getFleetNameFromId]}>
          <eventContext.Provider value={[events, eventsIsLoading]}>
            <selectedEventContext.Provider value={selectedEvent}>
              <selectedEventDispatch.Provider value={setSelectedEvent}>
                <selectedTrackContext.Provider value={selectedTrack}>
                  <selectedTrackDispatch.Provider value={setSelectedTrack}>
                    <racesContext.Provider value={[races, racesIsLoading, sendDelete]}>
                      {props.children}
                    </racesContext.Provider>
                  </selectedTrackDispatch.Provider>
                </selectedTrackContext.Provider>
              </selectedEventDispatch.Provider>
            </selectedEventContext.Provider>
          </eventContext.Provider>
        </fleetContext.Provider>
      </carsContext.Provider>
    </userContext.Provider>
  );
};
