import { FormField, Grid } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GetMaxRunsPerRacerFromId } from '../../../admin/events/support-functions/raceConfig';
import { useStore } from '../../../store/store';
import { Event } from '../../../types/domain';

/**
 * Props interface for RacesDoneByUser component
 */
interface RacesDoneByUserProps {
  /** Selected event object */
  selecedEvent: Event | null;
  /** Selected user ID */
  selecedUserId: string | null;
}

/**
 * RacesDoneByUser component that displays race statistics for a specific user
 * @param props - Component props
 * @returns Rendered form field with race counts
 */
export const RacesDoneByUser = ({ selecedEvent, selecedUserId }: RacesDoneByUserProps): JSX.Element => {
  const { t } = useTranslation();
  const [racesDoneByRacer, setRacesDoneByRacer] = useState<number | string>('-');
  const [maxAllowedRacesPerRacer, setMaxAllowedRacesPerRacer] = useState<number | string>('-');
  const [state] = useStore();
  const races = state.races?.races;
  const racesIsLoading = state.races?.isLoading;

  useEffect(() => {
    if (selecedEvent != null && selecedEvent.raceConfig) {
      // Access maxRunsPerRacer - this property exists in runtime but may not be in type definition
      const raceConfig = selecedEvent.raceConfig as any;
      if (raceConfig.maxRunsPerRacer !== undefined) {
        setMaxAllowedRacesPerRacer(GetMaxRunsPerRacerFromId(raceConfig.maxRunsPerRacer));
      }
    }
  }, [selecedEvent]);

  useEffect(() => {
    console.info(selecedUserId);
    console.info(races);
    if (selecedUserId != null && !racesIsLoading && races) {
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
