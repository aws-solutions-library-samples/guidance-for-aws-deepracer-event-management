import { Box } from '@cloudscape-design/components';

import dayjs from 'dayjs';

// day.js
var advancedFormat = require('dayjs/plugin/advancedFormat');
var utc = require('dayjs/plugin/utc');
var timezone = require('dayjs/plugin/timezone'); // dependent on utc plugin

dayjs.extend(advancedFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

export function EmptyState({ title, subtitle, action }) {
  return (
    <Box textAlign="center" color="inherit">
      <Box variant="strong" textAlign="center" color="inherit">
        {title}
      </Box>
      <Box variant="p" padding={{ bottom: 's' }} color="inherit">
        {subtitle}
      </Box>
      {action}
    </Box>
  );
}

export function MatchesCountText(count) {
  return count === 1 ? `1 match` : `${count} matches`;
}

export const DefaultPreferences = {
  pageSize: 20,
  wrapLines: false,
};

export function PageSizePreference(label = 'items') {
  const pageSize = {
    title: 'Select page size',
    options: [
      { value: 10, label: `10 ${label}` },
      { value: 20, label: `20 ${label}` },
      { value: 30, label: `30 ${label}` },
      { value: 50, label: `50 ${label}` },
    ],
  };
  return pageSize;
}

export const WrapLines = {
  label: 'Wrap lines',
  description: 'Check to see all the text and wrap the lines',
};

export const CarColumnsConfig = [
  {
    id: 'instanceId',
    header: 'Instance',
    cell: (item) => item.InstanceId,
    sortingField: 'key',
    width: 200,
    minWidth: 150,
  },
  {
    id: 'carName',
    header: 'Host name',
    cell: (item) => item.ComputerName || '-',
    sortingField: 'carName',
    width: 200,
    minWidth: 150,
  },
  {
    id: 'fleetName',
    header: 'Fleet name',
    cell: (item) => item.fleetName || '-',
    sortingField: 'fleetName',
    width: 200,
    minWidth: 150,
  },
  {
    id: 'carIp',
    header: 'IP address',
    cell: (item) => item.IPAddress || '-',
    sortingField: 'carIp',
    width: 200,
    minWidth: 150,
  },
  {
    id: 'agentVersion',
    header: 'Agent version',
    cell: (item) => item.AgentVersion || '-',
    sortingField: 'agentVersion',
  },
  {
    id: 'registrationDate',
    header: 'Registration date',
    cell: (item) => dayjs(item.RegistrationDate).format('YYYY-MM-DD HH:mm:ss (z)') || '-',
    sortingField: 'registrationDate',
  },
  {
    id: 'lastPingDateTime',
    header: 'Last ping time',
    cell: (item) => dayjs(item.lastPingDateTime).format('YYYY-MM-DD HH:mm:ss (z)') || '-',
    sortingField: 'lastPingDateTime',
  },
  {
    id: 'fleetId',
    header: 'Fleet ID',
    cell: (item) => item.fleetId || '-',
    sortingField: 'fleetId',
  },
];

export const CarVisibleContentOptions = [
  {
    label: 'Car information',
    options: [
      {
        id: 'instanceId',
        label: 'Instance',
        editable: true,
      },
      {
        id: 'carName',
        label: 'Host name',
        editable: false,
      },
      {
        id: 'fleetName',
        label: 'Fleet name',
        editable: true,
      },
      {
        id: 'carIp',
        label: 'Car IP',
      },
      {
        id: 'agentVersion',
        label: 'Agent version',
      },
      {
        id: 'registrationDate',
        label: 'Registration date',
      },
      {
        id: 'lastPingDateTime',
        label: 'Last ping time',
      },
      {
        id: 'fleetId',
        label: 'Fleet ID',
      },
    ],
  },
];

export const UserModelsColumnsConfig = [
  {
    id: 'id',
    header: 'id',
    cell: (item) => item.id,
    width: 200,
    minWidth: 150,
  },
  {
    id: 'modelName',
    header: 'Model name',
    cell: (item) => item.modelName || '-',
    sortingField: 'modelName',
    width: 200,
    minWidth: 150,
  },
  {
    id: 'modelDate',
    header: 'Upload date',
    cell: (item) => item.modelDate || '-',
    sortingField: 'modelDate',
    width: 200,
    minWidth: 150,
  },
];

export const AdminModelsColumnsConfig = [
  {
    id: 'id',
    header: 'id',
    cell: (item) => item.id,
    width: 200,
    minWidth: 150,
  },
  {
    id: 'userName',
    header: 'User name',
    cell: (item) => item.userName || '-',
    sortingField: 'userName',
    width: 200,
    minWidth: 150,
  },
  {
    id: 'modelName',
    header: 'Model name',
    cell: (item) => item.modelName || '-',
    sortingField: 'modelName',
    width: 200,
    minWidth: 150,
  },
  {
    id: 'modelDate',
    header: 'Upload date',
    cell: (item) => item.modelDate || '-',
    sortingField: 'modelDate',
    width: 200,
    minWidth: 150,
  },
];
