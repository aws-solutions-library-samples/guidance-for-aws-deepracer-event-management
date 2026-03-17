import { ColumnLayout, FormField } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { convertMsToString } from '../../../support-functions/time';
import { calculateMetrics, RaceMetrics } from '../support-functions/metricCalculations';
import { Race } from '../../../types/domain';

/**
 * Props interface for MultiChoicePanelContent component
 */
interface MultiChoicePanelContentProps {
  /** Array of selected races to calculate metrics for */
  races: Race[];
}

/**
 * MultiChoicePanelContent component that displays aggregated metrics for multiple races
 * @param props - Component props
 * @returns Rendered metrics panel
 */
export const MultiChoicePanelContent = ({ races }: MultiChoicePanelContentProps): JSX.Element => {
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState<RaceMetrics>({
    totalLaps: null,
    totalresets: null,
    avgresestsPerLap: null,
    avgLapsPerRace: null,
    avgLapTime: null,
    fastestLap: null,
    slowestLap: null,
    numberOfUniqueRacers: null,
    numberOfRaces: null,
    mostNumberOfRacesByUser: null,
    avgRacesPerUser: null,
  });

  useEffect(() => {
    setMetrics(calculateMetrics(races));
  }, [races]);
  // JSX
  return (
    <ColumnLayout columns={4} variant={'text-grid'}>
      <FormField label={t('race-admin.multi-select.total-laps')}>{metrics.totalLaps}</FormField>
      <FormField label={t('race-admin.multi-select.total-resets')}>{metrics.totalresets}</FormField>
      <FormField label={t('race-admin.multi-select.avg-resets-per-lap')}>{metrics.avgresestsPerLap}</FormField>
      <FormField label={t('race-admin.multi-select.avg-laps-per-race')}>{metrics.avgLapsPerRace}</FormField>
      <FormField label={t('race-admin.multi-select.avg-lap-time')}>
        {metrics.avgLapTime !== null ? convertMsToString(metrics.avgLapTime) : '-'}
      </FormField>
      <FormField label={t('race-admin.multi-select.fastest-lap-time')}>
        {metrics.fastestLap !== null ? convertMsToString(metrics.fastestLap) : '-'}
      </FormField>
      <FormField label={t('race-admin.multi-select.slowest-lap-time')}>
        {metrics.slowestLap !== null ? convertMsToString(metrics.slowestLap) : '-'}
      </FormField>
      <FormField label={t('race-admin.multi-select.unique-racer-count')}>{metrics.numberOfUniqueRacers}</FormField>
      <FormField label={t('race-admin.multi-select.number-of-races')}>{metrics.numberOfRaces}</FormField>
      <FormField label={t('race-admin.multi-select.most-races-by-user')}>
        {metrics.mostNumberOfRacesByUser}
      </FormField>
      <FormField label={t('race-admin.multi-select.avg-no-of-races-by-users')}>
        {metrics.avgRacesPerUser}
      </FormField>
    </ColumnLayout>
  );
};
