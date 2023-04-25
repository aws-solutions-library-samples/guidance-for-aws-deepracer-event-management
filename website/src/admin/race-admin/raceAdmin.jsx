import { useCollection } from '@cloudscape-design/collection-hooks';
import { Button, Table, TextFilter } from '@cloudscape-design/components';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { DeleteModal, ItemList } from '../../components/deleteModal';
import { PageLayout } from '../../components/pageLayout';
import { DrSplitPanel } from '../../components/split-panels/dr-split-panel';
import {
  DefaultPreferences,
  EmptyState,
  MatchesCountText,
  TableHeader,
  TablePagination,
  TablePreferences,
} from '../../components/tableConfig';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useRacesApi } from '../../hooks/useRacesApi';
import { useSplitPanelOptionsDispatch } from '../../store/appLayoutProvider';
import { useSelectedEventContext } from '../../store/storeProvider';
import { formatAwsDateTime } from '../../support-functions/time';
import { LapsTable } from './components/lapsTable';
import { MultiChoicePanelContent } from './components/multiChoicePanelContent';
import { ColumnDefinitions, VisibleContentOptions } from './support-functions/raceTableConfig';

const RaceAdmin = () => {
  const { t } = useTranslation();
  const selectedEvent = useSelectedEventContext();
  const [races, loading, sendDelete] = useRacesApi(selectedEvent.eventId);
  const [SelectedRacesInTable, setSelectedRacesInTable] = useState([]);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const splitPanelOptionsDispatch = useSplitPanelOptionsDispatch();

  const [preferences, setPreferences] = useLocalStorage('DREM-races-table-preferences', {
    ...DefaultPreferences,
    visibleContent: ['createdAt', 'username', 'laps'],
  });

  const navigate = useNavigate();
  const editRaceHandler = () => {
    navigate('/admin/races/edit', { state: SelectedRacesInTable[0] });
  };

  async function deleteRaces() {
    const racesToDelete = SelectedRacesInTable.map((race) => {
      return { userId: race.userId, raceId: race.raceId };
    });
    const deleteVariables = {
      eventId: SelectedRacesInTable[0]['eventId'],
      trackId: SelectedRacesInTable[0]['trackId'],
      racesToDelete: racesToDelete,
    };
    console.info(deleteVariables);
    sendDelete(deleteVariables);
    setSelectedRacesInTable([]);
  }

  // Table config
  const columnDefinitions = ColumnDefinitions();
  const visibleContentOptions = VisibleContentOptions();

  const selectEmptyStateMessage = () => {
    if (selectedEvent.eventId) {
      return <EmptyState title={t('race-admin.no-races')} />;
    }
    return <EmptyState title={'Please select an event in the top right corner'} />;
  };

  const { items, actions, filteredItemsCount, collectionProps, filterProps, paginationProps } =
    useCollection(races, {
      filtering: {
        empty: selectEmptyStateMessage(),
        noMatch: (
          <EmptyState
            title={t('table.no-matches')}
            subtitle={t('table.we-cant-find-a-match')}
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

  const selectPanelContent = useCallback((selectedItems) => {
    if (selectedItems.length === 0) {
      return (
        // TODO Add localisation
        <DrSplitPanel header="0 races selected" noSelectedItems={selectedItems.length}>
          Select a race to see its details
        </DrSplitPanel>
      );
    } else if (selectedItems.length === 1) {
      return (
        <DrSplitPanel header="Laps">
          <LapsTable race={selectedItems[0]} tableSettings={{ variant: 'full-page' }} />
        </DrSplitPanel>
      );
    } else if (selectedItems.length > 1) {
      return (
        <DrSplitPanel header={`${selectedItems.length} races selected`}>
          <MultiChoicePanelContent races={selectedItems} />
        </DrSplitPanel>
      );
    }
  }, []);

  useEffect(() => {
    console.log('show split panel');
    splitPanelOptionsDispatch({
      type: 'UPDATE',
      value: {
        isOpen: true,
        content: selectPanelContent(SelectedRacesInTable),
      },
    });

    return () => {
      splitPanelOptionsDispatch({ type: 'RESET' });
    };
  }, [SelectedRacesInTable, splitPanelOptionsDispatch, selectPanelContent]);

  const raceTable = (
    <Table
      {...collectionProps}
      onSelectionChange={({ detail }) => {
        setSelectedRacesInTable(detail.selectedItems);
      }}
      selectedItems={SelectedRacesInTable}
      selectionType="multi"
      columnDefinitions={columnDefinitions}
      items={items}
      loading={loading}
      loadingText={t('events.loading')}
      stickyHeader="true"
      trackBy="raceId"
      filter={
        <TextFilter
          {...filterProps}
          countText={MatchesCountText(filteredItemsCount)}
          filteringAriaLabel={t('events.filter')}
        />
      }
      header={
        <TableHeader
          nrSelectedItems={SelectedRacesInTable.length}
          nrTotalItems={races.length}
          onEdit={editRaceHandler}
          onDelete={() => setDeleteModalVisible(true)}
          header={t('race-admin.races-table-header')}
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

  // JSX
  return (
    <PageLayout
      header={t('race-admin.header')}
      description={t('race-admin.description')}
      breadcrumbs={[
        { text: t('home.breadcrumb'), href: '/' },
        { text: t('admin.breadcrumb'), href: '/admin/home' },
        { text: t('race-admin.breadcrumb') },
      ]}
    >
      {raceTable}

      <DeleteModal
        header={t('race-admin.delete-races')}
        onDelete={deleteRaces}
        onVisibleChange={setDeleteModalVisible}
        visible={deleteModalVisible}
      >
        {t('race-admin.delete-race-warning')}: <br></br>{' '}
        <ItemList
          items={SelectedRacesInTable.map(
            (selectedRace) =>
              selectedRace.username + ': ' + formatAwsDateTime(selectedRace.createdAt)
          )}
        />
      </DeleteModal>
    </PageLayout>
  );
};

export { RaceAdmin };
