import Button from '@cloudscape-design/components/button';
import i18next from '../i18n';
import { formatAwsDateTime } from '../support-functions/time';
import { FetchCarLogsStatus } from './fetchCarLogsStatus';

export const ColumnConfigurationProc = (navigateToTab1WithFilter) => {
  var returnObject = {
    defaultVisibleColumns: ['carname', 'carfleetname', 'starttime', 'status', 'actions'],
    visibleContentOptions: [
      {
        label: i18next.t('carlogs.assets.model-information'),
        options: [
          {
            id: 'carname',
            label: i18next.t('carlogs.assets.car-name'),
          },
          {
            id: 'carfleetname',
            label: i18next.t('carlogs.assets.car-fleet-name'),
          },
          {
            id: 'starttime',
            label: i18next.t('carlogs.assets.start-time'),
          },
          {
            id: 'status',
            label: i18next.t('carlogs.assets.status'),
          },
          {
            id: 'fetchjobid',
            label: i18next.t('carlogs.assets.fetch-job-id'),
          },
          {
            id: 'actions',
            label: i18next.t('carlogs.assets.actions'),
          },
        ],
      },
    ],
    columnDefinitions: [
      {
        id: 'carname',
        header: i18next.t('carlogs.assets.car-name'),
        cell: (item) => item.carName || '-',
        sortingField: 'carname',
        width: 200,
        minWidth: 150,
      },
      {
        id: 'carfleetname',
        header: i18next.t('carlogs.assets.car-fleet-name'),
        cell: (item) => item.carFleetName || '-',
        sortingField: 'carFleetName',
        width: 200,
        minWidth: 150,
      },
      {
        id: 'starttime',
        header: i18next.t('carlogs.assets.start-time'),
        cell: (item) => String(formatAwsDateTime(item.startTime)) || '-',
        sortingField: 'startTime',
        width: 240,
        minWidth: 150,
      },
      {
        id: 'status',
        header: i18next.t('carlogs.assets.status'),
        cell: (item) => <FetchCarLogsStatus status={item.status} />,
        sortingField: 'status',
        width: 200,
        minWidth: 150,
      },
      {
        id: 'fetchjobid',
        header: i18next.t('carlogs.assets.fetch-job-id'),
        cell: (item) => item.jobId || '-',
        sortingField: 'jobId',
        width: 200,
        minWidth: 150,
      },
      {
        id: 'actions',
        header: i18next.t('carlogs.assets.actions'),
        cell: (item) => (
          <Button
            onClick={() => {
              navigateToTab1WithFilter(item.jobId);
            }}
            variant="inline-link"
            iconName="list-view"
            disabled={item.status !== 'DONE'}
          ></Button>
        ),
      },
    ],
  };
  returnObject.defaultSortingColumn = returnObject.columnDefinitions[2]; // uploadedDateTime
  returnObject.defaultSortingIsDescending = true;

  return returnObject;
};

export const FilteringPropertiesProc = () => {
  return [
    {
      key: 'carname',
      propertyLabel: i18next.t('carlogs.assets.model-name'),
      operators: [':', '!:', '=', '!='],
    },
    {
      key: 'carfleetname',
      propertyLabel: i18next.t('carlogs.assets.car-fleet-name'),
      operators: [':', '!:', '=', '!='],
    },
    {
      key: 'status',
      propertyLabel: i18next.t('carlogs.assets.status'),
      operators: [':', '!:', '=', '!='],
    },
  ].sort((a, b) => a.propertyLabel.localeCompare(b.propertyLabel));
};
