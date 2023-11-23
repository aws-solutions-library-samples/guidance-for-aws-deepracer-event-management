import i18next from '../i18n';
import { formatAwsDateTime } from '../support-functions/time';
import { ModelUploadStatus } from './modelUploadStatus';

export const ColumnConfigurationRacer = () => {
  return {
    defaultVisibleColumns: ['modelname', 'status', 'uploadedDateTime'],
    visibleContentOptions: [
      {
        label: i18next.t('models.model-information'),
        options: [
          {
            id: 'modelname',
            label: i18next.t('models.model-name'),
          },
          {
            id: 'status',
            label: i18next.t('models.status'),
          },
          {
            id: 'uploadedDateTime',
            label: i18next.t('models.upload-date'),
          },
          {
            id: 'sensor',
            label: i18next.t('models.sensor'),
          },
          {
            id: 'actionSpaceType',
            label: i18next.t('models.action-space-type'),
          },
          {
            id: 'trainingAlgorithm',
            label: i18next.t('models.training-algorithm'),
          },
        ],
      },
    ],
    columnDefinitions: [
      {
        id: 'modelname',
        header: i18next.t('models.model-name'),
        cell: (item) => item.modelname || '-',
        sortingField: 'modelname',
        width: 200,
        minWidth: 150,
      },
      {
        id: 'status',
        header: i18next.t('models.status'),
        cell: (item) => <ModelUploadStatus status={item.status} /> || '-',
        sortingField: 'status',
        width: 200,
        minWidth: 150,
      },
      {
        id: 'uploadedDateTime',
        header: i18next.t('models.upload-date'),
        cell: (item) => formatAwsDateTime(item.fileMetaData.uploadedDateTime) || '-',
        //sortingField: 'uploadedDateTime',
        width: 240,
        minWidth: 150,
      },
      {
        id: 'sensor',
        header: i18next.t('models.sensor'),
        cell: (item) => item.modelMetaData.sensor.join(',') || '-',
        width: 200,
        minWidth: 150,
      },
      {
        id: 'actionSpaceType',
        header: i18next.t('models.action-space-type'),
        cell: (item) => item.modelMetaData.actionSpaceType || '-',
        width: 200,
        minWidth: 150,
      },
      {
        id: 'trainingAlgorithm',
        header: i18next.t('models.training-algorithm'),
        cell: (item) => item.modelMetaData.trainingAlgorithm || '-',
        width: 200,
        minWidth: 150,
      },
    ],
  };
};

// Default FilterProps unless other is required for a given role
export const FilteringPropertiesRacer = () => {
  return [
    {
      key: 'modelname',
      propertyLabel: i18next.t('models.model-name'),
      operators: [':', '!:', '=', '!='],
    },
  ].sort((a, b) => a.propertyLabel.localeCompare(b.propertyLabel));
};
