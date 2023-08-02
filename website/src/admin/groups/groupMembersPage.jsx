import { useCollection } from '@cloudscape-design/collection-hooks';
import {
  Header,
  Icon,
  Pagination,
  PropertyFilter,
  StatusIndicator,
  Table,
  Toggle,
} from '@cloudscape-design/components';
import { Auth } from 'aws-amplify';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { PageLayout } from '../../components/pageLayout';
import {
  PropertyFilterI18nStrings,
  TableEmptyState,
  TableNoMatchState,
} from '../../components/tableCommon';
import {
  DefaultPreferences,
  MatchesCountText,
  TablePreferences,
} from '../../components/tableConfig';
import {
  ColumnDefinitions,
  FilteringProperties,
  VisibleContentOptions,
} from '../../components/tableUserConfig';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useNotificationsDispatch, useToolsOptionsDispatch } from '../../store/appLayoutProvider';
import { useUsersContext } from '../../store/storeProvider';
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
  const [addNotification, dismissNotification] = useNotificationsDispatch();

  const [users] = useUsersContext();

  // Table config
  const columnDefinitions = ColumnDefinitions();
  const filteringProperties = FilteringProperties();
  const visibleContentOptions = VisibleContentOptions();

  // Help panel
  const toolsOptionsDispatch = useToolsOptionsDispatch();
  const helpPanelHidden = true;
  useEffect(() => {
    toolsOptionsDispatch({
      type: 'UPDATE',
      value: {
        //isOpen: true,
        isHidden: helpPanelHidden,
        // content: (
        //   <SimpleHelpPanelLayout
        //     headerContent={t('header', { ns: 'help-admin-group-members' })}
        //     bodyContent={t('content', { ns: 'help-admin-group-members' })}
        //     footerContent={t('footer', { ns: 'help-admin-group-members' })}
        //   />
        // ),
      },
    });

    return () => {
      toolsOptionsDispatch({ type: 'RESET' });
    };
  }, [toolsOptionsDispatch]);

  useEffect(() => {
    const getMembersInGroup = async () => {
      //add group meta data to users objects
      const usersWithMetaData = users.map((u) => ({
        ...u,
        isMember: false,
        currentUser: false,
      }));

      const groupUsers = await getGroupMembersQuery(groupName);

      groupUsers.forEach((group) => {
        const i = usersWithMetaData.findIndex((user) => user.Username === group.Username);
        if (i > -1) {
          users[i].isMember = true;
        }
      });

      // Need to get the current user and flag them in the data
      // (Current user can't remove themselves from a group they are members of)
      Auth.currentAuthenticatedUser().then((loggedInUser) => {
        const i = users.findIndex((user) => user.Username === loggedInUser.username);
        if (i > -1) {
          users[i].currentUser = true;
        }
      });

      setUsersWithGroupMetaData(users);
      setIsLoading(false);
    };

    getMembersInGroup();

    return () => {
      // Unmounting
    };
  }, [groupName, users]);

  useEffect(() => {
    columnDefinitions.push(
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
      }
    );

    visibleContentOptions[0]['options'].push(
      {
        id: 'isMember',
        label: t('groups.detail.header-group-member'),
      },
      {
        id: 'isEnabled',
        label: t('groups.detail.header-user-enabled'),
      }
    );
  }, []);

  const notificationId = 'group_error';
  const toggleUser = (user) => {
    const updateUserMembership = async () => {
      // Check user is not attempting to remove self
      const username = user.Username;
      if (user.isMember) {
        // console.info('remove user from group');
        await removeUserFromGroupMutation(username, groupName);
      } else {
        // console.info('add user to group');
        await addUserToGroupMutation(username, groupName);
      }

      // Update group membership status for updated user
      const i = usersWithGroupMetaData.findIndex((user) => user.Username === username);
      // console.info(i);
      if (i > -1) {
        const updatedUsersWithGroupMetaData = [...usersWithGroupMetaData];
        // console.info(updatedUsersWithGroupMetaData[i].isMember);
        updatedUsersWithGroupMetaData[i].isMember = !updatedUsersWithGroupMetaData[i].isMember;
        // console.info(updatedUsersWithGroupMetaData[i].isMember);
        setUsersWithGroupMetaData(updatedUsersWithGroupMetaData);
      }
    };

    updateUserMembership().catch((e) => {
      const userName = user.Username;
      const errorMessage = e.errors[0].message;

      addNotification({
        type: 'error',
        content: t('groups.notifications-error', { errorMessage, userName }),
        id: notificationId,
        dismissible: true,
        onDismiss: () => {
          dismissNotification(notificationId);
        },
      });
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

  const {
    items,
    actions,
    filteredItemsCount,
    collectionProps,
    paginationProps,
    propertyFilterProps,
  } = useCollection(usersWithGroupMetaData, {
    propertyFiltering: {
      filteringProperties,
      empty: <TableEmptyState resourceName="User" />,
      noMatch: (
        <TableNoMatchState
          onClearFilter={() => {
            actions.setPropertyFiltering({ tokens: [], operation: 'and' });
          }}
          label={t('common.no-matches')}
          description={t('common.we-cant-find-a-match')}
          buttonLabel={t('button.clear-filters')}
        />
      ),
    },
    pagination: { pageSize: preferences.pageSize },
    sorting: { defaultState: { sortingColumn: columnDefinitions[0] } },
    selection: {},
  });

  const isMemberIndicator = {
    true: { type: 'success', children: '' },
    false: { type: 'error', children: '' },
  };

  return (
    <PageLayout
      helpPanelHidden={helpPanelHidden}
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
        columnDefinitions={columnDefinitions}
        items={items}
        stripedRows={preferences.stripedRows}
        contentDensity={preferences.contentDensity}
        wrapLines={preferences.wrapLines}
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
          <PropertyFilter
            {...propertyFilterProps}
            i18nStrings={PropertyFilterI18nStrings('users')}
            countText={MatchesCountText(filteredItemsCount)}
            filteringAriaLabel={t('users.filter-groups')}
            expandToViewport={true}
          />
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
