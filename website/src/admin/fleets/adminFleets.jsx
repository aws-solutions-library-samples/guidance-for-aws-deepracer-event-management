import { Button, SpaceBetween } from '@cloudscape-design/components';
import { API } from 'aws-amplify';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '../../components/pageLayout';
import * as mutations from '../../graphql/mutations';

import { DeleteModal, ItemList } from '../../components/deleteModal';
import { SimpleHelpPanelLayout } from '../../components/help-panels/simple-help-panel';
import { TableHeader } from '../../components/tableConfig';

import { PageTable } from '../../components/pageTable';
import { useUsers } from '../../hooks/useUsers';
import { useStore } from '../../store/store';
import { ColumnConfiguration, FilteringProperties } from './fleetsTableConfig';
import { Breadcrumbs } from './support-functions/supportFunctions';

const AdminFleets = () => {
  const { t } = useTranslation(['translation', 'help-admin-fleets']);
  const [selectedFleetsInTable, setSelectedFleetsInTable] = useState([]);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  const [state] = useStore();
  const fleets = state.fleets.fleets;
  const isLoading = state.fleets.isLoading;
  const [, , getUserNameFromId] = useUsers();

  const navigate = useNavigate();
  const [columnConfiguration] = useState(() => ColumnConfiguration(getUserNameFromId));
  const [filteringProperties] = useState(() => FilteringProperties());

  // Edit Fleet
  const editFleetHandler = () => {
    navigate('/admin/fleets/edit', { state: selectedFleetsInTable[0] });
  };

  // Create Fleet
  const createFleetHandler = () => {
    navigate('/admin/fleets/create');
  };

  // Delete Fleet
  async function deleteFleets() {
    const fleetIdsToDelete = selectedFleetsInTable.map((fleet) => fleet.fleetId);
    await API.graphql({
      query: mutations.deleteFleets,
      variables: {
        fleetIds: fleetIdsToDelete,
      },
    });
    setSelectedFleetsInTable([]);
  }

  const HeaderActionButtons = () => {
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
  breadcrumbs.push({ text: t('fleets.breadcrumb') });

  return (
    <PageLayout
      helpPanelHidden={false}
      helpPanelContent={
        <SimpleHelpPanelLayout
          headerContent={t('header', { ns: 'help-admin-fleets' })}
          bodyContent={t('content', { ns: 'help-admin-fleets' })}
          footerContent={t('footer', { ns: 'help-admin-fleets' })}
        />
      }
      header={t('fleets.header')}
      description={t('fleets.description')}
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
            actions={<HeaderActionButtons />}
          />
        }
        itemsIsLoading={isLoading}
        loadingText={t('fleets.loading')}
        localStorageKey={'fleets-table-preferences'}
        trackBy={'fleetId'}
        filteringProperties={filteringProperties}
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
