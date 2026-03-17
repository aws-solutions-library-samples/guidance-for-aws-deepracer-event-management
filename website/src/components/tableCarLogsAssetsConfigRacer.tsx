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
  uploadedDateTime: string;
  filename?: string;
}

interface CarLogAssetItem {
  models?: ModelInfo[];
  modelname?: string;
  carName?: string;
  eventName?: string;
  type?: string;
  filename?: string;
  uploadedDateTime?: string;
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
  cell: (item: CarLogAssetItem) => string | ReactNode;
  sortingField?: string;
  width?: number;
  minWidth?: number;
  sortingComparator?: (a: CarLogAssetItem, b: CarLogAssetItem) => number;
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

export const ColumnConfigurationRacer = (): ColumnConfiguration => {
  const returnObject: ColumnConfiguration = {
    defaultVisibleColumns: [
      'modelname',
      'carname',
      'eventname',
      'type',
      'filename',
      'uploadedDateTime',
    ],
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
            id: 'eventname',
            label: i18next.t('carlogs.assets.event-name'),
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
        cell: (item) => {
          if (item.models && item.models.length > 0) {
            if (item.models.length === 1) {
              return item.models[0].modelName || '-';
            }

            // Show multiple model names separated by commas
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
          (a.assetMetaData.filename || '').localeCompare(b.assetMetaData.filename || ''),
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
    ],
  };
  returnObject.defaultSortingColumn = returnObject.columnDefinitions[5]; // uploadedDateTime
  returnObject.defaultSortingIsDescending = true;

  return returnObject;
};

// Default FilterProps unless other is required for a given role
export const FilteringPropertiesRacer = (): FilteringProperty[] => {
  return [
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
  ].sort((a, b) => a.propertyLabel.localeCompare(b.propertyLabel));
};
