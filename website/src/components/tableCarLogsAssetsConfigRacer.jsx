import i18next from '../i18n';
import { formatAwsDateTime } from '../support-functions/time';
import { CarLogsAssetType } from './assetType';

export const ColumnConfigurationRacer = () => {
  var returnObject = {
    defaultVisibleColumns: ['modelname', 'carname', 'type', 'filename', 'uploadedDateTime'],
    visibleContentOptions: [
      {
        label: i18next.t('carlogs.assets.model-information'),
        options: [
          {
            id: 'modelname',
            label: i18next.t('carlogs.assets.model-name'),
          },
          {
            id: 'carname',
            label: i18next.t('carlogs.assets.car-name'),
          },
          {
            id: 'type',
            label: i18next.t('carlogs.assets.status'),
          },
          {
            id: 'filename',
            label: i18next.t('carlogs.assets.filename'),
          },
          {
            id: 'uploadedDateTime',
            label: i18next.t('carlogs.assets.upload-date'),
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
        cell: (item) => <CarLogsAssetType type={item.type} /> || '-',
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
    ],
  };
  returnObject.defaultSortingColumn = returnObject.columnDefinitions[4]; // uploadedDateTime
  returnObject.defaultSortingIsDescending = true;

  return returnObject;
};

// Default FilterProps unless other is required for a given role
export const FilteringPropertiesRacer = () => {
  return [
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
  ].sort((a, b) => a.propertyLabel.localeCompare(b.propertyLabel));
};
