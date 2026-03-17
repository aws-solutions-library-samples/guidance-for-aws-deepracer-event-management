import { Button, SpaceBetween } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { DeleteModal, ItemList } from '../../components/deleteModal';
import { SimpleHelpPanelLayout } from '../../components/help-panels/simple-help-panel';
import { PageLayout } from '../../components/pageLayout';
import { PageTable } from '../../components/pageTable';
import { DrSplitPanel } from '../../components/split-panels/dr-split-panel';
import { TableHeader } from '../../components/tableConfig';
import useMutation from '../../hooks/useMutation';
import { useUsers } from '../../hooks/useUsers';
import { useSelectedEventContext } from '../../store/contexts/storeProvider';
import { useStore } from '../../store/store';
import { formatAwsDateTime } from '../../support-functions/time';
import { Race } from '../../types/domain';
import { LapsTable } from './components/lapsTable';
import { MultiChoicePanelContent } from './components/multiChoicePanelContent';
import { ColumnConfiguration, FilteringProperties } from './support-functions/raceTableConfig';

/**
 * RaceAdmin component for managing races in the admin interface
 * Provides view, edit, and delete operations for races with detailed lap information
 */
const RaceAdmin = (): JSX.Element => {
  const { t } = useTranslation(['translation', 'help-admin-race-admin']);
  const selectedEvent = useSelectedEventContext();
  const [send] = useMutation();
  const [SelectedRacesInTable, setSelectedRacesInTable] = useState<Race[]>([]);
  const [deleteModalVisible, setDeleteModalVisible] = useState<boolean>(false);
  const [state, dispatch] = useStore();
  const races = state.races?.races || [];
  const isLoading = state.races?.isLoading || false;
  const [, usersIsLoading, getUserNameFromId] = useUsers();

  const navigate = useNavigate();
  const editRaceHandler = () => {
    navigate('/admin/races/edit', { state: SelectedRacesInTable[0] });
  };

  async function deleteRaces(): Promise<void> {
    const racesToDelete = SelectedRacesInTable.map((race) => {
      return { userId: race.userId, raceId: race.raceId, trackId: race.trackId };
    });
    const deleteVariables = {
      eventId: selectedEvent?.eventId || '',
      racesToDelete: racesToDelete,
    };
    console.info(deleteVariables);
    send('deleteRaces' as any, deleteVariables);
    setSelectedRacesInTable([]);
  }

  // Table config
  const columnConfiguration = ColumnConfiguration();
  const filteringProperties = FilteringProperties();

  // add user names to all races
  const enrichedRaces = races.map((race) => {
    return {
      ...race,
      username: getUserNameFromId(race.userId),
    };
  });

  useEffect(() => {
    const selectPanelContent = (selectedItems: Race[]) => {
      if (selectedItems.length === 0) {
        return (
          <DrSplitPanel header="0 races selected">
            {t('race-admin.select-a-race')}
          </DrSplitPanel>
        );
      } else if (selectedItems.length === 1) {
        return (
          <DrSplitPanel header="Laps">
            <LapsTable
              race={selectedItems[0]}
              tableSettings={{ variant: 'embedded' }}
              onSelectionChange={() => {}}
              selectedLaps={[]}
              isEditable={false}
            />
          </DrSplitPanel>
        );
      } else if (selectedItems.length > 1) {
        return (
          <DrSplitPanel header={`${selectedItems.length} races selected`}>
            <MultiChoicePanelContent races={selectedItems} />
          </DrSplitPanel>
        );
      }
    };

    dispatch('UPDATE_SPLIT_PANEL', {
      isOpen: true,
      content: selectPanelContent(SelectedRacesInTable),
    });

    return () => {
      dispatch('RESET_SPLIT_PANEL');
    };
  }, [SelectedRacesInTable, dispatch, t]);

  const HeaderActionButtons = (): JSX.Element => {
    const disableEditButton = SelectedRacesInTable.length === 0 || SelectedRacesInTable.length > 1;
    const disableDeleteButton = SelectedRacesInTable.length === 0;
    return (
      <SpaceBetween direction="horizontal" size="xs">
        <Button disabled={disableEditButton} onClick={editRaceHandler}>
          {t('button.edit')}
        </Button>
        <Button disabled={disableDeleteButton} onClick={() => setDeleteModalVisible(true)}>
          {t('button.delete')}
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
        { text: t('race-admin.breadcrumb'), href: '#' },
      ]}
    >
      <PageTable
        selectedItems={SelectedRacesInTable}
        setSelectedItems={setSelectedRacesInTable}
        tableItems={enrichedRaces}
        selectionType="multi"
        columnConfiguration={columnConfiguration}
        header={
          <TableHeader
            nrSelectedItems={SelectedRacesInTable.length}
            nrTotalItems={races.length}
            header={t('race-admin.races-table-header')}
            actions={<HeaderActionButtons /> as any}
          />
        }
        itemsIsLoading={isLoading || usersIsLoading}
        loadingText={t('race-admin.loading-resources')}
        localStorageKey={'races-table-preferences'}
        trackBy={'raceId'}
        filteringProperties={filteringProperties as any}
        filteringI18nStringsName={'races'}
      />

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
