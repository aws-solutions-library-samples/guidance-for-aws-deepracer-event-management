import { StatusIndicator } from '@cloudscape-design/components';
import i18next from '../../../i18n';
import { formatAwsDateTime } from '../../../support-functions/time';

export const ModelStatus = ({ status }) => {
  if (status === 'UPLOADED')
    return <StatusIndicator type="pending">Virus scan ongoing</StatusIndicator>;
  else if (status === 'AVAILABLE')
    return <StatusIndicator type="success">Available</StatusIndicator>;
  else if (status === 'QUARANTINED')
    return <StatusIndicator type="warning">Virus detected</StatusIndicator>;
  else if (status === 'OPTIMIZED')
    return <StatusIndicator type="warning">Available and Optimized</StatusIndicator>;
  else if (status === 'NOT_VALID')
    return <StatusIndicator type="error">Not a valid model file</StatusIndicator>;
  else return '-';
};

export const VisibleContentOptions = () => {
  return [
    {
      label: i18next.t('models.model-information'),
      options: [
        {
          id: 'modelId',
          label: i18next.t('models.model-id'),
        },
        {
          id: 'userName',
          label: i18next.t('models.user-name'),
        },
        {
          id: 'modelName',
          label: i18next.t('models.model-name'),
        },
        {
          id: 'modelDate',
          label: i18next.t('models.upload-date'),
        },
        {
          id: 'modelMD5Hash',
          label: i18next.t('models.md5-hash'),
        },
        {
          id: 'status',
          label: i18next.t('models.status'),
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
          label: i18next.t('models.traning-algorithm'),
        },
      ],
    },
  ];
};

export function ColumnsConfig() {
  const rowHeaders = [
    {
      id: 'userName',
      header: i18next.t('models.user-name'),
      cell: (item) => item.racerName || '-',
      sortingField: 'userName',
      width: 200,
      minWidth: 150,
    },
    {
      id: 'modelName',
      header: i18next.t('models.model-name'),
      cell: (item) => item.fileMetaData.filename || '-',
      sortingField: 'modelName',
      width: 200,
      minWidth: 150,
    },
    {
      id: 'status',
      header: i18next.t('models.status'),
      cell: (item) => <ModelStatus status={item.status} />,
      sortingField: 'status',
      width: 200,
      minWidth: 150,
    },
    {
      id: 'modelDate',
      header: i18next.t('models.upload-date'),
      cell: (item) => formatAwsDateTime(item.fileMetaData.uploadedDateTime) || '-',
      sortingField: 'modelDate',
      width: 240,
      minWidth: 150,
    },

    {
      id: 'modelMD5Hash',
      header: i18next.t('models.md5-hash'),
      cell: (item) => item.modelMD5,
      width: 200,
      minWidth: 150,
    },
    {
      id: 'sensor',
      header: i18next.t('models.sensor'),
      cell: (item) => item.modelMetaData.sensor,
      width: 200,
      minWidth: 150,
    },
    {
      id: 'actionSpaceType',
      header: i18next.t('models.action-space-type'),
      cell: (item) => item.modelMetaData.actionSpaceType,
      width: 200,
      minWidth: 150,
    },
    {
      id: 'trainingAlgorithm',
      header: i18next.t('models.traning-algorithm'),
      cell: (item) => item.modelMetaData.trainingAlgorithm,
      width: 200,
      minWidth: 150,
    },
  ];
  return rowHeaders;
}
