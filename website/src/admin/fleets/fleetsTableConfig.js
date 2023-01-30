import i18next from '../../i18n';

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
      ],
    },
  ];
};

export const ColumnDefinitions = () => {
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
      cell: (item) => item.createdAt || '-',
      sortingField: 'createdAt',
    },
  ];
};
