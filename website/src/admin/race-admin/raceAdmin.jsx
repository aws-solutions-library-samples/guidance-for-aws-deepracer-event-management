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
import {
  useSplitPanelOptionsDispatch,
  useToolsOptionsDispatch,
} from '../../store/appLayoutProvider';
import {
  useRacesContext,
  useSelectedEventContext,
  useUsersContext,
} from '../../store/storeProvider';
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
  const [, , getUserNameFromId] = useUsersContext();
  const [races, loading, sendDelete] = useRacesContext();
  const [SelectedRacesInTable, setSelectedRacesInTable] = useState([]);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const splitPanelOptionsDispatch = useSplitPanelOptionsDispatch();
  const toolsOptionsDispatch = useToolsOptionsDispatch();

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
    sendDelete(deleteVariables);
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

  // Help panel
  const helpPanelHidden = false;
  useEffect(() => {
    toolsOptionsDispatch({
      type: 'UPDATE',
      value: {
        //isOpen: true,
        isHidden: helpPanelHidden,
        content: (
          <SimpleHelpPanelLayout
            headerContent={t('header', { ns: 'help-admin-race-admin' })}
            bodyContent={t('content', { ns: 'help-admin-race-admin' })}
            footerContent={t('footer', { ns: 'help-admin-race-admin' })}
          />
        ),
      },
    });

    return () => {
      toolsOptionsDispatch({ type: 'RESET' });
    };
  }, [toolsOptionsDispatch]);

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
      loading={loading}
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
      helpPanelHidden={helpPanelHidden}
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
