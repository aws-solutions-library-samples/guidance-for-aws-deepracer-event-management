import { Container, FormField, Header, Input, SpaceBetween } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';

export const GeneralInfoPanel = ({
  onFormIsValid,
  onFormIsInvalid,
  fleetName,
  // currentItems = [],
  onChange,
}) => {
  // const [name, setName] = useState('');
  const [errorMessage, setErrorMessage] = useState();

  // Input validation for the fleet name
  useEffect(() => {
    if (fleetName) {
      // if (
      //   currentItems &&
      //   currentItems
      //     .map((fleet) => {
      //       return fleet.fleetName;
      //     })
      //     .includes(name.trim())
      // ) {
      //   if (selectedItem && selectedItem.fleetName && selectedItem.fleetName !== name.trim()) {
      //     setErrorMessage(`Fleet with name ${name} already exists`);
      //     onFormIsInvalid();
      //   } else {
      //     setErrorMessage('');
      //     onFormIsValid();
      //   }
      // } else {
      setErrorMessage('');
      onFormIsValid();
      //  }
    } else {
      setErrorMessage(`Fleet name cannot be empty`);
      onFormIsInvalid();
    }
  }, [fleetName, onFormIsInvalid, onFormIsValid]);

  return (
    <Container header={<Header variant="h2">General settings</Header>}>
      <SpaceBetween size="l">
        <FormField label="Name" description="The name of the Fleet." errorText={errorMessage}>
          <Input
            placeholder="My awsome fleet"
            ariaRequired={true}
            value={fleetName}
            onChange={(event) => onChange({ fleetName: event.detail.value })}
          />
        </FormField>
      </SpaceBetween>
    </Container>
  );
};
