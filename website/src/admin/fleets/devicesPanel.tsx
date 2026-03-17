import React, { useEffect, useState } from 'react';
import { useStore } from '../../store/store';
import { DevicesTable } from '../../components/devices-table/devicesTable';

/**
 * Device selection structure
 */
interface SelectedDevice {
  InstanceId: string;
}

/**
 * Configuration change payload
 */
interface ConfigChange {
  carIds: string[];
}

/**
 * Props interface for DevicesPanel component
 */
interface DevicesPanelProps {
  /** Callback when device selection changes */
  onChange: (config: ConfigChange) => void;
  /** Name of the fleet */
  fleetName: string;
  /** ID of the fleet */
  fleetId: string;
}

/**
 * DevicesPanel component that displays and manages device selection for a fleet
 * @param props - Component props
 * @returns Rendered devices table with selection
 */
export const DevicesPanel = ({ onChange, fleetName, fleetId }: DevicesPanelProps): JSX.Element => {
  const [selectedDevices, setSelectedDevices] = useState<SelectedDevice[]>([]);
  const [initSelectedDevices, setInitSelectedDevices] = useState<SelectedDevice[]>([]);
  const [state] = useStore();

  const updateConfig = (attr: SelectedDevice[] | undefined): void => {
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
    if (state.cars?.cars && fleetId !== undefined) {
      const devices = state.cars.cars
        .filter((car) => car.fleetId === fleetId)
        .map((car) => ({ InstanceId: car.InstanceId }));
      console.debug('DevicesPanel - Initial devices in fleet', fleetId, devices);
      setSelectedDevices(devices);
      setInitSelectedDevices(devices);
    }
  }, [fleetId, state.cars]);

  return (
    <DevicesTable
      selectedDevicesInTable={selectedDevices as any}
      setSelectedDevicesInTable={updateConfig}
      initialSelectedDevices={initSelectedDevices as any}
      fleetName={fleetName}
    />
  );
};
