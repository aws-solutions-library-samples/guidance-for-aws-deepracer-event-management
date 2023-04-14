import { API } from 'aws-amplify';
import * as mutations from '../../graphql/mutations';

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useCollection } from '@cloudscape-design/collection-hooks';
import { Button, Table, TextFilter } from '@cloudscape-design/components';
import { useTranslation } from 'react-i18next';
import { DeleteModal } from '../../components/deleteModal';
import { PageLayout } from '../../components/pageLayout';
import {
  DefaultPreferences,
  EmptyState,
  MatchesCountText,
  TableHeader,
  TablePagination,
  TablePreferences,
} from '../../components/tableConfig';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { useSplitPanelOptionsDispatch } from '../../store/appLayoutProvider';
import { useEventsContext, useFleetsContext, useUsersContext } from '../../store/storeProvider';
import { EmptyPanel } from './components/split-panels/emptyPanel';
import { EventDetailsPanel } from './components/split-panels/eventDetailsPanel';
import { MultiChoicePanel } from './components/split-panels/multiChoicePanel';
import { ColumnDefinitions, VisibleContentOptions } from './support-functions/eventsTableConfig';

const AdminEvents = () => {
  const { t } = useTranslation();
  const [SelectedEventsInTable, setSelectedEventsInTable] = useState([]);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  const [preferences, setPreferences] = useLocalStorage('DREM-events-table-preferences', {
    ...DefaultPreferences,
    visibleContent: ['eventName', 'eventDate', 'createdAt'],
  });

  const [users, usersIsLoading, getUserNameFromId] = useUsersContext();
  const [events, eventIsLoading] = useEventsContext();
  const [fleets] = useFleetsContext();

  const splitPanelOptionsDispatch = useSplitPanelOptionsDispatch();
  const navigate = useNavigate();

  const editEventHandler = () => {
    navigate('/admin/events/edit', { state: SelectedEventsInTable[0] });
  };

  // Add Event
  const addEventHandler = () => {
    navigate('/admin/events/create');
  };

  // Delete Event
  async function deleteEvents() {
    const eventIdsToDelete = SelectedEventsInTable.map((event) => event.eventId);

    await API.graphql({
      query: mutations.deleteEvents,
      variables: {
        eventIds: eventIdsToDelete,
      },
    });

    setSelectedEventsInTable([]);
  }

  // Table config
  const columnDefinitions = ColumnDefinitions(getUserNameFromId, fleets);
  const visibleContentOptions = VisibleContentOptions();

  const { items, actions, filteredItemsCount, collectionProps, filterProps, paginationProps } =
    useCollection(events, {
      filtering: {
        empty: <EmptyState title={t('events.no-events')} subtitle={t('events.create-an-event')} />,
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

  const i18SplitPanel = {
    preferencesTitle: t('common.panel.split-panel-preference-title'),
    preferencesPositionLabel: t('common.panel.split-panel-position-label'),
    preferencesPositionDescription: t('common.panel.split-panel-position-description'),
    preferencesPositionSide: t('common.panel.position-side'),
    preferencesPositionBottom: t('common.panel.position-bottom'),
    preferencesConfirm: t('button.confirm'),
    preferencesCancel: t('button.cancel'),
    closeButtonAriaLabel: t('common.panel.close'),
    openButtonAriaLabel: t('common.panel.open'),
    resizeHandleAriaLabel: t('common.panel.split-panel-rezize-label'),
  };

  const i18SplitPanelHeader = t('events.split-panel-header');

  const selectPanelContent = useCallback((selectedItems) => {
    if (selectedItems.length === 0) {
      return <EmptyPanel i18nStrings={i18SplitPanel} i18Header={i18SplitPanelHeader} />;
    } else if (selectedItems.length === 1) {
      return <EventDetailsPanel event={selectedItems[0]} i18nStrings={i18SplitPanel} />;
    } else if (selectedItems.length > 1) {
      return (
        <MultiChoicePanel
          events={selectedItems}
          i18nStrings={i18SplitPanel}
          i18Header={i18SplitPanelHeader}
        />
      );
    }
  }, []);

  useEffect(() => {
    console.log('show split panel');
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
      loading={eventIsLoading}
      loadingText={t('events.loading')}
      stickyHeader="true"
      trackBy="eventId"
      filter={
        <TextFilter
          {...filterProps}
          countText={MatchesCountText(filteredItemsCount)}
          filteringAriaLabel={t('events.filter')}
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
        {SelectedEventsInTable.map((selectedEvent) => {
          return selectedEvent.eventName + ' ';
        })}
      </DeleteModal>
    </PageLayout>
  );
};

export { AdminEvents };
