import i18next from '../../i18n';
import { formatAwsDateTime } from '../../support-functions/time';

export const ColumnConfiguration = (getUserNameFromId) => {
  var returnObject = {
    defaultVisibleColumns: ['fleetName', 'createdAt', 'createdBy'],
    visibleContentOptions: [
      {
        label: i18next.t('fleets.fleet-information'),
        options: [
          {
            id: 'fleetName',
            label: i18next.t('fleets.fleet-name'),
          },
          {
            id: 'fleetId',
            label: i18next.t('fleets.fleet-id'),
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
    ],
    columnDefinitions: [
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
    ],
  };
  returnObject.defaultSortingColumn = returnObject.columnDefinitions[0]; // uploadedDateTime
  returnObject.defaultSortingIsDescending = false;

  return returnObject;
};

export const FilteringProperties = () => {
  return [
    {
      key: 'fleetName',
      propertyLabel: i18next.t('fleets.fleet-name'),
      operators: [':', '!:', '=', '!='],
    },
  ].sort((a, b) => a.propertyLabel.localeCompare(b.propertyLabel));
};
