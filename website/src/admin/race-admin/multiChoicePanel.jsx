import { ColumnLayout, FormField, SplitPanel } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { convertMsToString } from '../../support-functions/time';
import { calculateMetrics } from './metricCalculations';

const MultiChoicePanel = ({ races }) => {
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
    <SplitPanel
      header={`${races.length} ${t('race-admin.multi-select.header')}`}
      i18nStrings={{
        preferencesTitle: t('common.panel.split-panel-preference-title'),
        preferencesPositionLabel: t('common.panel.split-panel-position-label'),
        preferencesPositionDescription: t('common.panel.split-panel-position-description'),
        preferencesPositionSide: t('common.panel.position-side'),
        preferencesPositionBottom: t('common.panel.position-bottom'),
        preferencesConfirm: t('button.confirm'),
        preferencesCancel: t('button.cancel'),
        closeButtonAriaLabel: t('common.panel.close'),
        openButtonAriaLabel: t('common.panel.open'),
        resizeHandleAriaLabel: t('common.panel.split-panel-rezize-label'),
      }}
    >
      <ColumnLayout columns={4} variant={'text-grid'}>
        <FormField label={t('race-admin.multi-select.total-laps')}>{metrics.totalLaps}</FormField>
        <FormField label={t('race-admin.multi-select.total-resets')}>
          {metrics.totalresets}
        </FormField>
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
        <FormField label={t('race-admin.multi-select.sloweest-lap-time')}>
          {convertMsToString(metrics.slowestLap)}
        </FormField>
      </ColumnLayout>
    </SplitPanel>
  );
};

export { MultiChoicePanel };
