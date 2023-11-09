import { ColumnLayout, FormField } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { convertMsToString } from '../../../support-functions/time';
import { calculateMetrics } from '../support-functions/metricCalculations';

export const MultiChoicePanelContent = ({ races }) => {
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState({
    laps: undefined,
    resets: undefined,
    avgLapsPerRace: undefined,
  });

  useEffect(() => {
    setMetrics(calculateMetrics(races));
  }, [races]);
  // JSX
  return (
    <ColumnLayout columns={4} variant={'text-grid'}>
      <FormField label={t('race-admin.multi-select.total-laps')}>{metrics.totalLaps}</FormField>
      <FormField label={t('race-admin.multi-select.total-resets')}>{metrics.totalresets}</FormField>
      <FormField label={t('race-admin.multi-select.avg-resets-per-lap')}>
        {metrics.avgresestsPerLap}
      </FormField>
      <FormField label={t('race-admin.multi-select.avg-laps-per-race')}>
        {metrics.avgLapsPerRace}
      </FormField>
      <FormField label={t('race-admin.multi-select.avg-lap-time')}>
        {convertMsToString(metrics.avgLapTime)}
      </FormField>
      <FormField label={t('race-admin.multi-select.fastest-lap-time')}>
        {convertMsToString(metrics.fastestLap)}
      </FormField>
      <FormField label={t('race-admin.multi-select.slowest-lap-time')}>
        {convertMsToString(metrics.slowestLap)}
      </FormField>
      <FormField label={t('race-admin.multi-select.unique-racer-count')}>
        {metrics.numberOfUniqueRacers}
      </FormField>
      <FormField label={t('race-admin.multi-select.number-of-races')}>
        {metrics.numberOfRaces}
      </FormField>
      <FormField label={t('race-admin.multi-select.most-races-by-user')}>
        {metrics.mostNumberOfRacesByUser}
      </FormField>
      <FormField label={t('race-admin.multi-select.avg-no-of-races-by-users')}>
        {metrics.avgRacesPerUser}
      </FormField>
    </ColumnLayout>
  );
};
