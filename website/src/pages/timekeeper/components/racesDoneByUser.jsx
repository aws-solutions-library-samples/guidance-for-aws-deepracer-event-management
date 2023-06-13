import { FormField, Grid } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GetMaxRunsPerRacerFromId } from '../../../admin/events/support-functions/raceConfig';
import { useRacesContext } from '../../../store/storeProvider';

export const RacesDoneByUser = ({ selecedEvent, selecedUserId }) => {
  const { t } = useTranslation();
  const [races, racesIsLoading] = useRacesContext();
  const [racesDoneByRacer, setRacesDoneByRacer] = useState('-');
  const [maxAllowedRacesPerRacer, setMaxAllowedRacesPerRacer] = useState('-');

  useEffect(() => {
    if (selecedEvent != null) {
      setMaxAllowedRacesPerRacer(GetMaxRunsPerRacerFromId(selecedEvent.raceConfig.maxRunsPerRacer));
    }
  }, [selecedEvent]);

  useEffect(() => {
    console.info(selecedUserId);
    console.info(races);
    if (selecedUserId != null && !racesIsLoading) {
      const numberOfRacesDoneByRacer = races.filter((race) => race.userId === selecedUserId);
      setRacesDoneByRacer(numberOfRacesDoneByRacer.length);
    }
  }, [selecedUserId, racesIsLoading, races]);

  return (
    <FormField label={t('timekeeper.racer-selector.races-by-user')}>
      <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
        <div>{t('timekeeper.racer-selector.number-of-current-races')}</div>
        <div>{racesDoneByRacer}</div>
      </Grid>
      <Grid gridDefinition={[{ colspan: 6 }, { colspan: 6 }]}>
        <div>{t('timekeeper.racer-selector.max-number-of-allowed-races')}</div>
        <div>{maxAllowedRacesPerRacer}</div>
      </Grid>
    </FormField>
  );
};
