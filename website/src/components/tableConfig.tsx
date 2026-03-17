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

interface EmptyStateProps {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, subtitle, action }: EmptyStateProps): JSX.Element {
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

export function MatchesCountText(count: number): string {
  return count === 1 ? `1 ${i18next.t('table.match')}` : `${count} ${i18next.t('table.matches')}`;
}

export const DefaultPreferences = {
  pageSize: 20,
  wrapLines: false,
  stripedRows: false,
  contentDensity: 'comfortable' as const,
};

export function PageSizePreference(label: string = 'items'): any {
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

export const WrapLines = (): { label: string; description: string } => {
  return {
    label: i18next.t('table.wrap-lines'),
    description: i18next.t('table.wrap-lines-description'),
  };
};

export const StripedRows = (): { label: string; description: string } => {
  return {
    label: i18next.t('table.striped-rows'),
    description: i18next.t('table.striped-rows-description'),
  };
};

export const ContentDensity = (): { label: string; description: string } => {
  return {
    label: i18next.t('table.content-density'),
    description: i18next.t('table.content-density-description'),
  };
};

interface ItemsCountProps {
  nrSelectedItems: number;
  nrTotalItems: number;
}

const ItemsCount = ({ nrSelectedItems, nrTotalItems }: ItemsCountProps): JSX.Element => {
  if (nrSelectedItems > 0) {
    return <>{`(${nrSelectedItems}/${nrTotalItems})`}</>;
  }
  return <>{`(${nrTotalItems})`}</>;
};

interface HeaderActionsProps {
  onEdit?: () => void;
  onDelete?: () => void;
  onAdd?: () => void;
  nrSelectedItems: number;
}

const HeaderActions = ({ onEdit, onDelete, onAdd, nrSelectedItems }: HeaderActionsProps): JSX.Element => {
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

interface FullPageTableHeaderProps {
  nrSelectedItems: number;
  nrTotalItems: number;
  header: React.ReactNode;
  breadcrumbs: any[];
  actions?: React.ReactNode;
  helpPanelHidden?: boolean;
  helpPanelContent?: React.ReactNode;
}

export const FullPageTableHeader = ({
  nrSelectedItems,
  nrTotalItems,
  header,
  breadcrumbs,
  actions = undefined,
  helpPanelHidden = true,
  helpPanelContent = undefined,
}: FullPageTableHeaderProps): JSX.Element => {
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
          counter={<ItemsCount nrTotalItems={nrTotalItems} nrSelectedItems={nrSelectedItems} /> as any}
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
          counter={<ItemsCount nrTotalItems={nrTotalItems} nrSelectedItems={nrSelectedItems} /> as any}
        >
          {header}
        </Header>
      )}
    </>
  );
};

interface TableHeaderProps {
  nrSelectedItems: number;
  nrTotalItems: number;
  header: React.ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  onAdd?: () => void;
  actions?: React.ReactNode;
}

export const TableHeader = ({
  nrSelectedItems,
  nrTotalItems,
  header,
  onEdit = undefined,
  onDelete = undefined,
  onAdd = undefined,
  actions = undefined,
}: TableHeaderProps): JSX.Element => {
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
      counter={<ItemsCount nrTotalItems={nrTotalItems} nrSelectedItems={nrSelectedItems} /> as any}
    >
      {header}
    </Header>
  );
};

interface TablePreferencesProps {
  preferences: any;
  setPreferences: (prefs: any) => void;
  contentOptions: any[];
}

export const TablePreferences = ({ preferences, setPreferences, contentOptions }: TablePreferencesProps): JSX.Element => {
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

interface TablePaginationProps {
  paginationProps: any;
}

export const TablePagination = ({ paginationProps }: TablePaginationProps): JSX.Element => {
  return (
    <Pagination
      {...paginationProps}
      ariaLabels={{
        nextPageLabel: i18next.t('table.next-page'),
        previousPageLabel: i18next.t('table.previous-page'),
        pageLabel: (pageNumber: number) => `$(t{'table.go-to-page')} ${pageNumber}`,
      }}
    />
  );
};
