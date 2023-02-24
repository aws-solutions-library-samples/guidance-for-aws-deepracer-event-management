import { useCollection } from '@cloudscape-design/collection-hooks';
import {
  Button, CollectionPreferences, Container, Form, FormField, Header, Input, Pagination, SpaceBetween, Table,
  TextFilter
} from '@cloudscape-design/components';
import { API } from 'aws-amplify';
import dayjs from 'dayjs';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ContentHeader } from '../../components/contentHeader';
import {
  DefaultPreferences,
  EmptyState,
  MatchesCountText,
  PageSizePreference,
  WrapLines
} from '../../components/tableConfig';
import * as mutations from '../../graphql/mutations';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useUsersApi } from '../../hooks/useUsersApi';

// day.js
var advancedFormat = require('dayjs/plugin/advancedFormat');
var utc = require('dayjs/plugin/utc');
var timezone = require('dayjs/plugin/timezone'); // dependent on utc plugin

dayjs.extend(advancedFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

export function CreateUser() {
  const { t } = useTranslation();

  const [selectedItems] = useState([]);
  const [users, isLoading ] = useUsersApi();
  const [preferences, setPreferences] = useLocalStorage('DREM-user-table-preferences', {
    ...DefaultPreferences,
    visibleContent: ['username', 'creationDate'],
  });
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [result, setResult] = useState('');
  const [buttonDisabled, setButtonDisabled] = useState(false);

  async function createUserNow() {
    const apiResponse = await API.graphql({
      query: mutations.createUser,
      variables: {
        email: email,
        username: username,
      },
    });
    const response = apiResponse['data']['createUser'];
    console.log(response);
    setResult(response);
    setUsername('');
    setEmail('');
  }

  // watch properties for changes and enable generate button if required
  useEffect(() => {
    if (username !== '' && email !== '') {
      setButtonDisabled(false);
    }
    else {
      setButtonDisabled(true);
    }
    return () => {
      // Unmounting
    };
  }, [username, email]);

  const columnsConfig = [
    {
      id: 'username',
      header: t('users.header-username'),
      cell: (item) => item.Username || '-',
      sortingField: 'username',
      width: 200,
      minWidth: 150,
    },
    {
      id: 'creationDate',
      header: t('users.header-creation-date'),
      cell: (item) => dayjs(item.UserCreateDate).format('YYYY-MM-DD HH:mm:ss (z)') || '-',
      sortingField: 'creationDate',
      width: 200,
      minWidth: 150,
    },
    {
      id: 'lastModifiedDate',
      header: t('users.header-last-modified-date'),
      cell: (item) => dayjs(item.UserLastModifiedDate).format('YYYY-MM-DD HH:mm:ss (z)') || '-',
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
          id: 'username',
          label: t('users.header-username'),
          editable: false,
        },
        {
          id: 'creationDate',
          label: t('users.header-creation-date'),
        },
        {
          id: 'lastModifiedDate',
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
      sorting: { defaultState: { sortingColumn: columnsConfig[1], isDescending:true } },
      selection: {},
    });

  return (
    <>
      <ContentHeader
        header={t('users.header')}
        description={t('users.description')}
        breadcrumbs={[
          { text: t('home.breadcrumb'), href: '/' },
          { text: t('admin.breadcrumb'), href: '/admin/home' },
          { text: t('users.breadcrumb') },
        ]}
      />
      <SpaceBetween direction="vertical" size="l">
        <Form
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="primary"
                onClick={() => {
                  createUserNow();
                }}
                disabled={buttonDisabled}
              >
                {t('users.create-user')}
              </Button>
            </SpaceBetween>
          }
        >
          <Container textAlign="center">
            <SpaceBetween direction="vertical" size="l">
              <FormField label={t('users.racer-name')} errorText=''>
                <Input
                  value={username}
                  placeholder={t('users.racer-name-placeholder')}
                  onChange={(input) => {
                    setUsername(input.detail.value);
                  }}
                />
              </FormField>
              <FormField label={t('users.email')} errorText=''>
                <Input
                  value={email}
                  placeholder={t('users.email-placeholder')}
                  onChange={(input) => {
                    setEmail(input.detail.value);
                  }}
                />
              </FormField>
            </SpaceBetween>
          </Container>

        </Form>

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
            <CollectionPreferences
              title={t('table.preferences')}
              confirmLabel={t('button.confirm')}
              cancelLabel={t('button.cancel')}
              onConfirm={({ detail }) => setPreferences(detail)}
              preferences={preferences}
              pageSizePreference={PageSizePreference(t('users.page-size-label'))}
              visibleContentPreference={{
                title: t('table.select-visible-colunms'),
                options: visibleContentOptions,
              }}
              wrapLinesPreference={WrapLines}
            />
          }
        />
      </SpaceBetween>
    </>
    
  );
}
