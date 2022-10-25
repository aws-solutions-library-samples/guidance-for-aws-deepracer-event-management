import React, { useEffect, useState } from 'react';
import { API, Auth } from 'aws-amplify';
import { useParams } from 'react-router-dom'
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
var advancedFormat = require('dayjs/plugin/advancedFormat')
var utc = require('dayjs/plugin/utc')
var timezone = require('dayjs/plugin/timezone') // dependent on utc plugin

dayjs.extend(advancedFormat)
dayjs.extend(utc)
dayjs.extend(timezone)

export function AdminGroupsDetail() {
  const { groupName } = useParams();
  const [allItems, setItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [refreshKey, setRefreshKey] = useState(0);

  const apiName = 'deepracerEventManager';

  useEffect(() => {
    const getData = async() => {
      const apiUserPath = 'users';

      const userRsponse = await API.get(apiName, apiUserPath);
      const users = userRsponse.map(u =>
        ({
          ...u,
          isMember: false,
          currentUser: false,
        })
      );

      const apiGroupPath = 'admin/groups/' + groupName;
      const groupResponse = await API.get(apiName, apiGroupPath);
      groupResponse.forEach(group => {
        const i = users.findIndex((user => user.Username === group.Username));
        users[i].isMember = true;
      });

      // Need to get the current user and flag them in the data
      // (Current user can't remove themselves from a group they are members of)
      Auth.currentAuthenticatedUser().then(loggedInUser => {
        const i = users.findIndex((user => user.Username === loggedInUser.username));
        users[i].currentUser = true;
      });

      setItems(users);
      setIsLoading(false);
    }

    getData();
    return() => {
      // Unmounting
    }

  },[refreshKey]);

  const toggleUser = (user) => {
    const apiName = 'deepracerEventManager';

    // Check user is not attempting to remove self

    if (user.isMember) {
      const apiGroupUserPath = 'admin/groups/' + groupName + '/' + user.Username;
      API.del(apiName, apiGroupUserPath)
    } else {
      const apiGroupUserPath = 'admin/groups/' + groupName;
      const params = {
        body: {
          username: user.Username
        },
      };
      API.post(apiName, apiGroupUserPath, params)
    }

    // need to reload the user data
    setRefreshKey(refreshKey + 1);
  }

  const userToggle = (user) => {
    if (!user.currentUser) {
      return (
        <Toggle
          onChange={({}) =>
            toggleUser(user)
          }
          checked={user.isMember}
        />
      )
    } else {
      return ( <Icon name='user-profile' />)
    };
  }

  const [preferences, setPreferences] = useState({
    ...DefaultPreferences,
    visibleContent: ['userName', 'isMember'],
  });

  const columnsConfig = [
    {
      id: 'userName',
      header: 'User name',
      cell: item => item.Username,
      sortingField: 'userName',
    },
    {
      id: 'userCreationDate',
      header: 'Creation date',
      cell: item => dayjs(item.UserCreateDate).format('YYYY-MM-DD HH:mm:ss (z)') || '-',
      sortingField: 'userCreationDate',
    },
    {
      id: 'userLastModifiedDate',
      header: 'Last modified date',
      cell: item => dayjs(item.UserLastModifiedDate).format('YYYY-MM-DD HH:mm:ss (z)') || '-',
      sortingField: 'userLastModifiedDate',
    },
    {
      id: 'isMember',
      header: 'Group member?',
      cell: item => userToggle(item),
      sortingField: 'isMember'
    },
    {
      id: 'isEnabled',
      header: 'User enabled?',
      cell: item => <StatusIndicator {...isMemberIndicator[item.Enabled]} />,
      sortingField: 'isEnabled'
    }
  ];

  const visibleContentOptions = [
    {
      label: 'User information',
      options: [
        {
          id: 'userName',
          label: 'User name',
          editable: false,
        },
        {
          id: 'userCreationDate',
          label: 'Creation date',
        },
        {
          id: 'userLastModifiedDate',
          label: 'Last modified date',
        },
        {
          id: 'isMember',
          label: 'Group member?',
        },
        {
          id: 'isEnabled',
          label: 'User enabled',
        }
      ]
    }
  ]

  const {items, actions, filteredItemsCount, collectionProps, filterProps, paginationProps } = useCollection(
    allItems,
    {
      filtering: {
        empty: (
          <EmptyState
            title="No users"
            subtitle="No users have been defined."
          />
        ),
        noMatch: (
          <EmptyState
            title="No matches"
            subtitle="We can’t find a match."
            action={<Button onClick={() => actions.setFiltering('')}>Clear filter</Button>}
          />
        ),
      },
      pagination: { pageSize: preferences.pageSize },
      sorting: { defaultState: { sortingColumn: columnsConfig[0] } },
      selection: {},
    }
  );

  const isMemberIndicator = {
    true: { type: 'success', children: ''},
    false: { type: 'error', children: ''},
  };

  return (
    <>
      <ContentHeader
        header={"Group '"  + groupName + "' admin"}
        description={"Add / remove users from the '" + groupName + "' group."}
        breadcrumbs={[
          { text: "Home", href: "/" },
          { text: "Admin", href: "/admin/home" },
          { text: "Groups", href: "/admin/groups" },
          { text: groupName }
        ]}
      />

      <Grid gridDefinition={[{ colspan: 2 }, { colspan: 8 }, { colspan: 2 }]}>
        <div></div>
        <Table
          {...collectionProps}
          header={
            <Header
              counter={selectedItems.length ? `(${selectedItems.length}/${allItems.length})` : `(${allItems.length})`}
            >
              Groups
            </Header>
          }
          columnDefinitions={columnsConfig}
          items={items}
          pagination={
            <Pagination {...paginationProps}
            ariaLabels={{
              nextPageLabel: 'Next page',
              previousPageLabel: 'Previous page',
              pageLabel: pageNumber => `Go to page ${pageNumber}`,
            }}
          />}
          filter={
            <TextFilter
              {...filterProps}
              countText={MatchesCountText(filteredItemsCount)}
              filteringAriaLabel='Filter users'
            />
          }
          loading={isLoading}
          loadingText='Loading users'
          visibleColumns={preferences.visibleContent}
          trackBy='Username'
          resizableColumns
          preferences={
            <CollectionPreferences
              title='Preferences'
              confirmLabel='Confirm'
              cancelLabel='Cancel'
              onConfirm={({ detail }) => setPreferences(detail)}
              preferences={preferences}
              pageSizePreference={PageSizePreference('users')}
              visibleContentPreference={{
                title: 'Select visible columns',
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
