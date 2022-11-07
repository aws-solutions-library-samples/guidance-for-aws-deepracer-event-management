import { Box } from "@cloudscape-design/components";

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
}

export function PageSizePreference(label='items') {
  const pageSize = {
    title: 'Select page size',
    options: [
      { value: 10, label: `10 ${label}` },
      { value: 20, label: `20 ${label}` },
      { value: 30, label: `30 ${label}` },
      { value: 50, label: `50 ${label}` }
    ]
  };
  return pageSize;
}

export const WrapLines = {
  label: 'Wrap lines',
  description: 'Check to see all the text and wrap the lines',
}

export const UserModelsColumnsConfig = [
  {
    id: 'id',
    header: 'id',
    cell: item => item.id,
    width: 200,
    minWidth: 150,
},
  {
    id: 'modelName',
    header: 'Model name',
    cell: item => item.modelName || '-',
    sortingField: 'modelName',
    width: 200,
    minWidth: 150,
},
  {
    id: 'modelDate',
    header: 'Upload date',
    cell: item => item.modelDate || '-',
    sortingField: 'modelDate',
    width: 200,
    minWidth: 150,
}
]

export const AdminModelsColumnsConfig = [
  {
    id: 'id',
    header: 'id',
    cell: item => item.id,
    width: 200,
    minWidth: 150,
},
  {
    id: 'userName',
    header: 'User name',
    cell: item => item.userName || '-',
    sortingField: 'userName',
    width: 200,
    minWidth: 150,
},
  {
    id: 'modelName',
    header: 'Model name',
    cell: item => item.modelName || '-',
    sortingField: 'modelName',
    width: 200,
    minWidth: 150,
},
  {
    id: 'modelDate',
    header: 'Upload date',
    cell: item => item.modelDate || '-',
    sortingField: 'modelDate',
    width: 200,
    minWidth: 150,
}
]
