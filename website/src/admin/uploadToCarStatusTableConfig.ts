import { useTranslation } from 'react-i18next';
import { formatAwsDateTime } from '../support-functions/time';

interface UploadToCarStatusItem {
  statusIndicator?: string;
  modelKey: string;
  carName?: string;
  startTime?: string;
  uploadStartTime?: string;
  endTime?: string;
  duration?: string;
  jobId?: string;
  Status?: string;
}

interface ColumnOption {
  id: string;
  label: string;
  editable?: boolean;
}

interface VisibleContentOption {
  label: string;
  options: ColumnOption[];
}

interface ColumnDefinition {
  id: string;
  header: string;
  cell: (item: UploadToCarStatusItem) => string;
  sortingField: string;
  width: number;
  minWidth: number;
}

interface ColumnConfigurationReturn {
  defaultVisibleColumns: string[];
  visibleContentOptions: VisibleContentOption[];
  columnDefinitions: ColumnDefinition[];
  defaultSortingColumn: ColumnDefinition;
  defaultSortingIsDescending: boolean;
}

interface FilteringProperty {
  key: string;
  propertyLabel: string;
  operators: string[];
}

export const ColumnConfiguration = (): ColumnConfigurationReturn => {
  const { t } = useTranslation();
  const returnObject: ColumnConfigurationReturn = {
    defaultVisibleColumns: [
      'Status',
      'modelKey',
      'carName',
      'startTime',
      'uploadStartTime',
      'endTime',
      'duration',
    ],
    visibleContentOptions: [
      {
        label: t('cars.car-information'),
        options: [
          {
            id: 'Status',
            label: t('carmodelupload.status'),
            editable: true,
          },
          {
            id: 'modelKey',
            label: t('carmodelupload.modelname'),
            editable: true,
          },
          {
            id: 'carName',
            label: t('carmodelupload.carName'),
            editable: true,
          },
          {
            id: 'startTime',
            label: t('carmodelupload.startTime'),
          },
          {
            id: 'uploadStartTime',
            label: t('carmodelupload.uploadStartTime'),
          },
          {
            id: 'endTime',
            label: t('carmodelupload.endTime'),
          },
          {
            id: 'duration',
            label: t('carmodelupload.duration'),
          },
          {
            id: 'jobId',
            label: t('carmodelupload.jobId'),
          },
        ],
      },
    ],
    columnDefinitions: [
      {
        id: 'Status',
        header: t('carmodelupload.status'),
        cell: (item) => item.statusIndicator || '-',
        sortingField: 'Status',
        width: 140,
        minWidth: 140,
      },
      {
        id: 'modelKey',
        header: t('carmodelupload.modelname'),
        cell: (item) => item.modelKey.split('/')[item.modelKey.split('/').length - 1] || '-',
        sortingField: 'modelKey',
        width: 200,
        minWidth: 200,
      },
      {
        id: 'carName',
        header: t('carmodelupload.carName'),
        cell: (item) => item.carName || '-',
        sortingField: 'carName',
        width: 150,
        minWidth: 150,
      },
      {
        id: 'startTime',
        header: t('carmodelupload.startTime'),
        cell: (item) => formatAwsDateTime(item.startTime) || '-',
        sortingField: 'startTime',
        width: 220,
        minWidth: 220,
      },
      {
        id: 'uploadStartTime',
        header: t('carmodelupload.uploadStartTime'),
        cell: (item) => formatAwsDateTime(item.uploadStartTime) || '-',
        sortingField: 'uploadStartTime',
        width: 220,
        minWidth: 220,
      },
      {
        id: 'endTime',
        header: t('carmodelupload.endTime'),
        cell: (item) => formatAwsDateTime(item.endTime) || '-',
        sortingField: 'endTime',
        width: 220,
        minWidth: 220,
      },
      {
        id: 'duration',
        header: t('carmodelupload.duration'),
        cell: (item) => item.duration || '-',
        sortingField: 'duration',
        width: 150,
        minWidth: 150,
      },
      {
        id: 'jobId',
        header: t('carmodelupload.jobId'),
        cell: (item) => item.jobId || '-',
        sortingField: 'jobId',
        width: 220,
        minWidth: 220,
      },
    ],
    defaultSortingColumn: {} as ColumnDefinition, // Will be set below
    defaultSortingIsDescending: true,
  };

  returnObject.defaultSortingColumn = returnObject.columnDefinitions[3];

  return returnObject;
};

export const FilteringProperties = (): FilteringProperty[] => {
  const { t } = useTranslation();
  return [
    // {
    //   key: 'Status',
    //   propertyLabel: t('carmodelupload.status'),
    //   operators: [':', '!:', '=', '!='],
    // },
    {
      key: 'modelKey',
      propertyLabel: t('carmodelupload.modelname'),
      operators: [':', '!:', '=', '!='],
    },
    {
      key: 'carName',
      propertyLabel: t('carmodelupload.carName'),
      operators: [':', '!:', '=', '!='],
    },
  ].sort((a, b) => a.propertyLabel.localeCompare(b.propertyLabel));
};
