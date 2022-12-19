import React, { createContext, useState } from 'react';
import { useTranslation } from 'react-i18next';
// create a context, with createContext api
export const eventContext = createContext();

const EventProvider = (props) => {
  const { t } = useTranslation();
  // this state will be shared with all components
  const [events, setEvents] = useState([]);

  const [selectedEvent, setSelectedEvent] = useState({
    eventId: 'not-set',
    eventName: t('event-provider.please-select-an-event'),
    fleetId: '',
    raceTimeInSec: 120,
    numberOfResets: 99,
  });

  return (
    // this is the provider providing state
    <eventContext.Provider value={{ events, setEvents, selectedEvent, setSelectedEvent }}>
      {props.children}
    </eventContext.Provider>
  );
};

export default EventProvider;
