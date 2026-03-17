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
import { Race, Lap } from '../../../types/domain';
import { LapsTable } from '../components/lapsTable';
import { RaceInfoPanel } from '../components/raceInfoPanel';

/**
 * EditRace component for modifying race data including laps
 * Allows editing lap times, resets, and validity flags
 */
export const EditRace = (): JSX.Element => {
  const { t } = useTranslation();
  const location = useLocation();
  const selectedRace = location.state as Race;
  const navigate = useNavigate();
  const selectedEvent = useSelectedEventContext();
  const selectedTrack = useSelectedTrackContext();
  const [send, loading, errorMessage, data] = useMutation();
  const [createButtonIsDisabled, setCreateButtonIsDisabled] = useState<boolean>(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState<boolean>(false);
  const [raceConfig, setRaceConfig] = useState<Race>({
    raceId: '',
    eventId: '',
    trackId: '',
    userId: '',
    numberOfLaps: 0,
    laps: [],
  });
  const [selectedLaps, setSelectedLaps] = useState<Lap[]>([]);

  useEffect(() => {
    setRaceConfig(selectedRace);
  }, [selectedRace]);

  useEffect(() => {
    if (!loading && data && !errorMessage) {
      navigate(-1);
    }
  }, [loading, data, errorMessage, navigate]);

  const onSaveRaceHandler = async (): Promise<void> => {
    if (raceConfig.laps && raceConfig.laps.length === 0) {
      const config = {
        eventId: selectedEvent?.eventId || '',
        trackId: selectedTrack?.trackId || '',
        racesToDelete: [{ userId: raceConfig.userId, raceId: raceConfig.raceId }],
      };
      send('deleteRaces' as any, config);
    } else {
      const payload: any = { ...raceConfig };
      payload.laps?.map((lap: any) => {
        delete lap.timeHr;
        delete lap.avgTime;
      }); // Strip timeHr filed form laps, only used in FE
      payload.averageLaps = getAverageWindows(
        payload.laps || [],
        parseInt(selectedEvent?.raceConfig?.averageLapsWindow || '3', 10)
      );
      console.log(payload);
      send('updateRace' as any, payload);
    }
  };

  const updateRaceHandler = (attribute: Partial<Race>): void => {
    setRaceConfig((prevState) => {
      return { ...prevState, ...attribute };
    });
  };

  const deleteLapHandler = (): void => {
    setRaceConfig((prevState) => {
      const newState = { ...prevState };
      selectedLaps.map((selectedLap) => {
        const index = newState.laps?.findIndex((lap) => lap.lapId === selectedLap.lapId);
        if (index !== undefined && index !== -1 && newState.laps) {
          newState.laps.splice(index, 1);
        }
        return undefined;
      });
      return newState;
    });
    setSelectedLaps([]);
  };

  const tableSelectionChangeHandler = (items: Lap[]): void => {
    setSelectedLaps(items);
  };

  const tableSettings = {
    selectionType: 'multi' as const,
    submitEdit: async (currentItem: any, column: any, value: any): Promise<void> => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const idChangedItem = currentItem.lapId;
      const indexToReplace = raceConfig.laps?.findIndex((lap) => lap.lapId === idChangedItem);
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
        if (newState.laps && indexToReplace !== undefined && indexToReplace !== -1) {
          newState.laps[indexToReplace] = currentItem;
        }
        return newState;
      });
    },
    header: (
      <TableHeader
        nrSelectedItems={selectedLaps.length}
        nrTotalItems={raceConfig.laps?.length || 0}
        onDelete={(() => setDeleteModalVisible(true)) as any}
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
        { text: t('race-admin.edit-race'), href: '#' },
      ]}
    >
      <SpaceBetween size="l">
        <RaceInfoPanel race={raceConfig} onChange={updateRaceHandler} />
        <LapsTable
          race={raceConfig}
          tableSettings={tableSettings as any}
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
