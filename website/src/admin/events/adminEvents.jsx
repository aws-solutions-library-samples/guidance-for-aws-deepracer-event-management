import { API } from 'aws-amplify';
import * as mutations from '../../graphql/mutations';

import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useCollection } from '@cloudscape-design/collection-hooks';
import { Box, Button, Modal, SpaceBetween, Table, TextFilter } from '@cloudscape-design/components';
import { useTranslation } from 'react-i18next';
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
import { eventContext } from '../../store/eventProvider';
import { fleetContext } from '../../store/fleetProvider';
import { usersContext } from '../../store/usersProvider';
import { ColumnDefinitions, VisibleContentOptions } from './eventsTableConfig';

const AdminEvents = () => {
  const { t } = useTranslation();
  const [SelectedEventsInTable, setSelectedEventsInTable] = useState([]);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  const [preferences, setPreferences] = useLocalStorage('DREM-events-table-preferences', {
    ...DefaultPreferences,
    visibleContent: ['eventName', 'eventDate', 'createdAt'],
  });

  const [users, usersIsLoading, getUserNameFromId] = useContext(usersContext);
  const { events } = useContext(eventContext);
  const [fleets] = useContext(fleetContext);

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

  const eventsTable = (
    <Table
      {...collectionProps}
      onSelectionChange={({ detail }) => {
        setSelectedEventsInTable(detail.selectedItems);
      }}
      selectedItems={SelectedEventsInTable}
      selectionType="multi"
      columnDefinitions={columnDefinitions}
      items={items}
      // loading={loading}
      // loadingText={t('events.loading')}
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
    <>
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

        {/* delete modal */}
        <Modal
          onDismiss={() => setDeleteModalVisible(false)}
          visible={deleteModalVisible}
          closeAriaLabel="Close modal"
          footer={
            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Button variant="link" onClick={() => setDeleteModalVisible(false)}>
                  {t('button.cancel')}
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    deleteEvents();
                    setDeleteModalVisible(false);
                  }}
                >
                  {t('button.delete')}
                </Button>
              </SpaceBetween>
            </Box>
          }
          header={t('events.delete-event')}
        >
          {t('events.delete-warning')}: <br></br>{' '}
          {SelectedEventsInTable.map((selectedEvent) => {
            return selectedEvent.eventName + ' ';
          })}
        </Modal>
      </PageLayout>
    </>
  );
};

export { AdminEvents };
