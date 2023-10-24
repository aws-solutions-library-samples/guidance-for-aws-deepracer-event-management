import React, { useEffect, useState } from 'react';
import { DevicesTable } from '../../components/devices-table/devicesTable';

export const DevicesPanel = ({ carIds, onChange, fleetName }) => {
  const [selectedDevices, setSelectedDevices] = useState([]);
  const UpdateConfig = (attr) => {
    if (attr) {
      const carIds = attr.map((device) => device.InstanceId);
      onChange({ carIds: carIds });
    } else {
      onChange({ carIds: [] });
    }
  };

  useEffect(() => {
    if (carIds !== null) {
      const devices = carIds.map((id) => {
        return { InstanceId: id };
      });
      setSelectedDevices(devices);
    }
  }, [carIds]);

  return (
    <DevicesTable
      selectedDevicesInTable={selectedDevices}
      setSelectedDevicesInTable={UpdateConfig}
      fleetName={fleetName}
    />
  );
};
