import { useCollection } from '@cloudscape-design/collection-hooks';
import {
  Button,
  CollectionPreferences,
  Header,
  Link,
  Pagination,
  Table,
  TextFilter,
} from '@cloudscape-design/components';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DefaultPreferences,
  EmptyState,
  MatchesCountText,
  PageSizePreference,
  WrapLines,
} from '../../components/tableConfig';
import { useLocalStorage } from '../../hooks/useLocalStorage';

import { PageLayout } from '../../components/pageLayout';
import { useGroupsApi } from '../../hooks/useGroupsApi';
import { formatAwsDateTime } from '../../support-functions/time';

export function GroupsPage() {
  const { t } = useTranslation();

  const [selectedItems] = useState([]);
  const [groups, isLoading] = useGroupsApi();

  const [preferences, setPreferences] = useLocalStorage('DREM-groups-table-preferences', {
    ...DefaultPreferences,
    visibleContent: ['groupName', 'description'],
  });

  const columnsConfig = [
    {
      id: 'groupName',
      header: t('groups.header-name'),
      cell: (item) => (
        <div>
          <Link href={window.location.href + '/' + item.GroupName}>{item.GroupName}</Link>
        </div>
      ),
      sortingField: 'groupName',
      width: 200,
      minWidth: 150,
    },
    {
      id: 'description',
      header: t('groups.header-description'),
      cell: (item) => item.Description || '-',
      sortingField: 'description',
      width: 200,
      minWidth: 150,
    },
    {
      id: 'creationDate',
      header: t('groups.header-creation-date'),
      cell: (item) => formatAwsDateTime(item.creationDate) || '-',
      sortingField: 'creationDate',
      width: 200,
      minWidth: 150,
    },
    {
      id: 'lastModifiedDate',
      header: t('groups.header-last-modified-date'),
      cell: (item) => formatAwsDateTime(item.LastModifiedDate) || '-',
      sortingField: 'lastModifiedDate',
      width: 200,
      minWidth: 150,
    },
  ];

  const visibleContentOptions = [
    {
      label: t('groups.information'),
      options: [
        {
          id: 'groupName',
          label: t('groups.header-name'),
          editable: false,
        },
        {
          id: 'description',
          label: t('groups.header-description'),
          editable: false,
        },
        {
          id: 'creationDate',
          label: t('groups.header-creation-date'),
        },
        {
          id: 'lastModifiedDate',
          label: t('groups.header-last-modified-date'),
        },
      ],
    },
  ];

  const { items, actions, filteredItemsCount, collectionProps, filterProps, paginationProps } =
    useCollection(groups, {
      filtering: {
        empty: (
          <EmptyState
            title={t('groups.no-groups')}
            subtitle={t('groups.no-groups-have-been-defined')}
          />
        ),
        noMatch: (
          <EmptyState
            title={t('models.no-matches')}
            subtitle={t('models.we-cant-find-a-match')}
            action={
              <Button onClick={() => actions.setFiltering('')}>{t('models.clear-filter')}</Button>
            }
          />
        ),
      },
      pagination: { pageSize: preferences.pageSize },
      sorting: { defaultState: { sortingColumn: columnsConfig[0] } },
      selection: {},
    });

  return (
    <PageLayout
      header={t('groups.header')}
      description={t('groups.description')}
      breadcrumbs={[
        { text: t('home.breadcrumb'), href: '/' },
        { text: t('admin.breadcrumb'), href: '/admin/home' },
        { text: t('groups.breadcrumb') },
      ]}
    >
      <Table
        {...collectionProps}
        header={
          <Header
            counter={
              selectedItems.length
                ? `(${selectedItems.length}/${groups.length})`
                : `(${groups.length})`
            }
          >
            {t('groups.header')}
          </Header>
        }
        columnDefinitions={columnsConfig}
        items={items}
        pagination={
          <Pagination
            {...paginationProps}
            ariaLabels={{
              nextPageLabel: t('table.next-page'),
              previousPageLabel: t('table.previous-page'),
              pageLabel: (pageNumber) => `$(t{'table.go-to-page')} ${pageNumber}`,
            }}
          />
        }
        filter={
          <TextFilter
            {...filterProps}
            countText={MatchesCountText(filteredItemsCount)}
            filteringAriaLabel={t('groups.filter-groups')}
          />
        }
        loading={isLoading}
        loadingText={t('groups.loading-groups')}
        visibleColumns={preferences.visibleContent}
        selectedItems={selectedItems}
        stickyHeader="true"
        trackBy="GroupName"
        resizableColumns
        preferences={
          <CollectionPreferences
            title={t('table.preferences')}
            confirmLabel={t('button.confirm')}
            cancelLabel={t('button.cancel')}
            onConfirm={({ detail }) => setPreferences(detail)}
            preferences={preferences}
            pageSizePreference={PageSizePreference(t('groups.page-size-label'))}
            visibleContentPreference={{
              title: t('table.select-visible-colunms'),
              options: visibleContentOptions,
            }}
            wrapLinesPreference={WrapLines}
          />
        }
      />
    </PageLayout>
  );
}
