import { Checkbox, FormField } from '@cloudscape-design/components';
import i18next from '../../i18n';
import { formatAwsDateTime } from '../../support-functions/time';

export const ColumnConfiguration = () => {
  return {
    defaultVisibleColumns: ['ComputerName', 'fleetName', 'IpAddress'],
    visibleContentOptions: [
      {
        label: i18next.t('devices.device-information'),
        options: [
          {
            id: 'InstanceId',
            label: i18next.t('devices.instance'),
            editable: true,
          },
          {
            id: 'ComputerName',
            label: i18next.t('devices.host-name'),
            editable: false,
          },
          {
            id: 'fleetName',
            label: i18next.t('devices.fleet-name'),
            editable: true,
          },
          {
            id: 'IpAddress',
            label: i18next.t('devices.car-ip'),
          },
          {
            id: 'Type',
            label: i18next.t('devices.type'),
            editable: true,
          },
          {
            id: 'AgentVersion',
            label: i18next.t('devices.agent-version'),
          },
          {
            id: 'registrationDate',
            label: i18next.t('devices.registration-date'),
          },
          {
            id: 'lastPingDateTime',
            label: i18next.t('devices.last-ping-time'),
          },
          {
            id: 'fleetId',
            label: i18next.t('devices.fleet-id'),
          },
        ],
      },
    ],
    columnDefinitions: [
      {
        id: 'InstanceId',
        header: i18next.t('devices.instance'),
        cell: (item) => item.InstanceId,
        sortingField: 'InstanceId',
        width: 200,
        minWidth: 150,
      },
      {
        id: 'ComputerName',
        header: i18next.t('devices.host-name'),
        cell: (item) => item.ComputerName || '-',
        sortingField: 'ComputerName',
        width: 200,
        minWidth: 150,
      },
      {
        id: 'fleetName',
        header: i18next.t('devices.fleet-name'),
        cell: (item) => item.fleetName || '-',
        sortingField: 'fleetName',
        width: 200,
        minWidth: 150,
      },
      {
        id: 'IpAddress',
        header: i18next.t('devices.car-ip'),
        cell: (item) => item.IpAddress || '-',
        sortingField: 'IpAddress',
        width: 200,
        minWidth: 150,
      },
      {
        id: 'Type',
        header: i18next.t('devices.type'),
        cell: (item) => item.Type || '-',
        sortingField: 'Type',
        width: 200,
        minWidth: 150,
      },
      {
        id: 'AgentVersion',
        header: i18next.t('devices.agent-version'),
        cell: (item) => item.AgentVersion || '-',
        sortingField: 'AgentVersion',
      },
      {
        id: 'RegistrationDate',
        header: i18next.t('devices.registration-date'),
        cell: (item) => formatAwsDateTime(item.RegistrationDate) || '-',
        sortingField: 'RegistrationDate',
      },
      {
        id: 'lastPingDateTime',
        header: i18next.t('devices.last-ping-time'),
        cell: (item) => formatAwsDateTime(item.lastPingDateTime) || '-',
        sortingField: 'lastPingDateTime',
      },
      {
        id: 'fleetId',
        header: i18next.t('devices.fleet-id'),
        cell: (item) => item.fleetId || '-',
        sortingField: 'fleetId',
      },
    ],
  };
};

export const FilteringProperties = () => {
  return [
    {
      key: 'ComputerName',
      propertyLabel: i18next.t('devices.host-name'),
      operators: [':', '!:', '=', '!='],
    },
    {
      key: 'fleetName',
      propertyLabel: i18next.t('devices.fleet-name'),
      operators: [':', '!:', '=', '!='],
    },
    {
      key: 'IpAddress',
      propertyLabel: i18next.t('devices.car-ip'),
      operators: [':', '!:', '=', '!='],
    },
    {
      key: 'Type',
      propertyLabel: i18next.t('devices.type'),
      operators: [
        {
          operator: '=',
          form: ({ value, onChange }) => {
            const deviceTypes = [
              { value: 'deepracer', label: i18next.t('devices.filter-deepracer') },
              { value: 'timer', label: i18next.t('devices.filter-timer') },
            ];
            return (
              <FormField>
                {deviceTypes.map((option, i) => (
                  <Checkbox
                    key={i}
                    checked={(value || []).includes(option.value)}
                    onChange={(event) => {
                      const newValue = [...(value || [])];
                      if (event.detail.checked) {
                        newValue.push(option.value);
                      } else {
                        newValue.splice(newValue.indexOf(option.value), 1);
                      }
                      onChange(newValue);
                    }}
                  >
                    {option.label}
                  </Checkbox>
                ))}
              </FormField>
            );
          },
          format: (values) => (values || []).join(', '),
        },
      ],
    },
  ].sort((a, b) => a.propertyLabel.localeCompare(b.propertyLabel));
};
