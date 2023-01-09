import React, { createContext } from 'react';
import { useFleetsApi } from '../hooks/useFleetsApi';

export const fleetContext = createContext();

export const FleetProvider = (props) => {
  const [fleets, isLoading] = useFleetsApi();

  return (
    // this is the provider providing state
    <fleetContext.Provider value={[fleets, isLoading]}>{props.children}</fleetContext.Provider>
  );
};
