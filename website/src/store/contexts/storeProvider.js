import React, { createContext, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { event } from '../../admin/events/support-functions/eventDomain';
import { useLocalStorage } from '../../hooks/useLocalStorage';

// EVENTS
const defaultEvent = (t) => {
  const defEvent = { ...event };
  defEvent.eventName = t('event-provider.please-select-an-event');
  return defEvent;
};

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

export const StoreProvider = (props) => {
  const { t } = useTranslation();

  const [selectedEvent, setSelectedEvent] = useLocalStorage('DREM-selected-event', defaultEvent(t));

  const [selectedTrack, setSelectedTrack] = useLocalStorage(
    'DREM-selected-event-track',
    selectedEvent.tracks[0]
  );

  return (
    <selectedEventContext.Provider value={selectedEvent}>
      <selectedEventDispatch.Provider value={setSelectedEvent}>
        <selectedTrackContext.Provider value={selectedTrack}>
          <selectedTrackDispatch.Provider value={setSelectedTrack}>
            {props.children}
          </selectedTrackDispatch.Provider>
        </selectedTrackContext.Provider>
      </selectedEventDispatch.Provider>
    </selectedEventContext.Provider>
  );
};
