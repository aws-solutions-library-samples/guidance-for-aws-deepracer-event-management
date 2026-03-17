import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelectedEventContext } from '../store/contexts/storeProvider';

import {
  Box,
  Button,
  ButtonDropdown,
  ButtonDropdownProps,
  Container,
  Header,
  Modal,
  SpaceBetween,
} from '@cloudscape-design/components';
import { useCarCmdApi } from '../hooks/useCarsApi';
import { useStore } from '../store/store';
import { Car, Fleet } from '../types/domain';

// Type definitions
interface EditCarsModalProps {
  disabled: boolean;
  setRefresh: (refresh: boolean) => void;
  selectedItems: Car[];
  online: boolean;
  variant?: 'normal' | 'primary' | 'link' | 'icon';
}

interface DropdownItem {
  id: string;
  text: string;
}

interface SelectedFleet {
  fleetName: string;
  fleetId?: string;
}

const EditCarsModal: React.FC<EditCarsModalProps> = ({
  disabled,
  setRefresh,
  selectedItems,
  online,
  variant,
}) => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState<boolean>(false);
  const {
    carFetchLogs,
    carRestartService,
    carEmergencyStop,
    carsDelete,
    carDeleteAllModels,
    carsUpdateFleet,
    carsUpdateTaillightColor,
    getAvailableTaillightColors,
  } = useCarCmdApi();
  const [deleteModelsModalVisible, setDeleteModelsModalVisible] = useState(false);
  const [deleteCarsModalVisible, setDeleteCarsModalVisible] = useState(false);

  const [dropDownFleets, setDropDownFleets] = useState<DropdownItem[]>([
    { id: 'none', text: 'none' },
  ]);
  const [dropDownSelectedItem, setDropDownSelectedItem] = useState<SelectedFleet>({
    fleetName: t('fleets.edit-cars.select-fleet'),
  });

  const [dropDownColors, setDropDownColors] = useState<DropdownItem[]>([
    { id: 'blue', text: 'blue' },
  ]);
  const [dropDownSelectedColor, setDropDownSelectedColor] = useState<DropdownItem>({
    id: t('fleets.edit-cars.select-color'),
    text: t('fleets.edit-cars.select-color'),
  });

  const [state] = useStore();
  const fleets: Fleet[] = state.fleets?.fleets || [];
  const selectedEvent = useSelectedEventContext();

  // convert fleets data to dropdown format
  useEffect(() => {
    if (fleets.length > 0) {
      setDropDownFleets(
        fleets.map((thisFleet) => ({
          id: thisFleet.fleetId,
          text: thisFleet.fleetName,
        }))
      );
    }
  }, [fleets]);

  function modalOpen(): void {
    setVisible(true);
    fetchColors();
  }

  function modalClose(): void {
    setVisible(false);
  }

  // delete models and logs from Cars, including ROS logs and restart
  async function triggerDeleteAllModels(): Promise<void> {
    const instanceIds = selectedItems.map((i) => i.InstanceId).filter(Boolean);
    carDeleteAllModels(instanceIds, true);

    setVisible(false);
    setRefresh(true);
  }

  // fetch logs from Cars
  async function triggerCarFetchLogs(): Promise<void> {
    carFetchLogs(selectedItems, selectedEvent as any);

    setVisible(false);
    setRefresh(true);
  }

  // Update Cars
  async function triggerCarsUpdateFleet(): Promise<void> {
    const instanceIds = selectedItems.map((i) => i.InstanceId).filter(Boolean);
    carsUpdateFleet(
      instanceIds,
      dropDownSelectedItem.fleetName,
      dropDownSelectedItem.fleetId || ''
    );

    setVisible(false);
    setRefresh(true);
    setDropDownSelectedItem({ fleetName: t('fleets.edit-cars.select-fleet') });
  }

  async function fetchColors(): Promise<void> {
    const colorsString = await getAvailableTaillightColors();
    const colors: string[] = JSON.parse(colorsString);
    setDropDownColors(
      colors.map((thisColor) => ({
        id: thisColor,
        text: thisColor,
      }))
    );
  }

  // Update Tail Light Colors on Cars
  async function triggerCarColorUpdates(): Promise<void> {
    const instanceIds = selectedItems.map((i) => i.InstanceId).filter(Boolean);
    carsUpdateTaillightColor(instanceIds, dropDownSelectedColor.id);

    setVisible(false);
    setRefresh(true);
  }

  // Restart DeepRacer Service
  async function triggerCarRestartService(): Promise<void> {
    const instanceIds = selectedItems.map((i) => i.InstanceId).filter(Boolean);
    carRestartService(instanceIds);

    setVisible(false);
    setRefresh(true);
  }

  async function triggerCarEmergencyStop(): Promise<void> {
    const instanceIds = selectedItems.map((i) => i.InstanceId).filter(Boolean);
    carEmergencyStop(instanceIds);

    setVisible(false);
    setRefresh(true);
  }

  async function triggerDeleteCars(): Promise<void> {
    const instanceIds = selectedItems.map((i) => i.InstanceId).filter(Boolean);
    carsDelete(instanceIds);

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
              <Button variant={"secondary" as any} onClick={() => modalClose()}>
                {t('button.cancel')}
              </Button>
            </SpaceBetween>
          </Box>
        }
        header={t('fleets.edit-cars.edit-cars')}
      >
        <SpaceBetween direction="vertical" size="m">
          <Container header={<Header variant={"h4" as any}>{t('fleets.header')}</Header>}>
            <SpaceBetween direction="horizontal" size="xs">
              <ButtonDropdown
                items={dropDownFleets as ButtonDropdownProps.Items}
                onItemClick={({ detail }) => {
                  const index = fleets.map((e) => e.fleetId).indexOf(detail.id);
                  if (index >= 0) {
                    setDropDownSelectedItem(fleets[index]);
                  }
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
          </Container>

          <Container header={<Header variant={"h4" as any}>{t('fleets.edit-cars.logs-and-models')}</Header>}>
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
                  setDeleteModelsModalVisible(true);
                }}
              >
                {t('fleets.edit-cars.clean-cars')}
              </Button>
            </SpaceBetween>
          </Container>

          <Container header={<Header variant={"h4" as any}>{t('fleets.edit-cars.title')}</Header>}>
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

              <ButtonDropdown
                items={dropDownColors as ButtonDropdownProps.Items}
                onItemClick={({ detail }) => {
                  const index = dropDownColors.map((e) => e.id).indexOf(detail.id);
                  if (index >= 0) {
                    setDropDownSelectedColor(dropDownColors[index]);
                  }
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
          </Container>

          <Container header={<Header variant={"h4" as any}>{t('fleets.edit-cars.delete')}</Header>}>
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                disabled={online || selectedItems.length === 0}
                iconName="status-negative"
                variant="normal"
                onClick={() => {
                  setDeleteCarsModalVisible(true);
                }}
              >
                {t('fleets.edit-cars.delete')}
              </Button>
            </SpaceBetween>
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
        onDismiss={() => setDeleteModelsModalVisible(false)}
        visible={deleteModelsModalVisible}
        closeAriaLabel="Close modal"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="link"
                onClick={() => {
                  setDeleteModelsModalVisible(false);
                }}
              >
                {t('button.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  triggerDeleteAllModels();
                  setDeleteModelsModalVisible(false);
                }}
              >
                {t('button.delete')}
              </Button>
            </SpaceBetween>
          </Box>
        }
        header={t('fleets.edit-cars.clean-cars-header')}
      >
        {t('fleets.edit-cars.clean-cars-message')}: <br />
        {selectedItems.map((item) => item.ComputerName).join(' ')}
      </Modal>

      {/* delete cars */}
      <Modal
        onDismiss={() => setDeleteCarsModalVisible(false)}
        visible={deleteCarsModalVisible}
        closeAriaLabel="Close modal"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="link"
                onClick={() => {
                  setDeleteCarsModalVisible(false);
                }}
              >
                {t('button.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  triggerDeleteCars();
                  setDeleteCarsModalVisible(false);
                }}
              >
                {t('button.delete')}
              </Button>
            </SpaceBetween>
          </Box>
        }
        header={t('fleets.edit-cars.delete-cars-header')}
      >
        {t('fleets.edit-cars.delete-cars-message')}: <br />
        {selectedItems.map((item) => item.ComputerName).join(' ')}
      </Modal>
    </>
  );
};

export default EditCarsModal;
