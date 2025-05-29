import { Container, FormField, Header, Input, SpaceBetween } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const GeneralInfoPanel = ({ onFormIsValid, onFormIsInvalid, fleetName, onChange }) => {
  const [errorMessage, setErrorMessage] = useState();
  const [isDirty, setIsDirty] = useState(false);
  const { t } = useTranslation();

  // Input validation for the fleet name
  useEffect(() => {
    if (!isDirty) return; // Skip validation if form hasn't been touched

    if (fleetName) {
      setErrorMessage('');
      onFormIsValid();
    } else {
      setErrorMessage(t('fleets.fleet-name-empty-message'));
      onFormIsInvalid();
    }
  }, [t, fleetName, onFormIsInvalid, onFormIsValid, isDirty]);

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
            onChange={(event) => {
              setIsDirty(true);
              onChange({ fleetName: event.detail.value });
            }}
          />
        </FormField>
      </SpaceBetween>
    </Container>
  );
};
