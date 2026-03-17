import { FormField, Select, SelectProps, SpaceBetween } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../../store/store';

/**
 * Props interface for CarFleetPanel component
 */
interface CarFleetPanelProps {
  /** Current selected fleet ID */
  fleetId: string;
  /** Callback when fleet selection changes */
  onChange: (fleetName: string) => void;
}

/**
 * CarFleetPanel component that displays a dropdown for fleet selection
 * @param props - Component props
 * @returns Rendered form field with fleet selector
 */
export const CarFleetPanel = ({ fleetId, onChange }: CarFleetPanelProps): JSX.Element => {
  const { t } = useTranslation();
  const [carFleetOptions, setCarFleetOptions] = useState<SelectProps.Option[]>([]);

  const [state] = useStore();
  const fleets = state.fleets?.fleets;

  // Populate all Car fleet options
  useEffect(() => {
    if (fleets) {
      setCarFleetOptions(
        fleets.map((fleet) => {
          return { label: fleet.fleetName, value: fleet.fleetName };
        })
      );
    }
  }, [fleets]);

  const GetCarFleetOptionFromId = (id: string): SelectProps.Option | undefined => {
    return carFleetOptions.find((carFleet) => carFleet.label === id);
  };

  return (
    <SpaceBetween size="l">
      <FormField
        label={t('events.fleet-info.label')}
        description={t('events.fleet-info.description')}
      >
        <Select
          selectedOption={GetCarFleetOptionFromId(fleetId) || null}
          onChange={({ detail }) => onChange(detail.selectedOption.label || '')}
          options={carFleetOptions}
          selectedAriaLabel="Selected"
          filteringType="auto"
        />
      </FormField>
    </SpaceBetween>
  );
};
