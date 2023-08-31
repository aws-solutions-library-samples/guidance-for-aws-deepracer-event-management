import { useCollection } from '@cloudscape-design/collection-hooks';
import { Pagination, PropertyFilter, Table } from '@cloudscape-design/components';
import { API } from 'aws-amplify';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '../../components/pageLayout';
import * as mutations from '../../graphql/mutations';

import { DeleteModal, ItemList } from '../../components/deleteModal';
import { SimpleHelpPanelLayout } from '../../components/help-panels/simple-help-panel';
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
import { useLocalStorage } from '../../hooks/useLocalStorage';

import { useUsers } from '../../hooks/useUsers';
import { useStore } from '../../store/store';
import { ColumnDefinitions, FilteringProperties, VisibleContentOptions } from './fleetsTableConfig';
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
  const columnDefinitions = ColumnDefinitions(getUserNameFromId);
  const filteringProperties = FilteringProperties();
  const visibleContentOptions = VisibleContentOptions();

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

  const {
    items,
    actions,
    filteredItemsCount,
    collectionProps,
    propertyFilterProps,
    paginationProps,
  } = useCollection(fleets, {
    propertyFiltering: {
      filteringProperties,
      empty: <TableEmptyState resourceName="Fleet" />,
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
      stripedRows={preferences.stripedRows}
      contentDensity={preferences.contentDensity}
      wrapLines={preferences.wrapLines}
      loading={isLoading}
      loadingText={t('fleets.loading')}
      stickyHeader="true"
      trackBy="fleetId"
      filter={
        <PropertyFilter
          {...propertyFilterProps}
          i18nStrings={PropertyFilterI18nStrings('fleets')}
          countText={MatchesCountText(filteredItemsCount)}
          filteringAriaLabel={t('fleets.filter-groups')}
          expandToViewport={true}
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
