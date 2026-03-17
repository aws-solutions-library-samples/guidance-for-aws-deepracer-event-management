import { ReactNode } from 'react';
import i18next from '../i18n';
import { formatAwsDateTime } from '../support-functions/time';
import { CarLogsAssetType } from './assetType';

interface ModelInfo {
  modelName?: string;
}

interface MediaMetaData {
  duration: number;
}

interface AssetMetaData {
  filename: string;
  uploadedDateTime: string;
}

interface CarLogAssetItemOperator {
  username?: string;
  models?: ModelInfo[];
  modelname?: string;
  carName?: string;
  eventName?: string;
  type?: string;
  filename?: string;
  uploadedDateTime?: string;
  fetchJobId?: string;
  mediaMetaData?: MediaMetaData;
  assetMetaData: AssetMetaData;
}

interface ColumnOption {
  id: string;
  label: string;
}

interface VisibleContentOption {
  label: string;
  options: ColumnOption[];
}

interface ColumnDefinition {
  id: string;
  header: string;
  cell: (item: CarLogAssetItemOperator) => string | ReactNode;
  sortingField?: string;
  width?: number;
  minWidth?: number;
  sortingComparator?: (a: CarLogAssetItemOperator, b: CarLogAssetItemOperator) => number;
}

interface ColumnConfiguration {
  defaultVisibleColumns: string[];
  visibleContentOptions: VisibleContentOption[];
  columnDefinitions: ColumnDefinition[];
  defaultSortingColumn?: ColumnDefinition;
  defaultSortingIsDescending?: boolean;
}

interface FilteringProperty {
  key: string;
  propertyLabel: string;
  operators: string[];
}

export const ColumnConfigurationOperator = (): ColumnConfiguration => {
  const returnObject: ColumnConfiguration = {
    defaultVisibleColumns: [
      'username',
      'modelname',
      'carname',
      'eventname',
      'type',
      'uploadedDateTime',
    ],
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
            id: 'eventname',
            label: i18next.t('carlogs.assets.event-name'),
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
        cell: (item) => {
          if (item.models && item.models.length > 0) {
            if (item.models.length === 1) {
              return item.models[0].modelName || '-';
            }

            // Create a tooltip with all model names for multiple models
            return item.models.map((model) => model.modelName).join(', ');
          }
          return '-';
        },
        sortingField: 'modelname',
        sortingComparator: (a, b) => {
          // Compare first model name in each array
          const aName = a.models && a.models.length > 0 ? (a.models[0].modelName || '') : (a.modelname || '');
          const bName = b.models && b.models.length > 0 ? (b.models[0].modelName || '') : (b.modelname || '');
          return aName.localeCompare(bName);
        },
        width: 200,
        minWidth: 150,
      },
      {
        id: 'carname',
        header: i18next.t('carlogs.assets.car-name'),
        cell: (item) => item.carName || '-',
        sortingField: 'carName',
        width: 100,
        minWidth: 75,
      },
      {
        id: 'eventname',
        header: i18next.t('carlogs.assets.event-name'),
        cell: (item) => item.eventName || '-',
        sortingField: 'eventName',
        width: 150,
        minWidth: 100,
      },
      {
        id: 'type',
        header: i18next.t('carlogs.assets.type'),
        cell: (item) => <CarLogsAssetType type={item.type || ''} />,
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
          new Date(a.assetMetaData.uploadedDateTime).getTime() - new Date(b.assetMetaData.uploadedDateTime).getTime(),
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
  returnObject.defaultSortingColumn = returnObject.columnDefinitions[6]; // uploadedDateTime
  returnObject.defaultSortingIsDescending = true;

  return returnObject;
};

export const FilteringPropertiesOperator = (): FilteringProperty[] => {
  return [
    {
      key: 'username',
      propertyLabel: i18next.t('carlogs.assets.user-name'),
      operators: [':', '!:', '=', '!='],
    },
    {
      key: 'carName',
      propertyLabel: i18next.t('carlogs.assets.car-name'),
      operators: [':', '!:', '=', '!='],
    },
    {
      key: 'eventName',
      propertyLabel: i18next.t('carlogs.assets.event-name'),
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
