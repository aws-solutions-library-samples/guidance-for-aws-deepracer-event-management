import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useCollection } from '@cloudscape-design/collection-hooks';
import { PropertyFilter, Table } from '@cloudscape-design/components';
import { useTranslation } from 'react-i18next';
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
import {
  useSplitPanelOptionsDispatch,
  useToolsOptionsDispatch,
} from '../../store/appLayoutProvider';
import { useEventsContext, useFleetsContext, useUsersContext } from '../../store/storeProvider';
import { EventDetailsPanelContent } from './components/eventDetailsPanelContent';
import {
  ColumnDefinitions,
  FilteringProperties,
  VisibleContentOptions,
} from './support-functions/eventsTableConfig';

const AdminEvents = () => {
  const { t } = useTranslation(['translation', 'help-admin-events']);
  const [SelectedEventsInTable, setSelectedEventsInTable] = useState([]);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [send] = useMutation();

  const [preferences, setPreferences] = useLocalStorage('DREM-events-table-preferences', {
    ...DefaultPreferences,
    visibleContent: ['eventName', 'eventDate', 'createdAt'],
  });

  const [, , getUserNameFromId] = useUsersContext();
  const [events, eventIsLoading] = useEventsContext();
  const [fleets] = useFleetsContext();

  const splitPanelOptionsDispatch = useSplitPanelOptionsDispatch();
  const navigate = useNavigate();

  const editEventHandler = () => {
    navigate('/admin/events/edit', { state: SelectedEventsInTable[0] });
  };

  // Help panel
  const toolsOptionsDispatch = useToolsOptionsDispatch();
  const helpPanelHidden = false;
  useEffect(() => {
    toolsOptionsDispatch({
      type: 'UPDATE',
      value: {
        //isOpen: true,
        isHidden: helpPanelHidden,
        content: (
          <SimpleHelpPanelLayout
            headerContent={t('header', { ns: 'help-admin-events' })}
            bodyContent={t('content', { ns: 'help-admin-events' })}
            footerContent={t('footer', { ns: 'help-admin-events' })}
          />
        ),
      },
    });

    return () => {
      toolsOptionsDispatch({ type: 'RESET' });
    };
  }, [toolsOptionsDispatch]);

  // Add Event
  const addEventHandler = () => {
    navigate('/admin/events/create');
  };

  // Delete Event
  async function deleteEvents() {
    const eventIdsToDelete = SelectedEventsInTable.map((event) => event.eventId);
    send('deleteEvents', { eventIds: eventIdsToDelete });
    setSelectedEventsInTable([]);
  }

  // Table config
  const columnDefinitions = ColumnDefinitions(getUserNameFromId, fleets);
  const filteringProperties = FilteringProperties();
  const visibleContentOptions = VisibleContentOptions();

  const {
    items,
    actions,
    filteredItemsCount,
    collectionProps,
    propertyFilterProps,
    paginationProps,
  } = useCollection(events, {
    propertyFiltering: {
      filteringProperties,
      empty: <TableEmptyState resourceName="Event" />,
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

  const selectPanelContent = useCallback((selectedItems) => {
    if (selectedItems.length === 0) {
      return (
        <DrSplitPanel header={`0 ${t('events.split-panel-header')}`}>
          {t('events.split-panel.empty')}
        </DrSplitPanel>
      );
    } else if (selectedItems.length === 1) {
      return (
        <DrSplitPanel header={selectedItems[0].eventName} noSelectedItems={selectedItems.length}>
          <EventDetailsPanelContent event={selectedItems[0]} />
        </DrSplitPanel>
      );
    }
  }, []);

  useEffect(() => {
    console.debug('show split panel');
    splitPanelOptionsDispatch({
      type: 'UPDATE',
      value: {
        isOpen: true,
        content: selectPanelContent(SelectedEventsInTable),
      },
    });

    return () => {
      splitPanelOptionsDispatch({ type: 'RESET' });
    };
  }, [SelectedEventsInTable, splitPanelOptionsDispatch, selectPanelContent]);

  const eventsTable = (
    <Table
      {...collectionProps}
      onSelectionChange={({ detail }) => {
        setSelectedEventsInTable(detail.selectedItems);
      }}
      selectedItems={SelectedEventsInTable}
      selectionType="single"
      columnDefinitions={columnDefinitions}
      items={items}
      stripedRows={preferences.stripedRows}
      contentDensity={preferences.contentDensity}
      wrapLines={preferences.wrapLines}
      loading={eventIsLoading}
      loadingText={t('events.loading')}
      stickyHeader="true"
      trackBy="eventId"
      filter={
        <PropertyFilter
          {...propertyFilterProps}
          i18nStrings={PropertyFilterI18nStrings('events')}
          countText={MatchesCountText(filteredItemsCount)}
          filteringAriaLabel={t('cars.filter-groups')}
          expandToViewport={true}
        />
      }
      header={
        <TableHeader
          nrSelectedItems={SelectedEventsInTable.length}
          nrTotalItems={events.length}
          onEdit={editEventHandler}
          onDelete={() => setDeleteModalVisible(true)}
          onAdd={addEventHandler}
          header={t('events.events-table')}
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
      header={t('events.header')}
      description={t('events.description')}
      breadcrumbs={[
        { text: t('home.breadcrumb'), href: '/' },
        { text: t('admin.breadcrumb'), href: '/admin/home' },
        { text: t('events.breadcrumb') },
      ]}
    >
      {eventsTable}

      <DeleteModal
        header={t('events.delete-event')}
        onDelete={deleteEvents}
        onVisibleChange={setDeleteModalVisible}
        visible={deleteModalVisible}
      >
        {t('events.delete-warning')}: <br></br>{' '}
        <ItemList items={SelectedEventsInTable.map((selectedEvent) => selectedEvent.eventName)} />
      </DeleteModal>
    </PageLayout>
  );
};

export { AdminEvents };
