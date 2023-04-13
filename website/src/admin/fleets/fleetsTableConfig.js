import i18next from '../../i18n';
import { formatAwsDateTime } from '../../support-functions/time';

export const VisibleContentOptions = () => {
  return [
    {
      label: i18next.t('fleets.fleet-information'),
      options: [
        {
          id: 'fleetName',
          label: i18next.t('fleets.fleet-name'),
        },
        {
          id: 'eventDate',
          label: i18next.t('fleets.fleet-id'),
          editable: false,
        },
        {
          id: 'createdAt',
          label: i18next.t('fleets.created-at'),
        },
        {
          id: 'createdBy',
          label: i18next.t('fleets.created-by'),
        },
      ],
    },
  ];
};

export const ColumnDefinitions = (getUserNameFromId) => {
  return [
    {
      id: 'fleetName',
      header: i18next.t('fleets.fleet-name'),
      cell: (item) => item.fleetName || '-',
      sortingField: 'fleetName',
    },
    {
      id: 'fleetId',
      header: i18next.t('fleets.fleet-id'),
      cell: (item) => item.fleetId || '-',
    },
    {
      id: 'createdAt',
      header: i18next.t('fleets.created-at'),
      cell: (item) => formatAwsDateTime(item.createdAt) || '-',
      sortingField: 'createdAt',
    },
    {
      id: 'createdBy',
      header: i18next.t('fleets.created-by'),
      cell: (item) => getUserNameFromId(item.createdBy) || '-',
      sortingField: 'createdBy',
    },
  ];
};
