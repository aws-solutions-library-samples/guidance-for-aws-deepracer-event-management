import { Container, FormField, Header, Select, SpaceBetween } from '@cloudscape-design/components';
import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fleetContext } from '../../store/fleetProvider';

export const CarFleetPanel = ({ fleetId, onChange }) => {
  const { t } = useTranslation();
  const [carFleetOptions, setCarFleetOptions] = useState([]);

  const [fleets] = useContext(fleetContext);

  // Populate all Car fleet options
  useEffect(() => {
    if (fleets) {
      setCarFleetOptions(
        fleets.map((fleet) => {
          return { lable: fleet.fleetId, value: fleet.fleetName };
        })
      );
    }
  }, [fleets]);

  const GetCarFleetOptionFromId = (id) => {
    return carFleetOptions.find((carFleet) => carFleet.lable === id);
  };

  return (
    <Container header={<Header variant="h2">Fleet selection</Header>}>
      <SpaceBetween size="l">
        <FormField
          label={t('events.fleet-info.label')}
          description={t('events.fleet-info.description')}
        >
          <Select
            selectedOption={GetCarFleetOptionFromId(fleetId)}
            onChange={({ detail }) =>
              onChange({ fleetConfig: { fleetId: detail.selectedOption.lable } })
            }
            options={carFleetOptions}
            selectedAriaLabel="Selected"
            filteringType="auto"
          />
        </FormField>
      </SpaceBetween>
    </Container>
  );
};
