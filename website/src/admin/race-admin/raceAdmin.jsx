import { useCollection } from '@cloudscape-design/collection-hooks';
import { PropertyFilter, Table } from '@cloudscape-design/components';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { DeleteModal, ItemList } from '../../components/deleteModal';
import { SimpleHelpPanelLayout } from '../../components/help-panels/simple-help-panel';
import { PageLayout } from '../../components/pageLayout';
import { DrSplitPanel } from '../../components/split-panels/dr-split-panel';
import {
  PropertyFilterI18nStrings,
  TableEmptyState,
  TableNoMatchState,
} from '../../components/tableCommon';
import {
  DefaultPreferences,
  MatchesCountText,
  TableHeader,
  TablePagination,
  TablePreferences,
} from '../../components/tableConfig';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import useMutation from '../../hooks/useMutation';
import { useUsers } from '../../hooks/useUsers';
import { useSelectedEventContext } from '../../store/contexts/storeProvider';
import { useStore } from '../../store/store';
import { formatAwsDateTime } from '../../support-functions/time';
import { LapsTable } from './components/lapsTable';
import { MultiChoicePanelContent } from './components/multiChoicePanelContent';
import {
  ColumnDefinitions,
  FilteringProperties,
  VisibleContentOptions,
} from './support-functions/raceTableConfig';

const RaceAdmin = () => {
  const { t } = useTranslation(['translation', 'help-admin-race-admin']);
  const selectedEvent = useSelectedEventContext();
  const [send] = useMutation();
  const [SelectedRacesInTable, setSelectedRacesInTable] = useState([]);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [state, dispatch] = useStore();
  const races = state.races.races;
  const isLoading = state.races.isLoading;
  const [, , getUserNameFromId] = useUsers();

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
      console.info(race);
      return { userId: race.userId, raceId: race.raceId, trackId: race.trackId };
    });
    const deleteVariables = {
      eventId: selectedEvent.eventId,
      racesToDelete: racesToDelete,
    };
    console.info(deleteVariables);
    send('deleteRaces', deleteVariables);
    setSelectedRacesInTable([]);
  }

  // Table config
  const columnDefinitions = ColumnDefinitions(getUserNameFromId);
  const filteringProperties = FilteringProperties();
  const visibleContentOptions = VisibleContentOptions();

  const {
    items,
    actions,
    filteredItemsCount,
    collectionProps,
    propertyFilterProps,
    paginationProps,
  } = useCollection(races, {
    propertyFiltering: {
      filteringProperties,
      empty: <TableEmptyState resourceName="Race" />,
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
    sorting: { defaultState: { sortingColumn: columnDefinitions[0], isDescending: true } },
    selection: {},
  });

  const selectPanelContent = useCallback((selectedItems) => {
    if (selectedItems.length === 0) {
      return (
        <DrSplitPanel header="0 races selected" noSelectedItems={selectedItems.length}>
          {t('race-admin.select-a-race')}
        </DrSplitPanel>
      );
    } else if (selectedItems.length === 1) {
      return (
        <DrSplitPanel header="Laps">
          <LapsTable race={selectedItems[0]} tableSettings={{ variant: 'embedded' }} />
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
    dispatch('UPDATE_SPLIT_PANEL', {
      isOpen: true,
      content: selectPanelContent(SelectedRacesInTable),
    });

    return () => {
      dispatch('RESET_SPLIT_PANEL');
    };
  }, [SelectedRacesInTable, selectPanelContent]);

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
      stripedRows={preferences.stripedRows}
      contentDensity={preferences.contentDensity}
      wrapLines={preferences.wrapLines}
      loading={isLoading}
      loadingText={t('events.loading')}
      stickyHeader="true"
      trackBy="raceId"
      filter={
        <PropertyFilter
          {...propertyFilterProps}
          i18nStrings={PropertyFilterI18nStrings('races')}
          countText={MatchesCountText(filteredItemsCount)}
          filteringAriaLabel={t('races.filter-groups')}
          expandToViewport={true}
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
      helpPanelHidden={false}
      helpPanelContent={
        <SimpleHelpPanelLayout
          headerContent={t('header', { ns: 'help-admin-race-admin' })}
          bodyContent={t('content', { ns: 'help-admin-race-admin' })}
          footerContent={t('footer', { ns: 'help-admin-race-admin' })}
        />
      }
      header={t('race-admin.header')}
      description={t('race-admin.description')}
      breadcrumbs={[
        { text: t('home.breadcrumb'), href: '/' },
        { text: t('operator.breadcrumb'), href: '/admin/home' },
        { text: t('event-management.breadcrumb'), href: '/admin/home' },
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
