import i18next from '../i18n';
import { formatAwsDateTime } from '../support-functions/time';
import { ModelUploadStatus } from './modelUploadStatus';

export const ColumnConfigurationOperator = () => {
  var returnObject = {
    defaultVisibleColumns: ['username', 'modelname', 'status', 'uploadedDateTime'],
    visibleContentOptions: [
      {
        label: i18next.t('models.model-information'),
        options: [
          {
            id: 'modelId',
            label: i18next.t('models.model-id'),
          },
          {
            id: 'username',
            label: i18next.t('models.user-name'),
          },
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
            id: 'modelMD5Hash',
            label: i18next.t('models.md5-hash'),
          },
          {
            id: 'modelMetadataMD5Hash',
            label: i18next.t('models.md5-hash-metadata'),
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
          // {
          //   id: 'modelS3Key',
          //   label: i18next.t('models.model-s3-key'),
          // },
        ],
      },
    ],
    columnDefinitions: [
      {
        id: 'modelId',
        header: i18next.t('models.model-id'),
        cell: (item) => item.modelId,
        width: 320,
      },
      {
        id: 'username',
        header: i18next.t('models.user-name'),
        cell: (item) => item.username || '-',
        sortingField: 'username',
        width: 200,
        minWidth: 150,
      },
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
        cell: (item) => <ModelUploadStatus status={item.status} />,
        sortingField: 'status',
        width: 200,
        minWidth: 150,
      },
      {
        id: 'uploadedDateTime',
        header: i18next.t('models.upload-date'),
        cell: (item) => String(formatAwsDateTime(item.fileMetaData.uploadedDateTime)) || '-',
        sortingField: 'uploadedDateTime',
        width: 240,
        minWidth: 150,
        sortingComparator: (a, b) =>
          new Date(a.fileMetaData.uploadedDateTime) - new Date(b.fileMetaData.uploadedDateTime),
      },
      {
        id: 'modelMD5Hash',
        header: i18next.t('models.md5-hash'),
        cell: (item) => item.modelMD5 || '-',
        width: 200,
        minWidth: 150,
      },
      {
        id: 'modelMetadataMD5Hash',
        header: i18next.t('models.md5-hash-metadata'),
        cell: (item) => item.modelMetaData.metadataMd5 || '-',
        width: 200,
        minWidth: 150,
        sortingComparator: (a, b) =>
          (a.modelMetaData.metadataMd5 || '').localeCompare(b.modelMetaData.metadataMd5 || ''),
      },
      {
        id: 'sensor',
        header: i18next.t('models.sensor'),
        cell: (item) => item.modelMetaData.sensor.join(',') || '-',
        width: 200,
        minWidth: 150,
        sortingComparator: (a, b) =>
          (a.modelMetaData.sensor.join(',') || '').localeCompare(
            b.modelMetaData.sensor.join(',') || ''
          ),
      },
      {
        id: 'actionSpaceType',
        header: i18next.t('models.action-space-type'),
        cell: (item) => item.modelMetaData.actionSpaceType || '-',
        width: 200,
        minWidth: 150,
        sortingComparator: (a, b) =>
          (a.modelMetaData.actionSpaceType || '').localeCompare(
            b.modelMetaData.actionSpaceType || ''
          ),
      },
      {
        id: 'trainingAlgorithm',
        header: i18next.t('models.training-algorithm'),
        cell: (item) => item.modelMetaData.trainingAlgorithm || '-',
        width: 200,
        minWidth: 150,
        sortingComparator: (a, b) =>
          (a.modelMetaData.trainingAlgorithm || '').localeCompare(
            b.modelMetaData.trainingAlgorithm || ''
          ),
      },
    ],
  };
  returnObject.defaultSortingColumn = returnObject.columnDefinitions[4]; // uploadedDateTime
  returnObject.defaultSortingIsDescending = true;

  return returnObject;
};

export const FilteringPropertiesOperator = () => {
  return [
    {
      key: 'username',
      propertyLabel: i18next.t('models.user-name'),
      operators: [':', '!:', '=', '!='],
    },
    {
      key: 'modelname',
      propertyLabel: i18next.t('models.model-name'),
      operators: [':', '!:', '=', '!='],
    },
    {
      key: 'status',
      propertyLabel: i18next.t('models.status'),
      operators: [':', '!:', '=', '!='],
    },
  ].sort((a, b) => a.propertyLabel.localeCompare(b.propertyLabel));
};
