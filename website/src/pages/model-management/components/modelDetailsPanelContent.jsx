import { Box, ColumnLayout, SpaceBetween } from '@cloudscape-design/components';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatAwsDateTime } from '../../../support-functions/time';
import { ModelStatus } from './modelsTableConfig';
//import { GetTypeOfEventNameFromId } from '../support-functions/eventDomain';
// import {
//   GetRaceResetsNameFromId,
//   GetRankingNameFromId,
//   GetTrackTypeNameFromId,
// } from '../support-functions/raceConfig';

export const ModelDetailsPanelContent = ({ model }) => {
  const { t } = useTranslation();

  const attributeField = (header, value) => {
    return (
      <SpaceBetween size="xxxs">
        <Box fontWeight="bold">{header}:</Box>
        <div>{value ?? '-'}</div>
      </SpaceBetween>
    );
  };

  const ModelMetaData = ({ model }) => {
    console.info(model);
    if (model.modelMetaData == null) {
      return (
        <ColumnLayout columns={4} variant="text-grid">
          {attributeField(t('models.traning-algorithm'), '-')}
          {attributeField(t('models.action-space-type'), '-')}
          {attributeField(t('models.sensor'), '-')}
        </ColumnLayout>
      );
    } else {
      return (
        <ColumnLayout columns={4} variant="text-grid">
          {attributeField(t('models.traning-algorithm'), model.modelMetaData.trainingAlgorithm)}
          {attributeField(t('models.action-space-type'), model.modelMetaData.actionSpaceType)}
          {attributeField(t('models.sensor'), model.modelMetaData.sensor)}
        </ColumnLayout>
      );
    }
  };
  // JSX
  console.info(model);
  return (
    <>
      <ColumnLayout columns={4} variant="text-grid">
        {attributeField(t('models.model-name'), model.fileMetaData.filename)}
        {attributeField(t('models.status'), <ModelStatus status={model.status} />)}
        {attributeField(
          t('models.upload-date'),
          formatAwsDateTime(model.fileMetaData.uploadedDateTime)
        )}
        {attributeField(t('models.md5-hash'), model.modelMD5)}
      </ColumnLayout>
      <ModelMetaData model={model} />
    </>
  );
};
