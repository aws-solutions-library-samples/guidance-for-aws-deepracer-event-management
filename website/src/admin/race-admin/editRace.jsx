import { Box, Button, Modal, SpaceBetween } from '@cloudscape-design/components';
import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { PageLayout } from '../../components/pageLayout';
import { TableHeader } from '../../components/tableConfig';
import useMutation from '../../hooks/useMutation';
import { eventContext } from '../../store/eventProvider';
import { convertStringToMs } from '../../support-functions/time';
import { LapsTable } from './lapsTable';
import { RaceInfoPanel } from './raceInfoPanel';

export const EditRace = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const selectedRace = location.state;
  const navigate = useNavigate();
  const { events, selectedEvent } = useContext(eventContext);
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
        trackId: '1', // TODO remove hardcoded trackID
        racesToDelete: [{ userId: raceConfig.userId, raceId: raceConfig.raceId }],
      };
      send('deleteRaces', config);
    } else {
      console.info(raceConfig);
      const payload = { ...raceConfig };
      payload.laps.map((lap) => delete lap.timeHr); // Strip timeHr filed form laps, only used in FE
      console.info(raceConfig);
      console.info(payload);
      send('updateRace', payload);
    }
  };

  const updateRaceHandler = (attribute) => {
    console.info(attribute);
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
              Save Changes
            </Button>
          </SpaceBetween>
        </Box>
      </SpaceBetween>

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
                  deleteLapHandler();
                  setDeleteModalVisible(false);
                }}
              >
                {t('button.delete')}
              </Button>
            </SpaceBetween>
          </Box>
        }
        header={t('race-admin.delete-laps')}
      >
        {t('race-admin.delete-warning')}: <br></br>{' '}
        {selectedLaps.map((selectedLap) => {
          return selectedLap.lapId + ' ';
        })}
      </Modal>
    </PageLayout>
  );
};
