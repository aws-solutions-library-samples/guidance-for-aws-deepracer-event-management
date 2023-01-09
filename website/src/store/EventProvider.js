import React, { createContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useEventsApi } from '../hooks/useEventsApi';

export const eventContext = createContext();

const defaultEvent = (t) => {
  return {
    eventId: 'not-set',
    eventName: t('event-provider.please-select-an-event'),
  };
};

const EventProvider = (props) => {
  const { t } = useTranslation();
  const [events, isLoading, errorMessage] = useEventsApi();
  const [selectedEvent, setSelectedEvent] = useState(defaultEvent(t));

  return (
    <eventContext.Provider value={{ events, selectedEvent, setSelectedEvent }}>
      {props.children}
    </eventContext.Provider>
  );
};

export default EventProvider;
