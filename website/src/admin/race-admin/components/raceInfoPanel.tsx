import { ColumnLayout, Container, FormField, Header, Toggle } from '@cloudscape-design/components';
import React from 'react';

import { useUsers } from '../../../hooks/useUsers';
import { formatAwsDateTime } from '../../../support-functions/time';
import { Race } from '../../../types/domain';

/**
 * Props interface for RaceInfoPanel component
 */
interface RaceInfoPanelProps {
  /** Race object to display information for */
  race: Race;
  /** Callback function when race properties change */
  onChange: (changes: Partial<Race>) => void;
}

/**
 * RaceInfoPanel component that displays general race information
 * @param props - Component props
 * @returns Rendered race information panel
 */
export const RaceInfoPanel = ({ race, onChange }: RaceInfoPanelProps): JSX.Element => {
  const [, , getUserNameFromId] = useUsers();

  return (
    <Container header={<Header variant="h2">General info</Header>}>
      <ColumnLayout columns={2} variant={'text-grid'}>
        <FormField
          label="Race ID" //{t('events.event-type')}
          //description=''//{t('events.event-type-description')}
          //errorText={typeOfEventErrorMessage}
        >
          {race.raceId}
        </FormField>
        <FormField
          label="Created At" //{t('events.event-type')}
          //description=''//{t('events.event-type-description')}
          //errorText={typeOfEventErrorMessage}
        >
          {race.createdAt ? formatAwsDateTime(race.createdAt) : '-'}
        </FormField>
        <FormField
          label="Racer" //{t('events.event-type')}
          //description=''//{t('events.event-type-description')}
          //errorText={typeOfEventErrorMessage}
        >
          {typeof getUserNameFromId === 'function' ? getUserNameFromId(race.userId) : race.userId}
        </FormField>
        <FormField
          label="Raced By Proxy" //{t('events.event-type')}
          //description=''//{t('events.event-type-description')}
          //errorText={typeOfEventErrorMessage}
        >
          <Toggle
            checked={race.racedByProxy || false}
            onChange={(event) => onChange({ racedByProxy: event.detail.checked })}
          />
        </FormField>
      </ColumnLayout>
    </Container>
  );
};
