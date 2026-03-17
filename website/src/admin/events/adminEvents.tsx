import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button, SpaceBetween } from '@cloudscape-design/components';
import { useTranslation } from 'react-i18next';
import { DeleteModal, ItemList } from '../../components/deleteModal';
import { SimpleHelpPanelLayout } from '../../components/help-panels/simple-help-panel';
import { PageLayout } from '../../components/pageLayout';
import { PageTable } from '../../components/pageTable';
import { DrSplitPanel } from '../../components/split-panels/dr-split-panel';
import { TableHeader } from '../../components/tableConfig';
import useMutation from '../../hooks/useMutation';
import { useUsers } from '../../hooks/useUsers';
import { useStore } from '../../store/store';
import { Event } from '../../types/domain';
import { EventDetailsPanelContent } from './components/eventDetailsPanelContent';
import { ColumnConfiguration, FilteringProperties } from './support-functions/eventsTableConfig';

/**
 * AdminEvents component for managing events in the admin interface
 * Provides CRUD operations for events with table view and split panel details
 */
const AdminEvents = (): JSX.Element => {
  const { t } = useTranslation(['translation', 'help-admin-events']);
  const [SelectedEventsInTable, setSelectedEventsInTable] = useState<Event[]>([]);
  const [deleteModalVisible, setDeleteModalVisible] = useState<boolean>(false);
  const [send] = useMutation();

  const [state, dispatch] = useStore();
  const fleets = state.fleets?.fleets || [];
  const events = state.events?.events || [];
  const eventIsLoading = state.events?.isLoading || false;
  const [, , getUserNameFromId] = useUsers();

  const navigate = useNavigate();

  const editEventHandler = () => {
    navigate('/admin/events/edit', { state: SelectedEventsInTable[0] });
  };

  // Add Event
  const addEventHandler = () => {
    navigate('/admin/events/create');
  };

  // Delete Event
  async function deleteEvents(): Promise<void> {
    const eventIdsToDelete = SelectedEventsInTable.map((event) => event.eventId);
    send('deleteEvents' as any, { eventIds: eventIdsToDelete });
    setSelectedEventsInTable([]);
  }

  // Table config
  const columnConfiguration = ColumnConfiguration(getUserNameFromId as any, fleets);
  const filteringProperties = FilteringProperties();

  const selectPanelContent = useCallback((selectedItems: Event[]) => {
    if (selectedItems.length === 0) {
      return (
        <DrSplitPanel header={`0 ${t('events.split-panel-header')}`}>
          {t('events.split-panel.empty')}
        </DrSplitPanel>
      );
    } else if (selectedItems.length === 1) {
      return (
        <DrSplitPanel header={selectedItems[0].eventName}>
          <EventDetailsPanelContent event={selectedItems[0] as any} />
        </DrSplitPanel>
      );
    }
  }, [t]);

  useEffect(() => {
    console.debug('show split panel');
    dispatch('UPDATE_SPLIT_PANEL', {
      isOpen: true,
      content: selectPanelContent(SelectedEventsInTable),
    });

    return () => {
      dispatch('RESET_SPLIT_PANEL');
    };
  }, [SelectedEventsInTable, selectPanelContent]);

  const HeaderActionButtons = (): JSX.Element => {
    const disableEditButton =
      SelectedEventsInTable.length === 0 || SelectedEventsInTable.length > 1;
    const disableDeleteButton = SelectedEventsInTable.length === 0;
    return (
      <SpaceBetween direction="horizontal" size="xs">
        <Button disabled={disableEditButton} onClick={editEventHandler}>
          {t('button.edit')}
        </Button>
        <Button disabled={disableDeleteButton} onClick={() => setDeleteModalVisible(true)}>
          {t('button.delete')}
        </Button>
        <Button variant="primary" onClick={addEventHandler}>
          {t('button.create')}
        </Button>
      </SpaceBetween>
    );
  };

  // JSX
  return (
    <PageLayout
      helpPanelHidden={false}
      helpPanelContent={
        <SimpleHelpPanelLayout
          headerContent={t('header', { ns: 'help-admin-events' })}
          bodyContent={t('content', { ns: 'help-admin-events' })}
          footerContent={t('footer', { ns: 'help-admin-events' })}
        />
      }
      header={t('events.header')}
      description={t('events.description')}
      breadcrumbs={[
        { text: t('home.breadcrumb'), href: '/' },
        { text: t('operator.breadcrumb'), href: '/admin/home' },
        { text: t('event-management.breadcrumb'), href: '/admin/home' },
        { text: t('events.breadcrumb'), href: '#' },
      ]}
    >
      <PageTable
        selectedItems={SelectedEventsInTable}
        setSelectedItems={setSelectedEventsInTable}
        tableItems={events}
        selectionType="single"
        columnConfiguration={columnConfiguration}
        header={
          <TableHeader
            nrSelectedItems={SelectedEventsInTable.length}
            nrTotalItems={events.length}
            header={t('events.events-table')}
            actions={<HeaderActionButtons /> as any}
          />
        }
        itemsIsLoading={eventIsLoading}
        loadingText={t('events.loading')}
        localStorageKey={'events-table-preferences'}
        trackBy={'eventId'}
        filteringProperties={filteringProperties as any}
        filteringI18nStringsName={'events'}
      />

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
