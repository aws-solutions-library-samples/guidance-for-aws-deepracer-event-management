import i18next from '../i18n';
import { formatAwsDateTime } from '../support-functions/time';
import { CarLogsAssetType } from './assetType';

export const ColumnConfigurationOperator = () => {
  var returnObject = {
    defaultVisibleColumns: ['username', 'modelname', 'carname', 'type', 'uploadedDateTime'],
    visibleContentOptions: [
      {
        label: i18next.t('carlogs.assets.model-information'),
        options: [
          {
            id: 'username',
            label: i18next.t('carlogs.assets.user-name'),
          },
          {
            id: 'modelname',
            label: i18next.t('carlogs.assets.model-name'),
          },
          {
            id: 'carname',
            label: i18next.t('carlogs.assets.car-name'),
          },
          {
            id: 'filename',
            label: i18next.t('carlogs.assets.filename'),
          },
          {
            id: 'type',
            label: i18next.t('carlogs.assets.type'),
          },
          {
            id: 'uploadedDateTime',
            label: i18next.t('carlogs.assets.upload-date'),
          },
          {
            id: 'fetchjobid',
            label: i18next.t('carlogs.assets.fetch-job-id'),
          },
          {
            id: 'duration',
            label: i18next.t('carlogs.assets.duration'),
          },
        ],
      },
    ],
    columnDefinitions: [
      {
        id: 'username',
        header: i18next.t('carlogs.assets.user-name'),
        cell: (item) => item.username || '-',
        sortingField: 'username',
        width: 200,
        minWidth: 150,
      },
      {
        id: 'modelname',
        header: i18next.t('carlogs.assets.model-name'),
        cell: (item) => item.modelname || '-',
        sortingField: 'modelname',
        width: 200,
        minWidth: 150,
      },
      {
        id: 'carname',
        header: i18next.t('carlogs.assets.car-name'),
        cell: (item) => item.carName || '-',
        sortingField: 'carName',
        width: 200,
        minWidth: 150,
      },
      {
        id: 'type',
        header: i18next.t('carlogs.assets.type'),
        cell: (item) => <CarLogsAssetType type={item.type} />,
        sortingField: 'type',
        width: 200,
        minWidth: 150,
      },
      {
        id: 'filename',
        header: i18next.t('carlogs.assets.filename'),
        cell: (item) => item.assetMetaData.filename || '-',
        sortingField: 'filename',
        sortingComparator: (a, b) =>
          a.assetMetaData.filename.localeCompare(b.assetMetaData.filename),
        width: 240,
        minWidth: 150,
      },
      {
        id: 'uploadedDateTime',
        header: i18next.t('carlogs.assets.upload-date'),
        cell: (item) => String(formatAwsDateTime(item.assetMetaData.uploadedDateTime)) || '-',
        sortingField: 'uploadedDateTime',
        sortingComparator: (a, b) =>
          new Date(a.assetMetaData.uploadedDateTime) - new Date(b.assetMetaData.uploadedDateTime),
        width: 240,
        minWidth: 150,
      },
      {
        id: 'duration',
        header: i18next.t('carlogs.assets.duration'),
        cell: (item) =>
          item.mediaMetaData
            ? `${Math.floor(item.mediaMetaData.duration / 60)}m ${Math.floor(item.mediaMetaData.duration % 60)}s`
            : '-',
        sortingField: 'duration',
        sortingComparator: (a, b) =>
          (a.mediaMetaData ? a.mediaMetaData.duration : 0) -
          (b.mediaMetaData ? b.mediaMetaData.duration : 0),
        width: 100,
        minWidth: 75,
      },
      {
        id: 'fetchjobid',
        header: i18next.t('carlogs.assets.fetch-job-id'),
        cell: (item) => item.fetchJobId || '-',
        sortingField: 'fetchJobId',
        width: 200,
        minWidth: 150,
      },
    ],
  };
  returnObject.defaultSortingColumn = returnObject.columnDefinitions[5]; // uploadedDateTime
  returnObject.defaultSortingIsDescending = true;

  return returnObject;
};

export const FilteringPropertiesOperator = () => {
  return [
    {
      key: 'username',
      propertyLabel: i18next.t('carlogs.assets.user-name'),
      operators: [':', '!:', '=', '!='],
    },
    {
      key: 'modelname',
      propertyLabel: i18next.t('carlogs.assets.model-name'),
      operators: [':', '!:', '=', '!='],
    },
    {
      key: 'carname',
      propertyLabel: i18next.t('carlogs.assets.car-name'),
      operators: [':', '!:', '=', '!='],
    },
    {
      key: 'type',
      propertyLabel: i18next.t('carlogs.assets.type'),
      operators: [':', '!:', '=', '!='],
    },
    {
      key: 'uploadedDateTime',
      propertyLabel: i18next.t('carlogs.assets.upload-date'),
      operators: ['<', '>', '=', '!='],
    },
    {
      key: 'fetchJobId',
      propertyLabel: i18next.t('carlogs.assets.fetch-job-id'),
      operators: [':', '!:', '=', '!='],
    },
  ].sort((a, b) => a.propertyLabel.localeCompare(b.propertyLabel));
};
