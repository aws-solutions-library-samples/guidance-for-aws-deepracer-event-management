import { useCollection } from '@cloudscape-design/collection-hooks';
import { Button, Table, TextFilter } from '@cloudscape-design/components';
import { API } from 'aws-amplify';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '../../components/pageLayout';
import * as mutations from '../../graphql/mutations';

import { DeleteModal, ItemList } from '../../components/deleteModal';
import {
  DefaultPreferences,
  EmptyState,
  MatchesCountText,
  TableHeader,
  TablePagination,
  TablePreferences,
} from '../../components/tableConfig';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useToolsOptionsDispatch } from '../../store/appLayoutProvider';

import { useFleetsContext, useUsersContext } from '../../store/storeProvider';
import { ColumnDefinitions, VisibleContentOptions } from './fleetsTableConfig';

const AdminFleets = () => {
  const { t } = useTranslation();
  const [selectedFleetsInTable, setSelectedFleetsInTable] = useState([]);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [, , getUserNameFromId] = useUsersContext();

  const [fleets, isLoading] = useFleetsContext();

  const navigate = useNavigate();
  const columnDefinitions = ColumnDefinitions(getUserNameFromId);
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
        //     headerContent={t('header', { ns: 'help-admin-fleets' })}
        //     bodyContent={t('content', { ns: 'help-admin-fleets' })}
        //     footerContent={t('footer', { ns: 'help-admin-fleets' })}
        //   />
        // ),
      },
    });

    return () => {
      toolsOptionsDispatch({ type: 'RESET' });
    };
  }, [toolsOptionsDispatch]);

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

  const [preferences, setPreferences] = useLocalStorage('DREM-fleets-table-preferences', {
    ...DefaultPreferences,
    visibleContent: ['fleetName', 'fleetId', 'createdAt'],
  });

  const { items, actions, filteredItemsCount, collectionProps, filterProps, paginationProps } =
    useCollection(fleets, {
      filtering: {
        empty: <EmptyState title={t('fleets.no-fleet')} subtitle={t('fleets.no-fleet-message')} />,
        noMatch: (
          <EmptyState
            title={t('models.no-matches')}
            subtitle={t('models.we-cant-find-a-match')}
            action={
              <Button onClick={() => actions.setFiltering('')}>{t('table.clear-filter')}</Button>
            }
          />
        ),
      },
      pagination: { pageSize: preferences.pageSize },
      sorting: { defaultState: { sortingColumn: columnDefinitions[0] } },
      selection: {},
    });

  const fleetsTable = (
    <Table
      {...collectionProps}
      onSelectionChange={({ detail }) => {
        setSelectedFleetsInTable(detail.selectedItems);
      }}
      selectedItems={selectedFleetsInTable}
      selectionType="multi"
      columnDefinitions={columnDefinitions}
      items={items}
      loading={isLoading}
      loadingText={t('fleets.loading')}
      stickyHeader="true"
      trackBy="fleetId"
      filter={
        <TextFilter
          {...filterProps}
          countText={MatchesCountText(filteredItemsCount)}
          filteringAriaLabel={t('fleets.filter-cars')}
        />
      }
      header={
        <TableHeader
          nrSelectedItems={selectedFleetsInTable.length}
          nrTotalItems={fleets.length}
          onEdit={editFleetHandler}
          onDelete={() => setDeleteModalVisible(true)}
          onAdd={createFleetHandler}
          header={t('fleets.table-header')}
        />
      }
      pagination={<TablePagination paginationProps={paginationProps} />}
      visibleColumns={preferences.visibleContent}
      resizableColumns
      preferences={
        <TablePreferences
          preferences={preferences}
          setPreferences={setPreferences}
          contentOptions={visibleContentOptions}
        />
      }
    />
  );

  return (
    <PageLayout
      helpPanelHidden={helpPanelHidden}
      header={t('fleets.header')}
      description={t('fleets.description')}
      breadcrumbs={[
        { text: t('home.breadcrumb'), href: '/' },
        { text: t('admin.breadcrumb'), href: '/admin/home' },
        { text: t('fleets.breadcrumb') },
      ]}
    >
      {fleetsTable}

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
