import { useCollection } from '@cloudscape-design/collection-hooks';
import { Button, Pagination, PropertyFilter, Table } from '@cloudscape-design/components';
import { Auth } from 'aws-amplify';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SimpleHelpPanelLayout } from '../../components/help-panels/simple-help-panel';
import { PageLayout } from '../../components/pageLayout';
import {
  PropertyFilterI18nStrings,
  TableEmptyState,
  TableNoMatchState,
} from '../../components/tableCommon';
import {
  DefaultPreferences,
  MatchesCountText,
  TableHeader,
  TablePreferences,
} from '../../components/tableConfig';
import {
  ColumnDefinitions,
  FilteringProperties,
  VisibleContentOptions,
} from '../../components/tableUserConfig';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import useMutation from '../../hooks/useMutation';
import { useStore } from '../../store/store';
import { ChangeRoleModal } from './changeRoleModal';

export const UserManagement = () => {
  const { t } = useTranslation(['translation', 'help-admin-users-list']);

  const [selectedItems, setSelectedItems] = useState([]);
  const [changeRoleModalVisible, setChangeRoleModalVisible] = useState(false);
  const [send] = useMutation();
  const [state] = useStore();
  const currentUser = Auth.user;
  const users = state.users.users;
  const isLoading = state.users.isLoading;

  const [preferences, setPreferences] = useLocalStorage('DREM-user-table-preferences', {
    ...DefaultPreferences,
    visibleContent: ['Username', 'Roles', 'UserStatus', 'UserCreateDate'],
  });

  // Role membership management
  const changeRoleHandler = (role) => {
    setSelectedItems((prevState) => {
      prevState.forEach((selectedUser) => {
        if (role === 'racer') role = [];
        send('updateUser', {
          username: selectedUser.Username,
          roles: role,
        });
      });

      return [];
    });
    setChangeRoleModalVisible(false);
  };

  // Table config
  const columnDefinitions = ColumnDefinitions();
  const filteringProperties = FilteringProperties();
  const visibleContentOptions = VisibleContentOptions();

  const {
    items,
    actions,
    filteredItemsCount,
    collectionProps,
    paginationProps,
    propertyFilterProps,
  } = useCollection(users, {
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
    sorting: { defaultState: { sortingColumn: columnDefinitions[0], isDescending: false } },
    selection: {},
  });
  return (
    <PageLayout
      helpPanelHidden={true}
      helpPanelContent={
        <SimpleHelpPanelLayout
          headerContent={t('header', { ns: 'help-admin-users-list' })}
          bodyContent={t('content', { ns: 'help-admin-users-list' })}
          footerContent={t('footer', { ns: 'help-admin-users-list' })}
        />
      }
      header={t('users-list.header')}
      breadcrumbs={[
        { text: t('home.breadcrumb'), href: '/' },
        { text: t('admin.breadcrumb'), href: '/home/admin' },
        { text: t('users-admin.breadcrumb') },
      ]}
    >
      <Table
        {...collectionProps}
        header={
          <TableHeader
            nrSelectedItems={selectedItems.length}
            nrTotalItems={users.length}
            header={t('users.header-list')}
            actions={
              <>
                <Button onClick={() => setChangeRoleModalVisible(true)}>
                  {t('users-admin.change-role-button')}
                </Button>
              </>
            }
          />
        }
        isItemDisabled={(item) => item.sub === currentUser.attributes.sub}
        columnDefinitions={columnDefinitions}
        items={items}
        onSelectionChange={({ detail }) => {
          setSelectedItems(detail.selectedItems);
        }}
        selectedItems={selectedItems}
        selectionType="multi"
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
        loadingText={t('users.loading-groups')}
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
      <ChangeRoleModal
        onDismiss={() => setChangeRoleModalVisible(false)}
        visible={changeRoleModalVisible}
        onSave={(data) => {
          changeRoleHandler(data);
        }}
      />
    </PageLayout>
  );
};
