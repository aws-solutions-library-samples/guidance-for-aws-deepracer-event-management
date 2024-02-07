import { Checkbox, FormField, Link } from '@cloudscape-design/components';
import { useTranslation } from 'react-i18next';
import i18next from '../../i18n';
import { formatAwsDateTime } from '../../support-functions/time';

export const DeviceLink = ({ type, IP, deviceUiPassword, pingStatus }) => {
  const { t } = useTranslation();
  if (pingStatus === 'Online')
    if (type === 'timer')
      return (
        <Link external href={`http://${IP}:8080/`}>
          {t('devices.device-links.timer')}
        </Link>
      );
    else if (type === 'deepracer')
      return (
        <>
          <div>
            <Link external href={`https://${IP}/?epwd=${atob(deviceUiPassword)}`}>
              {t('devices.device-links.car')}
            </Link>
          </div>

          <div>
            <Link
              external
              href={`https://${IP}/route?topic=/camera_pkg/display_mjpeg&width=480&height=360`}
            >
              {t('devices.device-links.camera')}
            </Link>
          </div>
        </>
      );
    else return '-';
};

export const ColumnConfiguration = () => {
  return {
    defaultVisibleColumns: ['carName', 'fleetName', 'carIp'],
    visibleContentOptions: [
      {
        label: i18next.t('devices.device-information'),
        options: [
          {
            id: 'instanceId',
            label: i18next.t('devices.instance'),
            editable: true,
          },
          {
            id: 'carName',
            label: i18next.t('devices.host-name'),
            editable: false,
          },
          {
            id: 'fleetName',
            label: i18next.t('devices.fleet-name'),
            editable: true,
          },
          {
            id: 'carIp',
            label: i18next.t('devices.car-ip'),
          },
          {
            id: 'deviceLinks',
            label: 'Access device',
          },
          {
            id: 'deviceType',
            label: i18next.t('devices.type'),
          },
          {
            id: 'agentVersion',
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
        id: 'instanceId',
        header: i18next.t('devices.instance'),
        cell: (item) => item.InstanceId,
        sortingField: 'key',
        width: 200,
        minWidth: 150,
      },
      {
        id: 'carName',
        header: i18next.t('devices.host-name'),
        cell: (item) => item.ComputerName || '-',
        sortingField: 'carName',
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
        id: 'carIp',
        header: i18next.t('devices.car-ip'),
        cell: (item) => item.IpAddress || '-',
        sortingField: 'carIp',
        width: 200,
        minWidth: 150,
      },
      {
        id: 'deviceLinks',
        header: i18next.t('devices.device-links'),
        cell: (item) => (
          <DeviceLink
            type={item.Type}
            IP={item.IpAddress}
            deviceUiPassword={item.DeviceUiPassword}
            pingStatus={item.PingStatus}
          />
        ),
        sortingField: 'deviceLinks',
        width: 200,
        minWidth: 150,
      },
      {
        id: 'deviceType',
        header: i18next.t('devices.type'),
        cell: (item) => item.Type || '-',
        sortingField: 'deviceType',
      },
      {
        id: 'agentVersion',
        header: i18next.t('devices.agent-version'),
        cell: (item) => item.AgentVersion || '-',
        sortingField: 'agentVersion',
      },
      {
        id: 'registrationDate',
        header: i18next.t('devices.registration-date'),
        cell: (item) => formatAwsDateTime(item.RegistrationDate) || '-',
        sortingField: 'registrationDate',
      },
      {
        id: 'lastPingDateTime',
        header: i18next.t('devices.last-ping-time'),
        cell: (item) => formatAwsDateTime(item.LastPingDateTime) || '-',
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
