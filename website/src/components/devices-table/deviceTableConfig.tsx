import React from 'react';
import { Checkbox, FormField, Link } from '@cloudscape-design/components';
import ButtonDropdown, { ButtonDropdownProps } from '@cloudscape-design/components/button-dropdown';
import DatePicker from '@cloudscape-design/components/date-picker';
import { useTranslation } from 'react-i18next';
import { useCarCmdApi } from '../../hooks/useCarsApi';
import i18next from '../../i18n';
import { useSelectedEventContext } from '../../store/contexts/storeProvider';
import { formatAwsDateTime } from '../../support-functions/time';
import { Car } from '../../types/domain';

// Type definitions
interface DeviceLinkProps {
  type?: string;
  IP?: string;
  deviceUiPassword?: string;
  pingStatus?: 'Online' | 'Offline';
}

interface ItemActionsProps {
  item: Car;
}

interface ColumnConfig {
  defaultVisibleColumns: string[];
  visibleContentOptions: Array<{
    label: string;
    options: Array<{
      id: string;
      label: string;
      editable?: boolean;
    }>;
  }>;
  columnDefinitions: any[]; // CloudScape column definition type
  defaultSortingColumn: any;
  defaultSortingIsDescending: boolean;
}

export const DeviceLink: React.FC<DeviceLinkProps> = ({
  type,
  IP,
  deviceUiPassword,
  pingStatus,
}) => {
  const { t } = useTranslation();
  
  if (pingStatus === 'Online') {
    if (type === 'timer') {
      return (
        <Link external href={`http://${IP}:8080/`}>
          {t('devices.device-links.timer')}
        </Link>
      );
    } else if (type === 'deepracer') {
      return (
        <>
          <div>
            <Link external href={`https://${IP}/?epwd=${deviceUiPassword ? atob(deviceUiPassword) : ''}`}>
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
    }
  }
  
  return <>-</>;
};

export const ItemActions: React.FC<ItemActionsProps> = ({ item }) => {
  const { carFetchLogs, carRestartService, carEmergencyStop, carDeleteAllModels } = useCarCmdApi();
  const { t } = useTranslation();
  const selectedEvent = useSelectedEventContext();
  
  if (item.PingStatus === 'Online') {
    return (
      <ButtonDropdown
        items={[
          {
            id: 'fetch-logs',
            text: t('devices.fetch-logs'),
          },
          {
            id: 'delete-models',
            text: t('devices.clean-car'),
          },
          {
            id: 'restart-service',
            text: t('devices.restart-service'),
          },
          {
            id: 'car-stop',
            text: t('devices.car-stop'),
          },
        ] as ButtonDropdownProps.Items}
        variant="inline-icon"
        expandToViewport
        disabled={item.Type !== 'deepracer'}
        onItemClick={({ detail }) => {
          switch (detail.id) {
            case 'fetch-logs':
              carFetchLogs([item], selectedEvent as any);
              break;
            case 'delete-models':
              carDeleteAllModels([item.InstanceId], true);
              break;
            case 'restart-service':
              carRestartService([item.InstanceId]);
              break;
            case 'car-stop':
              carEmergencyStop([item.InstanceId]);
              break;
            default:
              break;
          }
        }}
      />
    );
  }
  
  return <>-</>;
};

export const ColumnConfiguration = (
  visibleColumns: string[] = [
    'carName',
    'fleetName',
    'carIp',
    'deviceLinks',
    'coreSWVersion',
    'actions',
  ]
): ColumnConfig => {
  const returnObject: ColumnConfig = {
    defaultVisibleColumns: visibleColumns,
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
            label: i18next.t('devices.device-links'),
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
          {
            id: 'coreSWVersion',
            label: i18next.t('devices.core-sw-version'),
          },
          {
            id: 'loggingCapable',
            label: i18next.t('devices.loggingcapable'),
          },
          {
            id: 'actions',
            label: i18next.t('devices.actions'),
          },
        ],
      },
    ],
    columnDefinitions: [
      {
        id: 'instanceId',
        header: i18next.t('devices.instance'),
        cell: (item: Car) => item.InstanceId,
        sortingField: 'InstanceId',
        width: 200,
        minWidth: 150,
      },
      {
        id: 'carName',
        header: i18next.t('devices.host-name'),
        cell: (item: Car) => item.ComputerName || '-',
        sortingField: 'ComputerName',
        width: 200,
        minWidth: 150,
      },
      {
        id: 'fleetName',
        header: i18next.t('devices.fleet-name'),
        cell: (item: Car) => item.fleetName || '-',
        sortingField: 'fleetName',
        width: 200,
        minWidth: 150,
      },
      {
        id: 'carIp',
        header: i18next.t('devices.car-ip'),
        cell: (item: Car) => item.IpAddress || '-',
        sortingField: 'IpAddress',
        sortingComparator: (a: Car, b: Car) => {
          const ipToNum = (ip: string) =>
            ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0);
          return ipToNum(a.IpAddress || '0.0.0.0') - ipToNum(b.IpAddress || '0.0.0.0');
        },
        width: 200,
        minWidth: 150,
      },
      {
        id: 'deviceLinks',
        header: i18next.t('devices.device-links'),
        cell: (item: Car) => (
          <DeviceLink
            type={item.Type}
            IP={item.IpAddress}
            deviceUiPassword={(item as any).DeviceUiPassword}
            pingStatus={item.PingStatus}
          />
        ),
        width: 150,
        minWidth: 100,
      },
      {
        id: 'deviceType',
        header: i18next.t('devices.type'),
        cell: (item: Car) => item.Type || '-',
        sortingField: 'Type',
        width: 150,
        minWidth: 100,
      },
      {
        id: 'agentVersion',
        header: i18next.t('devices.agent-version'),
        cell: (item: any) => item.AgentVersion || '-',
        sortingField: 'AgentVersion',
        width: 150,
        minWidth: 100,
      },
      {
        id: 'registrationDate',
        header: i18next.t('devices.registration-date'),
        cell: (item: any) => formatAwsDateTime(item.RegistrationDate) || '-',
        sortingField: 'RegistrationDate',
      },
      {
        id: 'lastPingDateTime',
        header: i18next.t('devices.last-ping-time'),
        cell: (item: any) => formatAwsDateTime(item.LastPingDateTime) || '-',
        sortingField: 'LastPingDateTime',
      },
      {
        id: 'fleetId',
        header: i18next.t('devices.fleet-id'),
        cell: (item: Car) => item.fleetId || '-',
        sortingField: 'fleet-id',
      },
      {
        id: 'coreSWVersion',
        header: i18next.t('devices.core-sw-version'),
        cell: (item: any) => item.DeepRacerCoreVersion || '-',
        sortingField: 'DeepRacerCoreVersion',
        minWidth: 175,
        width: 250,
      },
      {
        id: 'loggingCapable',
        header: i18next.t('devices.loggingcapable'),
        cell: (item: Car) => (item.LoggingCapable ? 'Yes' : 'No'),
        minWidth: 100,
        width: 150,
      },
      {
        id: 'actions',
        header: '',
        cell: (item: Car) => <ItemActions item={item} />,
      },
    ],
    defaultSortingColumn: {} as any, // Will be set below
    defaultSortingIsDescending: false,
  };
  
  returnObject.defaultSortingColumn = returnObject.columnDefinitions[1]; // uploadedDateTime
  returnObject.defaultSortingIsDescending = false;

  return returnObject;
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
      key: 'CoreSWVersion',
      propertyLabel: i18next.t('devices.core-sw-version'),
      operators: [':', '!:', '=', '!='],
    },
    {
      key: 'LastPingDateTime',
      propertyLabel: i18next.t('devices.last-ping-time'),
      operators: [
        {
          operator: '=',
          form: ({ value, onChange }: { value?: string; onChange: (value: string) => void }) => (
            <FormField>
              <DatePicker
                onChange={({ detail }) => onChange(detail.value)}
                value={value || ''}
                placeholder="YYYY/MM/DD"
                expandToViewport
              />
            </FormField>
          ),
          // Format only returning the date for equality comparison
          format: (value: string) => `${value}`,
          // Custom matcher that only compares the date part
          match: (itemValue: string, filterValue: string) => {
            if (!itemValue || !filterValue) return false;
            const itemDate = new Date(itemValue).toISOString().split('T')[0];
            const filterDate = new Date(filterValue).toISOString().split('T')[0];
            return itemDate === filterDate;
          },
        },
        {
          operator: '>',
          form: ({ value, onChange }: { value?: string; onChange: (value: string) => void }) => (
            <FormField>
              <DatePicker
                onChange={({ detail }) => onChange(detail.value)}
                value={value || ''}
                placeholder="YYYY/MM/DD"
                expandToViewport
              />
            </FormField>
          ),
          format: (value: string) => `${value}`,
          // Custom matcher for greater than comparison (dates after the selected date)
          match: (itemValue: string, filterValue: string) => {
            if (!itemValue || !filterValue) return false;
            const itemDate = new Date(itemValue).toISOString().split('T')[0];
            const filterDate = new Date(filterValue).toISOString().split('T')[0];
            return itemDate > filterDate;
          },
        },
        {
          operator: '<',
          form: ({ value, onChange }: { value?: string; onChange: (value: string) => void }) => (
            <FormField>
              <DatePicker
                onChange={({ detail }) => onChange(detail.value)}
                value={value || ''}
                placeholder="YYYY/MM/DD"
                expandToViewport
              />
            </FormField>
          ),
          format: (value: string) => `${value}`,
          // Custom matcher for less than comparison (dates before the selected date)
          match: (itemValue: string, filterValue: string) => {
            if (!itemValue || !filterValue) return false;
            const itemDate = new Date(itemValue).toISOString().split('T')[0];
            const filterDate = new Date(filterValue).toISOString().split('T')[0];
            return itemDate < filterDate;
          },
        },
      ],
    },
    {
      key: 'Type',
      propertyLabel: i18next.t('devices.type'),
      operators: [
        {
          operator: '=',
          form: ({ value, onChange }: { value?: string[]; onChange: (value: string[]) => void }) => {
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
          format: (values: string[]) => (values || []).join(', '),
        },
      ],
    },
  ].sort((a, b) => a.propertyLabel.localeCompare(b.propertyLabel));
};

// Helper functions for test compatibility
export const ColumnsConfig = () => {
  const config = ColumnConfiguration();
  return config.columnDefinitions;
};

export const VisibleContentOptions = () => {
  const config = ColumnConfiguration();
  return config.visibleContentOptions;
};
