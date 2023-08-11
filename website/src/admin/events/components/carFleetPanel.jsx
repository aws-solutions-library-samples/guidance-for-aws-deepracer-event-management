import { FormField, Select, SpaceBetween } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFleetsContext } from '../../../store/storeProvider';

export const CarFleetPanel = ({ fleetId, onChange }) => {
  const { t } = useTranslation();
  const [carFleetOptions, setCarFleetOptions] = useState([]);

  const [fleets] = useFleetsContext();

  // Populate all Car fleet options
  useEffect(() => {
    if (fleets) {
      setCarFleetOptions(
        fleets.map((fleet) => {
          return { label: fleet.fleetId, value: fleet.fleetName };
        })
      );
    }
  }, [fleets]);

  const GetCarFleetOptionFromId = (id) => {
    return carFleetOptions.find((carFleet) => carFleet.lable === id);
  };
  return (
    <SpaceBetween size="l">
      <FormField
        label={t('events.fleet-info.label')}
        description={t('events.fleet-info.description')}
      >
        <Select
          selectedOption={GetCarFleetOptionFromId(fleetId)}
          onChange={({ detail }) => onChange(detail.selectedOption.lable)}
          options={carFleetOptions}
          selectedAriaLabel="Selected"
          filteringType="auto"
        />
      </FormField>
    </SpaceBetween>
  );
};
