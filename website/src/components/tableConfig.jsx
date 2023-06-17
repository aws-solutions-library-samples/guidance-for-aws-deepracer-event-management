import {
  Box,
  Button,
  CollectionPreferences,
  Header,
  Pagination,
  SpaceBetween,
} from '@cloudscape-design/components';

import { default as React } from 'react';
import i18next from '../i18n';

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
  return count === 1 ? `1 ${i18next.t('table.match')}` : `${count} ${i18next.t('table.matches')}`;
}

export const DefaultPreferences = {
  pageSize: 20,
  wrapLines: false,
};

export function PageSizePreference(label = 'items') {
  const pageSize = {
    title: i18next.t('table.select-page-size'),
    options: [
      { value: 10, label: `10 ${label}` },
      { value: 20, label: `20 ${label}` },
      { value: 30, label: `30 ${label}` },
      { value: 50, label: `50 ${label}` },
      { value: 100, label: `100 ${label}` },
      { value: 200, label: `200 ${label}` },
    ],
  };
  return pageSize;
}

export const WrapLines = () => {
  return {
    label: i18next.t('table.wrap-lines'),
    description: i18next.t('table.wrap-lines-description'),
  };
};

export function UserModelsColumnsConfig() {
  const rowHeaders = [
    {
      id: 'id',
      header: 'id',
      cell: (item) => item.id,
      width: 200,
      minWidth: 150,
    },
    {
      id: 'modelName',
      header: i18next.t('models.model-name'),
      cell: (item) => item.modelName || '-',
      sortingField: 'modelName',
      width: 200,
      minWidth: 150,
    },
    {
      id: 'modelDate',
      header: i18next.t('models.upload-date'),
      cell: (item) => item.modelDate || '-',
      sortingField: 'modelDate',
      width: 200,
      minWidth: 150,
    },
  ];
  return rowHeaders;
}

export function AdminModelsColumnsConfig() {
  const rowHeaders = [
    {
      id: 'modelId',
      header: i18next.t('models.model-id'),
      cell: (item) => item.modelId,
      width: 320,
    },
    {
      id: 'userName',
      header: i18next.t('models.user-name'),
      cell: (item) => item.userName || '-',
      sortingField: 'userName',
      width: 200,
      minWidth: 150,
    },
    {
      id: 'modelName',
      header: i18next.t('models.model-name'),
      cell: (item) => item.modelName || '-',
      sortingField: 'modelName',
      width: 200,
      minWidth: 150,
    },
    {
      id: 'modelDate',
      header: i18next.t('models.upload-date'),
      cell: (item) => item.modelDate || '-',
      sortingField: 'modelDate',
      width: 240,
      minWidth: 150,
    },
    {
      id: 'modelMD5Hash',
      header: i18next.t('models.md5-hash'),
      cell: (item) => item.modelMD5,
      width: 200,
      minWidth: 150,
    },
    {
      id: 'modelMetadataMD5Hash',
      header: i18next.t('models.md5-hash-metadata'),
      cell: (item) => item.modelMetadataMD5,
      width: 200,
      minWidth: 150,
    },
    {
      id: 'modelS3Key',
      header: i18next.t('models.model-s3-key'),
      cell: (item) => item.modelKey,
      width: 200,
      minWidth: 150,
    },
  ];
  return rowHeaders;
}

const ItemsCount = ({ nrSelectedItems, nrTotalItems }) => {
  if (nrSelectedItems > 0) {
    return `(${nrSelectedItems}/${nrTotalItems})`;
  }
  return `(${nrTotalItems})`;
};

const HeaderActions = ({ onEdit, onDelete, onAdd, nrSelectedItems }) => {
  const disableEditButton = nrSelectedItems === 0 || nrSelectedItems > 1;
  const disableDeleteButton = nrSelectedItems === 0;
  return (
    <SpaceBetween direction="horizontal" size="xs">
      {onEdit && (
        <Button disabled={disableEditButton} onClick={onEdit}>
          {i18next.t('button.edit')}
        </Button>
      )}
      {onDelete && (
        <Button disabled={disableDeleteButton} onClick={onDelete}>
          {i18next.t('button.delete')}
        </Button>
      )}
      {onAdd && (
        <Button variant="primary" onClick={onAdd}>
          {i18next.t('button.create')}
        </Button>
      )}
    </SpaceBetween>
  );
};

export const TableHeader = ({
  onEdit,
  onDelete,
  onAdd,
  nrSelectedItems,
  nrTotalItems,
  header,
  actions = undefined,
}) => {
  return (
    <Header
      actions={
        actions ? (
          actions
        ) : (
          <HeaderActions
            onAdd={onAdd}
            onEdit={onEdit}
            onDelete={onDelete}
            nrSelectedItems={nrSelectedItems}
          />
        )
      }
      counter={<ItemsCount nrTotalItems={nrTotalItems} nrSelectedItems={nrSelectedItems} />}
    >
      {header}
    </Header>
  );
};

export const TablePreferences = ({ preferences, setPreferences, contentOptions }) => {
  const wrapLines = WrapLines();
  return (
    <CollectionPreferences
      title={i18next.t('table.preferences')}
      confirmLabel={i18next.t('button.confirm')}
      cancelLabel={i18next.t('button.cancel')}
      onConfirm={({ detail }) => setPreferences(detail)}
      preferences={preferences}
      pageSizePreference={PageSizePreference()}
      visibleContentPreference={{
        title: i18next.t('table.select-visible-columns'),
        options: contentOptions,
      }}
      wrapLinesPreference={wrapLines}
    />
  );
};

export const TablePagination = ({ paginationProps }) => {
  return (
    <Pagination
      {...paginationProps}
      ariaLabels={{
        nextPageLabel: i18next.t('table.next-page'),
        previousPageLabel: i18next.t('table.previous-page'),
        pageLabel: (pageNumber) => `$(t{'table.go-to-page')} ${pageNumber}`,
      }}
    />
  );
};
