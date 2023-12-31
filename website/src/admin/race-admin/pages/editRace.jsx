import { Box, Button, SpaceBetween } from '@cloudscape-design/components';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { DeleteModal, ItemList } from '../../../components/deleteModal';
import { PageLayout } from '../../../components/pageLayout';
import { TableHeader } from '../../../components/tableConfig';
import useMutation from '../../../hooks/useMutation';
import { getAverageWindows } from '../../../pages/timekeeper/support-functions/averageClaculations';
import {
  useSelectedEventContext,
  useSelectedTrackContext,
} from '../../../store/contexts/storeProvider';
import { convertStringToMs } from '../../../support-functions/time';
import { LapsTable } from '../components/lapsTable';
import { RaceInfoPanel } from '../components/raceInfoPanel';

export const EditRace = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const selectedRace = location.state;
  const navigate = useNavigate();
  const selectedEvent = useSelectedEventContext();
  const selectedTrack = useSelectedTrackContext();
  const [send, loading, errorMessage, data] = useMutation();
  const [createButtonIsDisabled, setCreateButtonIsDisabled] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [raceConfig, setRaceConfig] = useState({ laps: [] });
  const [selectedLaps, setSelectedLaps] = useState([]);

  useEffect(() => {
    setRaceConfig(selectedRace);
  }, [selectedRace]);

  useEffect(() => {
    if (!loading && data && !errorMessage) {
      navigate(-1);
    }
  }, [loading, data, errorMessage, navigate]);

  const onSaveRaceHandler = async () => {
    if (raceConfig.laps.length === 0) {
      const config = {
        eventId: selectedEvent.eventId,
        trackId: selectedTrack.trackId,
        racesToDelete: [{ userId: raceConfig.userId, raceId: raceConfig.raceId }],
      };
      send('deleteRaces', config);
    } else {
      const payload = { ...raceConfig };
      payload.laps.map((lap) => {
        delete lap.timeHr;
        delete lap.avgTime;
      }); // Strip timeHr filed form laps, only used in FE
      payload.averageLaps = getAverageWindows(
        payload.laps,
        selectedEvent.raceConfig.averageLapsWindow
      );
      console.log(payload);
      send('updateRace', payload);
    }
  };

  const updateRaceHandler = (attribute) => {
    setRaceConfig((prevState) => {
      return { ...prevState, ...attribute };
    });
  };

  const deleteLapHandler = () => {
    setRaceConfig((prevState) => {
      const newState = { ...prevState };
      selectedLaps.map((selectedLap) => {
        const index = newState.laps.findIndex((lap) => lap.lapId === selectedLap.lapId);
        newState.laps.splice(index, 1);
        return undefined;
      });
      return newState;
    });
    setSelectedLaps([]);
  };

  const tableSelectionChangeHandler = (items) => {
    setSelectedLaps(items);
  };

  const tableSettings = {
    selectionType: 'multi',
    submitEdit: async (currentItem, column, value) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const idChangedItem = currentItem.lapId;
      const indexToReplace = raceConfig.laps.findIndex((lap) => lap.lapId === idChangedItem);
      if (column.id === 'resets') {
        currentItem[column.id] = value;
      } else if (column.id === 'time') {
        currentItem['timeHr'] = value;
        currentItem[column.id] = convertStringToMs(value);
      } else if (column.id === 'isValid') {
        currentItem['isValid'] = value;
      } else {
        console.warn('Unsupported column to edit: ' + column.id);
      }
      setRaceConfig((prevState) => {
        const newState = { ...prevState };
        newState.laps[indexToReplace] = currentItem;
        return newState;
      });
    },
    header: (
      <TableHeader
        nrSelectedItems={selectedLaps.length}
        nrTotalItems={raceConfig.laps.length}
        onDelete={() => setDeleteModalVisible(true)}
        header={t('race-admin.laps-table-header')}
      />
    ),
  };

  return (
    <PageLayout
      header={t('race-admin.edit-race')}
      description={t('race-admin.description')}
      breadcrumbs={[
        { text: t('home.breadcrumb'), href: '/' },
        { text: t('admin.breadcrumb'), href: '/admin/home' },
        { text: t('race-admin.breadcrumb'), href: '/admin/races' },
        { text: t('race-admin.edit-race') },
      ]}
    >
      <SpaceBetween size="l">
        <RaceInfoPanel race={raceConfig} onChange={updateRaceHandler} />
        <LapsTable
          race={raceConfig}
          tableSettings={tableSettings}
          selectedLaps={selectedLaps}
          onSelectionChange={tableSelectionChangeHandler}
          isEditable={true}
        />

        <Box float="right">
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={() => navigate(-1)} disabled={loading}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={onSaveRaceHandler}
              disabled={loading || createButtonIsDisabled}
            >
              {t('button.save-changes')}
            </Button>
          </SpaceBetween>
        </Box>
      </SpaceBetween>
      <DeleteModal
        header={t('race-admin.delete-laps')}
        onDelete={deleteLapHandler}
        onVisibleChange={setDeleteModalVisible}
        visible={deleteModalVisible}
      >
        {t('race-admin.delete-warning')}: <br></br>{' '}
        <ItemList items={selectedLaps.map((selectedLap) => selectedLap.lapId)} />
      </DeleteModal>
    </PageLayout>
  );
};
