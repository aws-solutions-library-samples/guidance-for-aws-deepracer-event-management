import { Container, FormField, Header, Input, SpaceBetween } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const GeneralInfoPanel = ({ onFormIsValid, onFormIsInvalid, fleetName, onChange }) => {
  const [errorMessage, setErrorMessage] = useState();
  const { t } = useTranslation();

  // Input validation for the fleet name
  useEffect(() => {
    if (fleetName) {
      setErrorMessage('');
      onFormIsValid();
    } else {
      setErrorMessage(t('fleets.fleet-name-empty-message'));
      onFormIsInvalid();
    }
  }, [fleetName, onFormIsInvalid, onFormIsValid]);

  return (
    <Container header={<Header variant="h2">General settings</Header>}>
      <SpaceBetween size="l">
        <FormField
          label={t('fleets.fleet-name')}
          description={t('fleets.fleet-name-description')}
          errorText={errorMessage}
        >
          <Input
            placeholder={t('fleets.fleet-name-placeholder')}
            ariaRequired={true}
            value={fleetName}
            onChange={(event) => onChange({ fleetName: event.detail.value })}
          />
        </FormField>
      </SpaceBetween>
    </Container>
  );
};
