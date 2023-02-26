import React, { createContext } from 'react';
import { useTranslation } from 'react-i18next';
import { event } from '../admin/events/eventDomain';
import { useEventsApi } from '../hooks/useEventsApi';
import { useLocalStorage } from '../hooks/useLocalStorage';
export const eventContext = createContext();

const defaultEvent = (t) => {
  const defEvent = { ...event };
  defEvent.eventName = t('event-provider.please-select-an-event');
  return defEvent;
};

const EventProvider = (props) => {
  const { t } = useTranslation();
  const [events, isLoading, errorMessage] = useEventsApi();
  const [selectedEvent, setSelectedEvent] = useLocalStorage('DREM-selected-event', defaultEvent(t));

  return (
    <eventContext.Provider value={{ events, selectedEvent, setSelectedEvent }}>
      {props.children}
    </eventContext.Provider>
  );
};

export default EventProvider;
