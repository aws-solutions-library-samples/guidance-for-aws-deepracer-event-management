import { Box, ColumnLayout, SpaceBetween } from '@cloudscape-design/components';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatAwsDateTime } from '../../../support-functions/time';

interface ModelMetaData {
  trainingAlgorithm?: string;
  actionSpaceType?: string;
  sensor?: string;
}

interface FileMetaData {
  filename: string;
  uploadedDateTime: string;
}

interface ModelDetails {
  fileMetaData: FileMetaData;
  status: string;
  modelMD5?: string;
  modelMetaData?: ModelMetaData | null;
}

interface ModelDetailsPanelContentProps {
  model: ModelDetails;
}

export const ModelDetailsPanelContent: React.FC<ModelDetailsPanelContentProps> = ({ model }) => {
  const { t } = useTranslation();

  const attributeField = (header: string, value: React.ReactNode): JSX.Element => {
    return (
      <SpaceBetween size="xxxs">
        <Box fontWeight="bold">{header}:</Box>
        <div>{value ?? '-'}</div>
      </SpaceBetween>
    );
  };

  const ModelMetaDataDisplay: React.FC<{ model: ModelDetails }> = ({ model }) => {
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

  console.info(model);
  return (
    <>
      <ColumnLayout columns={4} variant="text-grid">
        {attributeField(t('models.model-name'), model.fileMetaData.filename)}
        {attributeField(t('models.status'), model.status)}
        {attributeField(
          t('models.upload-date'),
          formatAwsDateTime(model.fileMetaData.uploadedDateTime)
        )}
        {attributeField(t('models.md5-hash'), model.modelMD5)}
      </ColumnLayout>
      <ModelMetaDataDisplay model={model} />
    </>
  );
};
