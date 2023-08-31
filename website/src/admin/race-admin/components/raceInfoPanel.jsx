import { ColumnLayout, Container, FormField, Header, Toggle } from '@cloudscape-design/components';
import React from 'react';

import { useUsers } from '../../../hooks/useUsers';
import { formatAwsDateTime } from '../../../support-functions/time';

export const RaceInfoPanel = ({ race, onChange }) => {
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
          {formatAwsDateTime(race.createdAt)}
        </FormField>
        <FormField
          label="Racer" //{t('events.event-type')}
          //description=''//{t('events.event-type-description')}
          //errorText={typeOfEventErrorMessage}
        >
          {getUserNameFromId(race.userId)}
        </FormField>
        <FormField
          label="Raced By Proxy" //{t('events.event-type')}
          //description=''//{t('events.event-type-description')}
          //errorText={typeOfEventErrorMessage}
        >
          <Toggle
            checked={race.racedByProxy}
            onChange={(event) => onChange({ racedByProxy: event.detail.checked })}
          />
        </FormField>
      </ColumnLayout>
    </Container>
  );
};
