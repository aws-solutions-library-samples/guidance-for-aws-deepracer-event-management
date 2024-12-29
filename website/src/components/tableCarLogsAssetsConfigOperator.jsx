import i18next from '../i18n';
import { formatAwsDateTime } from '../support-functions/time';
import { CarLogsAssetType } from './assetType';

export const ColumnConfigurationOperator = () => {
  var returnObject = {
    defaultVisibleColumns: ['username', 'modelname', 'type', 'uploadedDateTime'],
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
        id: 'type',
        header: i18next.t('carlogs.assets.type'),
        cell: (item) => <CarLogsAssetType type={item.type} />,
        sortingField: 'status',
        width: 200,
        minWidth: 150,
      },
      {
        id: 'filename',
        header: i18next.t('carlogs.assets.filename'),
        cell: (item) => item.assetMetaData.filename || '-',
        width: 240,
        minWidth: 150,
      },
      {
        id: 'uploadedDateTime',
        header: i18next.t('carlogs.assets.upload-date'),
        cell: (item) => String(formatAwsDateTime(item.assetMetaData.uploadedDateTime)) || '-',
        width: 240,
        minWidth: 150,
      },
    ],
  };
  returnObject.defaultSortingColumn = returnObject.columnDefinitions[0]; // uploadedDateTime
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
      key: 'type',
      propertyLabel: i18next.t('carlogs.assets.type'),
      operators: [':', '!:', '=', '!='],
    },
  ].sort((a, b) => a.propertyLabel.localeCompare(b.propertyLabel));
};
