import { useCollection } from '@cloudscape-design/collection-hooks';
import { Button, Header, Pagination, Table, TextFilter } from '@cloudscape-design/components';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Flag } from '../../components/flag';
import { PageLayout } from '../../components/pageLayout';
import {
  DefaultPreferences,
  EmptyState,
  MatchesCountText,
  TablePreferences,
} from '../../components/tableConfig';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useUsersContext } from '../../store/storeProvider';
import { formatAwsDateTime } from '../../support-functions/time';

export const UsersList = () => {
  const { t } = useTranslation();

  const [selectedItems] = useState([]);

  const [users, isLoading] = useUsersContext();
  const [preferences, setPreferences] = useLocalStorage('DREM-user-table-preferences', {
    ...DefaultPreferences,
    visibleContent: ['Username', 'Flag', 'UserCreateDate'],
  });

  const columnsConfig = [
    {
      id: 'Username',
      header: t('users.header-username'),
      cell: (item) => item.Username || '-',
      sortingField: 'Username',
      width: 200,
      minWidth: 150,
    },
    {
      id: 'Flag',
      header: t('users.flag'),
      cell: (item) => {
        const countryCode = item.Attributes.filter((obj) => {
          return obj.Name === 'custom:countryCode';
        });
        if (countryCode.length > 0) {
          return <Flag size="small" countryCode={countryCode[0].Value}></Flag>;
        } else {
          return '';
        }
      },
      sortingField: 'Flag',
      width: 120,
      minWidth: 80,
    },
    {
      id: 'CountryCode',
      header: t('users.country-code'),
      cell: (item) => {
        const countryCode = item.Attributes.filter((obj) => {
          return obj.Name === 'custom:countryCode';
        });
        if (countryCode.length > 0) {
          return countryCode[0].Value;
        } else {
          return '';
        }
      },
      sortingField: 'CountryCode',
      width: 120,
      minWidth: 80,
    },
    {
      id: 'UserCreateDate',
      header: t('users.header-creation-date'),
      cell: (item) => formatAwsDateTime(item.UserCreateDate) || '-',
      sortingField: 'UserCreateDate',
      width: 200,
      minWidth: 150,
    },
    {
      id: 'UserLastModifiedDate',
      header: t('users.header-last-modified-date'),
      cell: (item) => formatAwsDateTime(item.UserLastModifiedDate) || '-',
      sortingField: 'UserLastModifiedDate',
      width: 200,
      minWidth: 150,
    },
  ];

  const visibleContentOptions = [
    {
      label: t('groups.information'),
      options: [
        {
          id: 'Username',
          label: t('users.header-username'),
          editable: false,
        },
        {
          id: 'Flag',
          label: t('users.flag'),
          //editable: false,
        },
        {
          id: 'CountryCode',
          label: t('users.country-code'),
          //editable: false,
        },
        {
          id: 'UserCreateDate',
          label: t('users.header-creation-date'),
        },
        {
          id: 'UserLastModifiedDate',
          label: t('users.header-last-modified-date'),
        },
      ],
    },
  ];

  const { items, actions, filteredItemsCount, collectionProps, filterProps, paginationProps } =
    useCollection(users, {
      filtering: {
        empty: (
          <EmptyState
            title={t('users.no-users')}
            subtitle={t('users.no-users-have-been-defined')}
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
      sorting: { defaultState: { sortingColumn: columnsConfig[3], isDescending: true } },
      selection: {},
    });

  return (
    <PageLayout
      header={t('users-list.header')}
      breadcrumbs={[
        { text: t('home.breadcrumb'), href: '/' },
        { text: t('topnav.registration'), href: '/registration' },
        { text: t('users.breadcrumb') },
      ]}
    >
      <Table
        {...collectionProps}
        header={
          <Header
            counter={
              selectedItems.length
                ? `(${selectedItems.length}/${users.length})`
                : `(${users.length})`
            }
          >
            {t('users.header-list')}
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
            filteringAriaLabel={t('users.filter-groups')}
          />
        }
        loading={isLoading}
        loadingText={t('users.loading-groups')}
        visibleColumns={preferences.visibleContent}
        selectedItems={selectedItems}
        stickyHeader="true"
        trackBy="GroupName"
        resizableColumns
        preferences={
          <TablePreferences
            preferences={preferences}
            setPreferences={setPreferences}
            contentOptions={visibleContentOptions}
          />
        }
      />
    </PageLayout>
  );
};
