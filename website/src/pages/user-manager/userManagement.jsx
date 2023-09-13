import { Button, SpaceBetween } from '@cloudscape-design/components';
import { Auth } from 'aws-amplify';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SimpleHelpPanelLayout } from '../../components/help-panels/simple-help-panel';
import { PageLayout } from '../../components/pageLayout';
import { PageTable } from '../../components/pageTable';
import { TableHeader } from '../../components/tableConfig';
import { ColumnConfiguration, FilteringProperties } from '../../components/tableUserConfig';
import useMutation from '../../hooks/useMutation';
import { useStore } from '../../store/store';
import { ChangeRoleModal } from './changeRoleModal';

export const UserManagement = () => {
  const { t } = useTranslation(['translation', 'help-admin-users']);

  const [selectedItems, setSelectedItems] = useState([]);
  const [changeRoleModalVisible, setChangeRoleModalVisible] = useState(false);
  const [send] = useMutation();
  const [state] = useStore();
  const currentUser = Auth.user;
  const users = state.users.users;
  const isLoading = state.users.isLoading;

  // Role membership management
  const changeRoleHandler = (role) => {
    setSelectedItems((prevState) => {
      prevState.forEach((selectedUser) => {
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
  const columnConfiguration = ColumnConfiguration();
  const filteringProperties = FilteringProperties();

  const HeaderActionButtons = () => {
    const disableChangeRoleButton = selectedItems.length === 0;
    return (
      <SpaceBetween direction="horizontal" size="xs">
        <Button disabled={disableChangeRoleButton} onClick={() => setChangeRoleModalVisible(true)}>
          {t('users-admin.change-role-button')}
        </Button>
      </SpaceBetween>
    );
  };

  return (
    <PageLayout
      helpPanelHidden={false}
      helpPanelContent={
        <SimpleHelpPanelLayout
          headerContent={t('header', { ns: 'help-admin-users' })}
          bodyContent={t('content', { ns: 'help-admin-users' })}
          footerContent={t('footer', { ns: 'help-admin-users' })}
        />
      }
      header={t('users-list.header')}
      breadcrumbs={[
        { text: t('home.breadcrumb'), href: '/' },
        { text: t('admin.breadcrumb'), href: '/home/admin' },
        { text: t('users-admin.breadcrumb') },
      ]}
    >
      <PageTable
        selectedItems={selectedItems}
        setSelectedItems={setSelectedItems}
        tableItems={users}
        selectionType="multi"
        columnConfiguration={columnConfiguration}
        isItemDisabled={(item) => item.sub === currentUser.attributes.sub}
        header={
          <TableHeader
            nrSelectedItems={selectedItems.length}
            nrTotalItems={users.length}
            header={t('users.header-list')}
            actions={<HeaderActionButtons />}
          />
        }
        itemsIsLoading={isLoading}
        loadingText={t('users.loading-groups')}
        localStorageKey="users-table-preferences"
        trackBy="Username"
        filteringProperties={filteringProperties}
        filteringI18nStringsName="users"
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
