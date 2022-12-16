import { createContext, useState } from 'react';

//create a context, with createContext api
export const eventContext = createContext();

const EventProvider = (props) => {
  // this state will be shared with all components
  const [events, setEvents] = useState([]);

  const [selectedEvent, setSelectedEvent] = useState({
    eventId: 'not-set',
    eventName: 'Please Select an Event',
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
