import { Button, SpaceBetween } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SimpleHelpPanelLayout } from '../../components/help-panels/simple-help-panel';
import { PageLayout } from '../../components/pageLayout';
import { PageTable } from '../../components/pageTable';
import { TableHeader } from '../../components/tableConfig';
import { ColumnConfiguration, FilteringProperties } from '../../components/tableUserConfig';
import { getCurrentAuthUser } from '../../hooks/useAuth';
import useMutation from '../../hooks/useMutation';
import { useStore } from '../../store/store';
import { ChangeRoleModal } from './changeRoleModal';

interface User {
  Username: string;
  sub: string;
}

export const UserManagement: React.FC = () => {
  const { t } = useTranslation(['translation', 'help-admin-users']);

  const [selectedItems, setSelectedItems] = useState<User[]>([]);
  const [changeRoleModalVisible, setChangeRoleModalVisible] = useState<boolean>(false);
  const [send] = useMutation() as any; // TODO: Type useMutation hook properly
  const [state] = useStore() as any; // TODO: Type store properly
  const [currentUserSub, setCurrentUserSub] = useState<string>('');
  const users: User[] = state.users.users;
  const isLoading: boolean = state.users.isLoading;

  useEffect(() => {
    getCurrentAuthUser().then((authUser) => {
      setCurrentUserSub(authUser.sub);
    });
  }, []);

  // Role membership management
  const changeRoleHandler = (role: any): void => {
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

  const HeaderActionButtons = (): JSX.Element => {
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
      description={t('users-list.description')}
      breadcrumbs={[
        { text: t('home.breadcrumb'), href: '/' },
        { text: t('admin.breadcrumb'), href: '/home/admin' },
        { text: t('users-admin.breadcrumb'), href: '' },
      ]}
    >
      <PageTable
        selectedItems={selectedItems}
        setSelectedItems={setSelectedItems}
        tableItems={users}
        selectionType="multi"
        columnConfiguration={columnConfiguration as any}
        isItemDisabled={(item: User) => item.sub === currentUserSub}
        header={
          <TableHeader
            nrSelectedItems={selectedItems.length}
            nrTotalItems={users.length}
            header={t('users.header-list')}
            actions={<HeaderActionButtons /> as any}
          /> as any
        }
        itemsIsLoading={isLoading}
        loadingText={t('users.loading-groups')}
        localStorageKey="users-table-preferences"
        trackBy="Username"
        filteringProperties={filteringProperties as any}
        filteringI18nStringsName="users"
      />

      <ChangeRoleModal
        onDismiss={() => setChangeRoleModalVisible(false)}
        visible={changeRoleModalVisible}
        onSave={(data: any) => {
          changeRoleHandler(data);
        }}
      />
    </PageLayout>
  );
};
