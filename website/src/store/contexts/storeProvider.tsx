import React, { createContext, useContext, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { TFunction } from 'i18next';
import { event } from '../../admin/events/support-functions/eventDomain';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { Event, Track } from '../../types/domain';

// EVENTS
const defaultEvent = (t: TFunction): Partial<Event> & { eventName: string } => {
  const defEvent: any = { ...event };
  defEvent.eventName = t('events.provider.please-select-an-event');
  return defEvent;
};

const selectedEventContext = createContext<(Partial<Event> & { eventName: string }) | undefined>(undefined);
export function useSelectedEventContext(): (Partial<Event> & { eventName: string }) | undefined {
  return useContext(selectedEventContext);
}

const selectedEventDispatch = createContext<((event: Partial<Event> & { eventName: string }) => void) | undefined>(undefined);
export function useSelectedEventDispatch(): ((event: Partial<Event> & { eventName: string }) => void) | undefined {
  return useContext(selectedEventDispatch);
}

const selectedTrackContext = createContext<Track | undefined>(undefined);
export function useSelectedTrackContext(): Track | undefined {
  return useContext(selectedTrackContext);
}

const selectedTrackDispatch = createContext<((track: Track) => void) | undefined>(undefined);
export function useSelectedTrackDispatch(): ((track: Track) => void) | undefined {
  return useContext(selectedTrackDispatch);
}

interface StoreProviderProps {
  children: ReactNode;
}

export const StoreProvider: React.FC<StoreProviderProps> = (props) => {
  const { t } = useTranslation();

  const [selectedEvent, setSelectedEvent] = useLocalStorage<Partial<Event> & { eventName: string }>(
    'DREM-selected-event', 
    defaultEvent(t)
  );

  const [selectedTrack, setSelectedTrack] = useLocalStorage<Track | undefined>(
    'DREM-selected-event-track',
    selectedEvent.tracks?.[0]
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
