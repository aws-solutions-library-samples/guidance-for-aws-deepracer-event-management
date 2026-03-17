import { Container, FormField, Header, Input, SpaceBetween } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Configuration change payload
 */
interface FleetNameChange {
  fleetName: string;
}

/**
 * Props interface for GeneralInfoPanel component
 */
interface GeneralInfoPanelProps {
  /** Callback when form becomes valid */
  onFormIsValid: () => void;
  /** Callback when form becomes invalid */
  onFormIsInvalid: () => void;
  /** Current fleet name value */
  fleetName: string;
  /** Callback when fleet name changes */
  onChange: (change: FleetNameChange) => void;
}

/**
 * GeneralInfoPanel component that displays general fleet information form
 * @param props - Component props
 * @returns Rendered container with fleet name input
 */
export const GeneralInfoPanel = ({ 
  onFormIsValid, 
  onFormIsInvalid, 
  fleetName, 
  onChange 
}: GeneralInfoPanelProps): JSX.Element => {
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isDirty, setIsDirty] = useState<boolean>(false);
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
