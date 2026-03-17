import i18next from '../../i18n';
import { formatAwsDateTime } from '../../support-functions/time';
import { TableProps } from '@cloudscape-design/components';
import { Fleet } from '../../types/domain';

/**
 * Table configuration return type
 */
interface TableConfiguration {
  defaultVisibleColumns: string[];
  visibleContentOptions: Array<{
    label: string;
    options: Array<{
      id: string;
      label: string;
    }>;
  }>;
  columnDefinitions: TableProps.ColumnDefinition<Fleet>[];
  defaultSortingColumn: TableProps.ColumnDefinition<Fleet>;
  defaultSortingIsDescending: boolean;
}

/**
 * Generate column configuration for fleets table
 * @param getUserNameFromId - Function to get username from user ID
 * @returns Table configuration object
 */
export const ColumnConfiguration = (
  getUserNameFromId: (userId: string) => string
): TableConfiguration => {
  const columnDefinitions: TableProps.ColumnDefinition<Fleet>[] = [
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
      cell: (item) => (item.createdAt ? formatAwsDateTime(item.createdAt) : '-') || '-',
      sortingField: 'createdAt',
    },
    {
      id: 'createdBy',
      header: i18next.t('fleets.created-by'),
      cell: (item) => getUserNameFromId(item.createdBy || '') || '-',
      sortingField: 'createdBy',
    },
  ];

  const returnObject: TableConfiguration = {
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
    columnDefinitions: columnDefinitions,
    defaultSortingColumn: columnDefinitions[0],
    defaultSortingIsDescending: false,
  };

  return returnObject;
};

/**
 * Filtering property configuration for fleets table
 */
interface FilteringProperty {
  key: string;
  propertyLabel: string;
  operators: string[];
}

/**
 * Generate filtering properties for fleets table
 * @returns Array of filtering property configurations
 */
export const FilteringProperties = (): FilteringProperty[] => {
  return [
    {
      key: 'fleetName',
      propertyLabel: i18next.t('fleets.fleet-name'),
      operators: [':', '!:', '=', '!='],
    },
  ].sort((a, b) => a.propertyLabel.localeCompare(b.propertyLabel));
};
