import { useCollection } from '@cloudscape-design/collection-hooks';
import {
  Button,
  CollectionPreferences,
  Grid,
  Header,
  Icon,
  Pagination,
  StatusIndicator,
  Table,
  TextFilter,
  Toggle,
} from '@cloudscape-design/components';
import { API, Auth } from 'aws-amplify';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { useLocalStorage } from '../../hooks/useLocalStorage.js';

import { ContentHeader } from '../../components/ContentHeader';
import {
  DefaultPreferences,
  EmptyState,
  MatchesCountText,
  PageSizePreference,
  WrapLines,
} from '../../components/TableConfig';

import dayjs from 'dayjs';

// day.js
var advancedFormat = require('dayjs/plugin/advancedFormat');
var utc = require('dayjs/plugin/utc');
var timezone = require('dayjs/plugin/timezone'); // dependent on utc plugin

dayjs.extend(advancedFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

export function AdminGroupsDetail() {
  const { t } = useTranslation();

  const { groupName } = useParams();
  const [allItems, setItems] = useState([]);
  const [selectedItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [refreshKey, setRefreshKey] = useState(0);

  const apiName = 'deepracerEventManager';

  useEffect(() => {
    const getData = async () => {
      const apiUserPath = 'users';

      const userRsponse = await API.get(apiName, apiUserPath);
      const users = userRsponse.map((u) => ({
        ...u,
        isMember: false,
        currentUser: false,
      }));

      const apiGroupPath = 'admin/groups/' + groupName;
      const groupResponse = await API.get(apiName, apiGroupPath);
      groupResponse.forEach((group) => {
        const i = users.findIndex((user) => user.Username === group.Username);
        users[i].isMember = true;
      });

      // Need to get the current user and flag them in the data
      // (Current user can't remove themselves from a group they are members of)
      Auth.currentAuthenticatedUser().then((loggedInUser) => {
        const i = users.findIndex((user) => user.Username === loggedInUser.username);
        users[i].currentUser = true;
      });

      setItems(users);
      setIsLoading(false);
    };

    getData();
    return () => {
      // Unmounting
    };
  }, [refreshKey, groupName]);

  const toggleUser = (user) => {
    const apiName = 'deepracerEventManager';

    // Check user is not attempting to remove self

    if (user.isMember) {
      const apiGroupUserPath = 'admin/groups/' + groupName + '/' + user.Username;
      API.del(apiName, apiGroupUserPath);
    } else {
      const apiGroupUserPath = 'admin/groups/' + groupName;
      const params = {
        body: {
          username: user.Username,
        },
      };
      API.post(apiName, apiGroupUserPath, params);
    }

    // need to reload the user data
    setRefreshKey(refreshKey + 1);
  };

  const userToggle = (user) => {
    if (!user.currentUser) {
      return <Toggle onChange={() => toggleUser(user)} checked={user.isMember} />;
    } else {
      return <Icon name="user-profile" />;
    }
  };

  const [preferences, setPreferences] = useLocalStorage('DREM-groups-details-table-preferences', {
    ...DefaultPreferences,
    visibleContent: ['userName', 'isMember'],
  });

  const columnsConfig = [
    {
      id: 'userName',
      header: t('groups.detail.header-name'),
      cell: (item) => item.Username,
      sortingField: 'userName',
      width: 200,
      minWidth: 150,
    },
    {
      id: 'userCreationDate',
      header: t('groups.detail.header-creation-date'),
      cell: (item) => dayjs(item.UserCreateDate).format('YYYY-MM-DD HH:mm:ss (z)') || '-',
      sortingField: 'userCreationDate',
      width: 200,
      minWidth: 150,
    },
    {
      id: 'userLastModifiedDate',
      header: t('groups.detail.header-last-modified-date'),
      cell: (item) => dayjs(item.UserLastModifiedDate).format('YYYY-MM-DD HH:mm:ss (z)') || '-',
      sortingField: 'userLastModifiedDate',
      width: 200,
      minWidth: 150,
    },
    {
      id: 'isMember',
      header: t('groups.detail.header-group-member'),
      cell: (item) => userToggle(item),
      sortingField: 'isMember',
      width: 200,
      minWidth: 150,
    },
    {
      id: 'isEnabled',
      header: t('groups.detail.header-user-enabled'),
      cell: (item) => <StatusIndicator {...isMemberIndicator[item.Enabled]} />,
      sortingField: 'isEnabled',
      width: 200,
      minWidth: 150,
    },
  ];

  const visibleContentOptions = [
    {
      label: t('groups.detail.infromation'),
      options: [
        {
          id: 'userName',
          label: t('groups.detail.header-name'),
          editable: false,
        },
        {
          id: 'userCreationDate',
          label: t('groups.detail.header-creation-date'),
        },
        {
          id: 'userLastModifiedDate',
          label: t('groups.detail.header-last-modified-date'),
        },
        {
          id: 'isMember',
          label: t('groups.detail.header-group-member'),
        },
        {
          id: 'isEnabled',
          label: t('groups.detail.header-user-enabled'),
        },
      ],
    },
  ];

  const { items, actions, filteredItemsCount, collectionProps, filterProps, paginationProps } =
    useCollection(allItems, {
      filtering: {
        empty: (
          <EmptyState
            title={t('groups.no-users')}
            subtitle={t('groups.no-users-have-been-defined')}
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

  const isMemberIndicator = {
    true: { type: 'success', children: '' },
    false: { type: 'error', children: '' },
  };

  return (
    <>
      <ContentHeader
        header={t('groups.detail.content-header', { groupName })}
        description={t('groups.detail.content-description', { groupName })}
        breadcrumbs={[
          { text: t('home.breadcrumb'), href: '/' },
          { text: t('admin.breadcrumb'), href: '/admin/home' },
          { text: t('groups.breadcrumb'), href: '/admin/groups' },
          { text: groupName },
        ]}
      />

      <Grid gridDefinition={[{ colspan: 1 }, { colspan: 10 }, { colspan: 1 }]}>
        <div></div>
        <Table
          {...collectionProps}
          header={
            <Header
              counter={
                selectedItems.length
                  ? `(${selectedItems.length}/${allItems.length})`
                  : `(${allItems.length})`
              }
            >
              {t('groups.detail.header')}
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
              filteringAriaLabel={t('groups.detail.filter-users')}
            />
          }
          loading={isLoading}
          loadingText={t('groups.detail.loading-users')}
          visibleColumns={preferences.visibleContent}
          stickyHeader="true"
          trackBy="Username"
          resizableColumns
          preferences={
            <CollectionPreferences
              title={t('table.preferences')}
              confirmLabel={t('button.confirm')}
              cancelLabel={t('button.cancel')}
              onConfirm={({ detail }) => setPreferences(detail)}
              preferences={preferences}
              pageSizePreference={PageSizePreference(t('groups.detail.page-size-label'))}
              visibleContentPreference={{
                title: t('table.select-visible-colunms'),
                options: visibleContentOptions,
              }}
              wrapLinesPreference={WrapLines}
            />
          }
        />
      </Grid>
    </>
  );
}
