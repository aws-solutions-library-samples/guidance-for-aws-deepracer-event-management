// import { Calendar, DateInput, FormField } from '@cloudscape-design/components';
import i18next from '../../i18n';
import { formatAwsDateTime } from '../../support-functions/time';

export function ColumnsConfig() {
  const rowHeaders = [
    {
      id: 'instanceId',
      header: i18next.t('cars.instance'),
      cell: (item) => item.InstanceId,
      sortingField: 'key',
      width: 200,
      minWidth: 150,
    },
    {
      id: 'carName',
      header: i18next.t('cars.host-name'),
      cell: (item) => item.ComputerName || '-',
      sortingField: 'carName',
      width: 200,
      minWidth: 150,
    },
    {
      id: 'fleetName',
      header: i18next.t('cars.fleet-name'),
      cell: (item) => item.fleetName || '-',
      sortingField: 'fleetName',
      width: 200,
      minWidth: 150,
    },
    {
      id: 'carIp',
      header: i18next.t('cars.car-ip'),
      cell: (item) => item.IpAddress || '-',
      sortingField: 'carIp',
      width: 200,
      minWidth: 150,
    },
    {
      id: 'agentVersion',
      header: i18next.t('cars.agent-version'),
      cell: (item) => item.AgentVersion || '-',
      sortingField: 'agentVersion',
    },
    {
      id: 'registrationDate',
      header: i18next.t('cars.registration-date'),
      cell: (item) => formatAwsDateTime(item.RegistrationDate) || '-',
      sortingField: 'registrationDate',
    },
    {
      id: 'lastPingDateTime',
      header: i18next.t('cars.last-ping-time'),
      cell: (item) => formatAwsDateTime(item.lastPingDateTime) || '-',
      sortingField: 'lastPingDateTime',
    },
    {
      id: 'fleetId',
      header: i18next.t('cars.fleet-id'),
      cell: (item) => item.fleetId || '-',
      sortingField: 'fleetId',
    },
  ];
  return rowHeaders;
}

export function VisibleContentOptions() {
  const rowHeaders = [
    {
      label: i18next.t('cars.car-information'),
      options: [
        {
          id: 'instanceId',
          label: i18next.t('cars.instance'),
          editable: true,
        },
        {
          id: 'carName',
          label: i18next.t('cars.host-name'),
          editable: false,
        },
        {
          id: 'fleetName',
          label: i18next.t('cars.fleet-name'),
          editable: true,
        },
        {
          id: 'carIp',
          label: i18next.t('cars.car-ip'),
        },
        {
          id: 'agentVersion',
          label: i18next.t('cars.agent-version'),
        },
        {
          id: 'registrationDate',
          label: i18next.t('cars.registration-date'),
        },
        {
          id: 'lastPingDateTime',
          label: i18next.t('cars.last-ping-time'),
        },
        {
          id: 'fleetId',
          label: i18next.t('cars.fleet-id'),
        },
      ],
    },
  ];
  return rowHeaders;
}

export const FilteringProperties = () => {
  return [
    {
      key: 'ComputerName',
      propertyLabel: i18next.t('cars.host-name'),
      operators: [':', '!:', '=', '!='],
    },
    {
      key: 'fleetName',
      propertyLabel: i18next.t('cars.fleet-name'),
      operators: [':', '!:', '=', '!='],
    },
    {
      key: 'IpAddress',
      propertyLabel: i18next.t('cars.car-ip'),
      operators: [':', '!:', '=', '!='],
    },
    // {
    //   key: 'RegistrationDate',
    //   propertyLabel: i18next.t('cars.registration-date'),
    //   groupValuesLabel: 'Created at value',
    //   defaultOperator: '>',
    //   operators: ['<', '<=', '>', '>='].map((operator) => ({
    //     operator,
    //     form: ({ value, onChange }) => (
    //       <div className="date-form">
    //         {' '}
    //         <FormField>
    //           {' '}
    //           <DateInput
    //             value={value ?? ''}
    //             onChange={(event) => onChange(event.detail.value)}
    //             placeholder="YYYY/MM/DD"
    //           />{' '}
    //         </FormField>{' '}
    //         <Calendar
    //           value={value ?? ''}
    //           onChange={(event) => onChange(event.detail.value)}
    //           locale="en-GB"
    //         />{' '}
    //       </div>
    //     ),
    //     format: formatAwsDateTime,
    //     match: 'date',
    //   })),
    // },
    // {
    //   key: 'LastPingDateTime',
    //   propertyLabel: i18next.t('cars.last-ping-time'),
    //   groupValuesLabel: 'Created at value',
    //   defaultOperator: '>',
    //   operators: ['<', '<=', '>', '>='].map((operator) => ({
    //     operator,
    //     form: ({ value, onChange }) => (
    //       <div className="date-form">
    //         {' '}
    //         <FormField>
    //           {' '}
    //           <DateInput
    //             value={value ?? ''}
    //             onChange={(event) => onChange(event.detail.value)}
    //             placeholder="YYYY/MM/DD"
    //           />{' '}
    //         </FormField>{' '}
    //         <Calendar
    //           value={value ?? ''}
    //           onChange={(event) => onChange(event.detail.value)}
    //           locale="en-GB"
    //         />{' '}
    //       </div>
    //     ),
    //     format: formatAwsDateTime,
    //     match: 'date',
    //   })),
    // },
  ].sort((a, b) => a.propertyLabel.localeCompare(b.propertyLabel));
};
