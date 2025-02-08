import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelectedEventContext } from '../store/contexts/storeProvider';

import {
  Box,
  Button,
  ButtonDropdown,
  Container,
  FormField,
  Modal,
  SpaceBetween,
} from '@cloudscape-design/components';
import { useCarCmdApi } from '../hooks/useCarsApi';
import { useStore } from '../store/store';

/* eslint import/no-anonymous-default-export: [2, {"allowArrowFunction": true}] */
export default ({ disabled, setRefresh, selectedItems, online, variant }) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const {
    carFetchLogs,
    carRestartService,
    carEmergencyStop,
    carDeleteAllModels,
    carsUpdateFleet,
    carsUpdateTaillightColor,
    getAvailableTaillightColors,
  } = useCarCmdApi();
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  const [dropDownFleets, setDropDownFleets] = useState([{ id: 'none', text: 'none' }]);
  const [dropDownSelectedItem, setDropDownSelectedItem] = useState({
    fleetName: t('fleets.edit-cars.select-fleet'),
  });

  const [dropDownColors, setDropDownColors] = useState([{ id: 'blue', text: 'blue' }]);
  const [dropDownSelectedColor, setDropDownSelectedColor] = useState({
    id: t('fleets.edit-cars.select-color'),
    text: t('fleets.edit-cars.select-color'),
  });

  const [state] = useStore();
  const fleets = state.fleets.fleets;
  const selectedEvent = useSelectedEventContext();

  // convert fleets data to dropdown format
  useEffect(() => {
    if (fleets.length > 0) {
      setDropDownFleets(
        fleets.map((thisFleet) => {
          return {
            id: thisFleet.fleetId,
            text: thisFleet.fleetName,
          };
        })
      );
    }
    return () => {
      // Unmounting
    };
  }, [fleets]);

  function modalOpen() {
    setVisible(true);
    fetchColors();
  }

  function modalClose() {
    setVisible(false);
  }

  // delete models from Cars
  async function triggerDeleteAllModels() {
    const instanceIds = selectedItems.map((i) => i.InstanceId);
    carDeleteAllModels(instanceIds);

    setVisible(false);
    setRefresh(true);
  }

  // fetch logs from Cars
  async function triggerCarFetchLogs() {
    carFetchLogs(selectedItems, selectedEvent);

    setVisible(false);
    setRefresh(true);
  }

  // Update Cars
  async function triggerCarsUpdateFleet() {
    const instanceIds = selectedItems.map((i) => i.InstanceId);
    carsUpdateFleet(instanceIds, dropDownSelectedItem.fleetName, dropDownSelectedItem.fleetId);

    setVisible(false);
    setRefresh(true);
    setDropDownSelectedItem({ fleetName: t('fleets.edit-cars.select-fleet') });
  }

  async function fetchColors() {
    const colors = JSON.parse(await getAvailableTaillightColors());
    setDropDownColors(
      colors.map((thisColor) => {
        return {
          id: thisColor,
          text: thisColor,
        };
      })
    );
  }

  // Update Tail Light Colors on Cars
  async function triggerCarColorUpdates() {
    const instanceIds = selectedItems.map((i) => i.InstanceId);
    carsUpdateTaillightColor(instanceIds, dropDownSelectedColor.id);

    setVisible(false);
    setRefresh(true);
  }

  // Restart DeepRacer Service
  async function triggerCarRestartService() {
    const instanceIds = selectedItems.map((i) => i.InstanceId);
    carRestartService(instanceIds);

    setVisible(false);
    setRefresh(true);
  }

  async function triggerCarEmergencyStop() {
    const instanceIds = selectedItems.map((i) => i.InstanceId);
    carEmergencyStop(instanceIds);

    setVisible(false);
    setRefresh(true);
  }

  return (
    <>
      <Button
        disabled={disabled}
        variant={variant}
        onClick={() => {
          modalOpen();
        }}
      >
        {t('fleets.edit-cars.edit-cars')}
      </Button>

      {/* edit modal */}
      <Modal
        onDismiss={() => modalClose()}
        visible={visible}
        closeAriaLabel="Close Modal"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="secondary" onClick={() => modalClose()}>
                {t('button.cancel')}
              </Button>
            </SpaceBetween>
          </Box>
        }
        header={t('fleets.edit-cars.edit-cars')}
      >
        <SpaceBetween direction="vertical" size="xs">
          <Container>
            <FormField label="Fleets">
              <SpaceBetween direction="horizontal" size="xs">
                <ButtonDropdown
                  items={dropDownFleets}
                  onItemClick={({ detail }) => {
                    const index = fleets.map((e) => e.fleetId).indexOf(detail.id);
                    setDropDownSelectedItem(fleets[index]);
                  }}
                >
                  {dropDownSelectedItem.fleetName}
                </ButtonDropdown>
                <Button
                  variant="primary"
                  onClick={() => {
                    triggerCarsUpdateFleet();
                  }}
                >
                  {t('fleets.edit-cars.update-fleets')}
                </Button>
              </SpaceBetween>
            </FormField>
          </Container>

          <Container>
            <FormField label="Models">
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  disabled={!online}
                  variant="primary"
                  onClick={() => {
                    triggerCarFetchLogs();
                  }}
                >
                  {t('fleets.edit-cars.fetch-logs')}
                </Button>
                <Button
                  disabled={!online}
                  onClick={() => {
                    setDeleteModalVisible(true);
                  }}
                >
                  {t('fleets.edit-cars.delete-models')}
                </Button>
              </SpaceBetween>
            </FormField>
          </Container>

          <Container>
            <FormField label={t('fleets.edit-cars.title')}>
              <SpaceBetween direction="horizontal" size="xs">
                <Button
                  disabled={!online || selectedItems.length > 1}
                  onClick={() => {
                    triggerCarRestartService();
                  }}
                >
                  {t('fleets.edit-cars.restart-ros')}
                </Button>
                <Button
                  disabled={!online || selectedItems.length > 1}
                  iconName="status-warning"
                  variant="normal"
                  onClick={() => {
                    triggerCarEmergencyStop();
                  }}
                >
                  {t('fleets.edit-cars.stop')}
                </Button>
              </SpaceBetween>
            </FormField>
          </Container>

          <Container>
            <FormField label={t('fleets.edit-cars.taillight-label')}>
              <SpaceBetween direction="horizontal" size="xs">
                <ButtonDropdown
                  items={dropDownColors}
                  onItemClick={({ detail }) => {
                    const index = dropDownColors.map((e) => e.id).indexOf(detail.id);
                    setDropDownSelectedColor(dropDownColors[index]);
                  }}
                >
                  {dropDownSelectedColor.id}
                </ButtonDropdown>
                <Button
                  disabled={!online}
                  variant="primary"
                  onClick={() => {
                    triggerCarColorUpdates();
                  }}
                >
                  {t('fleets.edit-cars.update-tail-lights')}
                </Button>
              </SpaceBetween>
            </FormField>
          </Container>

          {/* <Container>
            <FormField label='Label Printing'>
              Coming Soon...
            </FormField>
          </Container> */}
        </SpaceBetween>
      </Modal>

      {/* delete modal */}
      <Modal
        onDismiss={() => setDeleteModalVisible(false)}
        visible={deleteModalVisible}
        closeAriaLabel="Close modal"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="link"
                onClick={() => {
                  setDeleteModalVisible(false);
                }}
              >
                {t('button.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  triggerDeleteAllModels();
                  setDeleteModalVisible(false);
                }}
              >
                {t('button.delete')}
              </Button>
            </SpaceBetween>
          </Box>
        }
        header={t('fleets.edit-cars.delete-models-header')}
      >
        {t('fleets.edit-cars.delete-models-message')}: <br></br>{' '}
        {selectedItems.map((selectedItems) => {
          return selectedItems.ComputerName + ' ';
        })}
      </Modal>
    </>
  );
};
