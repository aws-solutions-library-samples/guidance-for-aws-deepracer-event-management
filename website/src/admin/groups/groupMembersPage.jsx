import { useCollection } from '@cloudscape-design/collection-hooks';
import {
  Button,
  Header,
  Icon,
  Pagination,
  StatusIndicator,
  Table,
  TextFilter,
  Toggle,
} from '@cloudscape-design/components';
import { Auth } from 'aws-amplify';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { PageLayout } from '../../components/pageLayout';
import {
  DefaultPreferences,
  EmptyState,
  MatchesCountText,
  TablePreferences,
} from '../../components/tableConfig';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useNotificationsDispatch } from '../../store/appLayoutProvider';
import { useUsersContext } from '../../store/storeProvider';
import { formatAwsDateTime } from '../../support-functions/time';
import {
  addUserToGroupMutation,
  getGroupMembersQuery,
  removeUserFromGroupMutation,
} from './helper-functions/apiCalls';

export function GroupMembersPage() {
  const { t } = useTranslation();

  const { groupName } = useParams();
  const [usersWithGroupMetaData, setUsersWithGroupMetaData] = useState([]);
  const [selectedItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const setNotifications = useNotificationsDispatch();

  const [users] = useUsersContext();

  useEffect(() => {
    const getMembersInGroup = async () => {
      //add group meta data to users objects
      const usersWithMetaData = users.map((u) => ({
        ...u,
        isMember: false,
        currentUser: false,
      }));

      const groupUsers = await getGroupMembersQuery(groupName);
      console.info(groupUsers);

      groupUsers.forEach((group) => {
        const i = usersWithMetaData.findIndex((user) => user.Username === group.Username);
        users[i].isMember = true;
      });

      // Need to get the current user and flag them in the data
      // (Current user can't remove themselves from a group they are members of)
      Auth.currentAuthenticatedUser().then((loggedInUser) => {
        const i = users.findIndex((user) => user.Username === loggedInUser.username);
        users[i].currentUser = true;
      });

      setUsersWithGroupMetaData(users);
      setIsLoading(false);
    };

    getMembersInGroup();

    return () => {
      // Unmounting
    };
  }, [groupName, users]);

  const toggleUser = (user) => {
    const updateUserMembership = async () => {
      // Check user is not attempting to remove self
      const username = user.Username;
      if (user.isMember) {
        console.info('remove user from group');
        await removeUserFromGroupMutation(username, groupName);
      } else {
        console.info('add user to group');
        await addUserToGroupMutation(username, groupName);
      }

      // Update group membership status for updated user
      const i = usersWithGroupMetaData.findIndex((user) => user.Username === username);
      console.info(i);
      if (i > -1) {
        const updatedUsersWithGroupMetaData = [...usersWithGroupMetaData];
        console.info(updatedUsersWithGroupMetaData[i].isMember);
        updatedUsersWithGroupMetaData[i].isMember = !updatedUsersWithGroupMetaData[i].isMember;
        console.info(updatedUsersWithGroupMetaData[i].isMember);
        setUsersWithGroupMetaData(updatedUsersWithGroupMetaData);
      }
    };

    updateUserMembership().catch((e) => {
      setNotifications([
        {
          type: 'error',
          content: e.errors[0].message + ', user membership could not be changed',
          id: 'group_error',
          dismissible: true,
          onDismiss: () => {
            setNotifications([]);
          },
        },
      ]);
      console.info(e.errors[0].message);
    });
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
      cell: (item) => formatAwsDateTime(item.UserCreateDate) || '-',
      sortingField: 'userCreationDate',
      width: 200,
      minWidth: 150,
    },
    {
      id: 'userLastModifiedDate',
      header: t('groups.detail.header-last-modified-date'),
      cell: (item) => formatAwsDateTime(item.UserLastModifiedDate) || '-',
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
    useCollection(usersWithGroupMetaData, {
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
    <PageLayout
      header={t('groups.detail.content-header', { groupName })}
      description={t('groups.detail.content-description', { groupName })}
      breadcrumbs={[
        { text: t('home.breadcrumb'), href: '/' },
        { text: t('admin.breadcrumb'), href: '/admin/home' },
        { text: t('groups.breadcrumb'), href: '/admin/groups' },
        { text: groupName },
      ]}
    >
      <Table
        {...collectionProps}
        header={
          <Header
            counter={
              selectedItems.length
                ? `(${selectedItems.length}/${usersWithGroupMetaData.length})`
                : `(${usersWithGroupMetaData.length})`
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
          <>
            <TextFilter
              {...filterProps}
              countText={MatchesCountText(filteredItemsCount)}
              filteringAriaLabel={t('groups.detail.filter-users')}
            ></TextFilter>
          </>
        }
        loading={isLoading}
        loadingText={t('groups.detail.loading-users')}
        visibleColumns={preferences.visibleContent}
        stickyHeader="true"
        trackBy="Username"
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
}
