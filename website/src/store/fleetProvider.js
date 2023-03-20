import React, { createContext } from 'react';
import { useFleetsApi } from '../hooks/useFleetsApi';

export const fleetContext = createContext();

export const FleetProvider = (props) => {
  const [fleets, isLoading] = useFleetsApi();

  const getFleetNameFromId = (fleetId) => {
    if (fleetId == null) return;

    const fleet = fleets.find((fleet) => fleet.fleetId === fleetId);
    if (fleet == null) return fleetId;

    return fleet.fleetName;
  };

  return (
    // this is the provider providing state
    <fleetContext.Provider value={[fleets, isLoading, getFleetNameFromId]}>
      {props.children}
    </fleetContext.Provider>
  );
};
