import { FormField, Select, SpaceBetween } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../../store/store';

export const CarFleetPanel = ({ fleetId, onChange }) => {
  const { t } = useTranslation();
  const [carFleetOptions, setCarFleetOptions] = useState([]);

  const [state] = useStore();
  const fleets = state.fleets.fleets;

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

  const GetCarFleetOptionFromId = (id) => {
    return carFleetOptions.find((carFleet) => carFleet.label === id);
  };
  return (
    <SpaceBetween size="l">
      <FormField
        label={t('events.fleet-info.label')}
        description={t('events.fleet-info.description')}
      >
        <Select
          selectedOption={GetCarFleetOptionFromId(fleetId)}
          onChange={({ detail }) => onChange(detail.selectedOption.label)}
          options={carFleetOptions}
          selectedAriaLabel="Selected"
          filteringType="auto"
        />
      </FormField>
    </SpaceBetween>
  );
};
