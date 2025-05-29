import React, { useEffect, useState } from 'react';
import { useStore } from '../../store/store';

import { DevicesTable } from '../../components/devices-table/devicesTable';

export const DevicesPanel = ({ onChange, fleetName, fleetId }) => {
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [initSelectedDevices, setInitSelectedDevices] = useState([]);
  const [state] = useStore();

  const updateConfig = (attr) => {
    if (attr) {
      const carIds = attr.map((device) => device.InstanceId);
      onChange({ carIds: carIds });
      setSelectedDevices(attr);
    } else {
      onChange({ carIds: [] });
    }
  };

  // Initial load -- pick the cars from the cars store
  useEffect(() => {
    if (state.cars.cars !== null && fleetId !== undefined) {
      const devices = state.cars.cars
        .filter((car) => car.fleetId === fleetId)
        .map((car) => ({ InstanceId: car.InstanceId }));
      console.debug('DevicesPanel - Initial devices in fleet', fleetId, devices);
      setSelectedDevices(devices);
      setInitSelectedDevices(devices);
    }
  }, [fleetId, state.cars.cars]);

  return (
    <DevicesTable
      selectedDevicesInTable={selectedDevices}
      setSelectedDevicesInTable={updateConfig}
      initialSelectedDevices={initSelectedDevices}
      fleetName={fleetName}
    />
  );
};
