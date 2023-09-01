import {
  Box,
  BreadcrumbGroup,
  Button,
  CollectionPreferences,
  Header,
  Link,
  Pagination,
  SpaceBetween,
} from '@cloudscape-design/components';

import { default as React, useEffect } from 'react';
import i18next from '../i18n';
import { useStore } from '../store/store';

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
  stripedRows: false,
  contentDensity: 'comfortable',
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

export const StripedRows = () => {
  return {
    label: i18next.t('table.striped-rows'),
    description: i18next.t('table.striped-rows-description'),
  };
};

export const ContentDensity = () => {
  return {
    label: i18next.t('table.content-density'),
    description: i18next.t('table.content-density-description'),
  };
};

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

export const FullPageTableHeader = ({
  nrSelectedItems,
  nrTotalItems,
  header,
  breadcrumbs,
  actions = undefined,
  helpPanelHidden = true,
  helpPanelContent = undefined,
}) => {
  const [, dispatch] = useStore();

  // Help panel
  useEffect(() => {
    dispatch('UPDATE_HELP_PANEL', {
      //isOpen: true,
      isHidden: helpPanelHidden,
      content: helpPanelContent,
    });

    return () => {
      dispatch('RESET_HELP_PANEL');
    };
  }, [dispatch, helpPanelHidden]);

  return (
    <>
      <BreadcrumbGroup items={breadcrumbs} ariaLabel="Breadcrumbs" />
      {helpPanelHidden ? (
        <Header
          actions={actions}
          counter={<ItemsCount nrTotalItems={nrTotalItems} nrSelectedItems={nrSelectedItems} />}
        >
          {header}
        </Header>
      ) : (
        <Header
          info={
            <Link variant="info" onFollow={() => dispatch('HELP_PANEL_IS_OPEN', true)}>
              Info
            </Link>
          }
          actions={actions}
          counter={<ItemsCount nrTotalItems={nrTotalItems} nrSelectedItems={nrSelectedItems} />}
        >
          {header}
        </Header>
      )}
    </>
  );
};

export const TableHeader = ({
  nrSelectedItems,
  nrTotalItems,
  header,
  onEdit = undefined,
  onDelete = undefined,
  onAdd = undefined,
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
  const stripedRows = StripedRows();
  const contentDensity = ContentDensity();
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
      stripedRowsPreference={stripedRows}
      contentDensityPreference={contentDensity}
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
