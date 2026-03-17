import { TableProps } from '@cloudscape-design/components';
import i18next from '../../../i18n';
import { formatAwsDateTime } from '../../../support-functions/time';
import { Race } from '../../../types/domain';

interface VisibleContentOption {
  id: string;
  label: string;
}

interface VisibleContentGroup {
  label: string;
  options: VisibleContentOption[];
}

interface TableConfiguration {
  defaultVisibleColumns: string[];
  visibleContentOptions: VisibleContentGroup[];
  columnDefinitions: TableProps.ColumnDefinition<Race>[];
}

export const ColumnConfiguration = (): TableConfiguration => {
  return {
    defaultVisibleColumns: ['createdAt', 'username', 'trackId', 'numberOfLaps'],
    visibleContentOptions: [
      {
        label: i18next.t('race-admin.information'),
        options: [
          {
            id: 'createdAt',
            label: i18next.t('race-admin.created-at'),
          },
          {
            id: 'username',
            label: i18next.t('race-admin.username'),
          },
          {
            id: 'userId',
            label: i18next.t('race-admin.user-id'),
          },
          {
            id: 'raceId',
            label: i18next.t('race-admin.race-id'),
          },
          {
            id: 'racedByProxy',
            label: i18next.t('race-admin.raced-by-proxy'),
          },
          {
            id: 'trackId',
            label: i18next.t('race-admin.track-id'),
          },
          {
            id: 'numberOfLaps',
            label: i18next.t('race-admin.number-of-laps'),
          },
        ],
      },
    ],
    columnDefinitions: [
      {
        id: 'createdAt',
        header: i18next.t('race-admin.created-at'),
        cell: (item) => formatAwsDateTime(item.createdAt) || '-',
        sortingField: 'createdAt',
        width: 250,
      },
      {
        id: 'username',
        header: i18next.t('race-admin.username'),
        cell: (item) => item.username || '-',
        sortingField: 'username',
        width: 200,
      },
      {
        id: 'userId',
        header: i18next.t('race-admin.user-id'),
        cell: (item) => item.userId || '-',
        sortingField: 'userId',
      },
      {
        id: 'racedByProxy',
        header: i18next.t('race-admin.raced-by-proxy'),
        cell: (item) => (item.racedByProxy ? 'Yes' : 'No'),
        sortingField: 'racedByProxy',
        width: 170,
      },
      {
        id: 'trackId',
        header: i18next.t('race-admin.track-id'),
        cell: (item) => item.trackId || '-',
        sortingField: 'trackId',
      },
      {
        id: 'numberOfLaps',
        header: i18next.t('race-admin.number-of-laps'),
        cell: (item) => item.laps?.length || '-',
        sortingField: 'laps',
        width: 100,
      },
      {
        id: 'raceId',
        header: i18next.t('race-admin.race-id'),
        cell: (item) => item.raceId || '-',
        sortingField: 'raceId',
      },
    ],
  };
};

interface FilteringProperty {
  key: string;
  propertyLabel: string;
  operators: string[];
}

export const FilteringProperties = (): FilteringProperty[] => {
  return [
    {
      key: 'username',
      propertyLabel: i18next.t('race-admin.username'),
      operators: [':', '!:', '=', '!='],
    },
    {
      key: 'trackId',
      propertyLabel: i18next.t('race-admin.track-id'),
      operators: [':', '!:', '=', '!='],
    },
  ].sort((a, b) => a.propertyLabel.localeCompare(b.propertyLabel));
};

// Helper functions for test compatibility
export const ColumnDefinitions = (): TableProps.ColumnDefinition<Race>[] => {
  const config = ColumnConfiguration();
  return config.columnDefinitions;
};

export const VisibleContentOptions = (): VisibleContentGroup[] => {
  const config = ColumnConfiguration();
  return config.visibleContentOptions;
};
