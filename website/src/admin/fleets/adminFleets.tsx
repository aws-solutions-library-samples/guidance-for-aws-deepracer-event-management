import { Button, SpaceBetween } from '@cloudscape-design/components';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { DeleteModal, ItemList } from '../../components/deleteModal';
import { SimpleHelpPanelLayout } from '../../components/help-panels/simple-help-panel';
import { PageLayout } from '../../components/pageLayout';
import { PageTable } from '../../components/pageTable';
import { TableHeader } from '../../components/tableConfig';
import { graphqlMutate } from '../../graphql/graphqlHelpers';
import * as mutations from '../../graphql/mutations';
import { useUsers } from '../../hooks/useUsers';
import { useStore } from '../../store/store';
import { FleetConfig } from './fleetDomain';
import { ColumnConfiguration, FilteringProperties } from './fleetsTableConfig';
import { Breadcrumbs } from './support-functions/supportFunctions';

/**
 * AdminFleets component for managing fleet configurations
 * @returns Rendered fleet management page
 */
const AdminFleets = (): JSX.Element => {
  const { t } = useTranslation(['translation', 'help-admin-fleets']);
  const [selectedFleetsInTable, setSelectedFleetsInTable] = useState<FleetConfig[]>([]);
  const [deleteModalVisible, setDeleteModalVisible] = useState<boolean>(false);

  const [state] = useStore();
  const fleets = (state.fleets?.fleets || []) as FleetConfig[];
  const isLoading = state.fleets?.isLoading || false;
  const userFunctions = useUsers();
  const getUserNameFromId = userFunctions[2] as (userId: string) => string;

  const navigate = useNavigate();
  const [columnConfiguration] = useState(() => ColumnConfiguration(getUserNameFromId));
  const [filteringProperties] = useState(() => FilteringProperties());

  // Edit Fleet
  const editFleetHandler = (): void => {
    navigate('/admin/fleets/edit', { state: selectedFleetsInTable[0] });
  };

  // Create Fleet
  const createFleetHandler = (): void => {
    navigate('/admin/fleets/create');
  };

  // Delete Fleet
  async function deleteFleets(): Promise<void> {
    const fleetIdsToDelete = selectedFleetsInTable.map((fleet) => fleet.fleetId);
    await graphqlMutate(mutations.deleteFleets, { fleetIds: fleetIdsToDelete });
    setSelectedFleetsInTable([]);
  }

  const HeaderActionButtons = (): JSX.Element => {
    const disableEditButton =
      selectedFleetsInTable.length === 0 || selectedFleetsInTable.length > 1;
    const disableDeleteButton = selectedFleetsInTable.length === 0;
    return (
      <SpaceBetween direction="horizontal" size="xs">
        <Button disabled={disableEditButton} onClick={editFleetHandler}>
          {t('button.edit')}
        </Button>
        <Button disabled={disableDeleteButton} onClick={() => setDeleteModalVisible(true)}>
          {t('button.delete')}
        </Button>
        <Button variant="primary" onClick={createFleetHandler}>
          {t('button.create')}
        </Button>
      </SpaceBetween>
    );
  };

  const breadcrumbs = Breadcrumbs();
  breadcrumbs.push({ text: t('fleets.breadcrumb'), href: '' });

  return (
    <PageLayout
      helpPanelHidden={false}
      helpPanelContent={
        <SimpleHelpPanelLayout
          headerContent={t('header', { ns: 'help-admin-fleets' })}
          bodyContent={t('content', { ns: 'help-admin-fleets' })}
          footerContent={t('footer', { ns: 'help-admin-fleets' })}
        /> as any
      }
      header={t('fleets.header')}
      description={t('fleets.description')}
      onLinkClick={(event: React.MouseEvent) => event.preventDefault()}
      breadcrumbs={breadcrumbs}
    >
      <PageTable
        selectedItems={selectedFleetsInTable}
        setSelectedItems={setSelectedFleetsInTable}
        tableItems={fleets}
        selectionType="multi"
        columnConfiguration={columnConfiguration}
        header={
          <TableHeader
            nrSelectedItems={selectedFleetsInTable.length}
            nrTotalItems={fleets.length}
            header={t('fleets.table-header')}
            actions={<HeaderActionButtons /> as any}
          />
        }
        itemsIsLoading={isLoading}
        loadingText={t('fleets.loading')}
        localStorageKey={'fleets-table-preferences'}
        trackBy={'fleetId'}
        filteringProperties={filteringProperties as any}
        filteringI18nStringsName={'fleets'}
      />

      <DeleteModal
        header={t('fleets.delete-fleet')}
        onDelete={deleteFleets}
        onVisibleChange={setDeleteModalVisible}
        visible={deleteModalVisible}
      >
        {t('fleets.delete-warning')}: <br></br>{' '}
        <ItemList items={selectedFleetsInTable.map((selectedFleet) => selectedFleet.fleetName)} />
      </DeleteModal>
    </PageLayout>
  );
};

export { AdminFleets };
