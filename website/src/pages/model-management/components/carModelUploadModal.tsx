import React, { ReactElement, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EventSelectorModal } from '../../../components/eventSelectorModal';
import { useSelectedEventContext } from '../../../store/contexts/storeProvider';

import { useCollection } from '@cloudscape-design/collection-hooks';
import {
  Badge,
  Box,
  Button,
  Checkbox,
  Modal,
  SpaceBetween,
  Table,
  TextFilter,
} from '@cloudscape-design/components';

import {
  DefaultPreferences,
  EmptyState,
  MatchesCountText,
  TablePreferences,
} from '../../../components/tableConfig';

import { ColumnConfiguration } from '../../../components/devices-table/deviceTableConfig';
import { graphqlMutate } from '../../../graphql/graphqlHelpers';
import * as mutations from '../../../graphql/mutations';
import { useStore } from '../../../store/store';
import { Car, Model } from '../../../types/domain';
import { StatusModelContent } from './carModelUploadLegacy';
import { UploadModelToCarModern } from './carModelUploadModern';

// Type definitions
interface CarModelUploadModalProps {
  modelsToUpload: Model[];
}

interface DeleteAllModelsResponse {
  carDeleteAllModels: any;
}

interface Preferences {
  visibleContent: string[];
  [key: string]: any;
}

/**
 * Main modal component for uploading models to cars
 * Supports both legacy (polling) and modern (subscription-based) upload modes
 */
export const CarModelUploadModal: React.FC<CarModelUploadModalProps> = ({ modelsToUpload }) => {
  const { t } = useTranslation();

  const [visible, setVisible] = useState<boolean>(false);
  const [statusModalVisible, setStatusModalVisible] = useState<boolean>(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState<boolean>(false);
  const [deleteModalVisibleModern, setDeleteModalVisibleModern] = useState<boolean>(false);
  const [modalContent, setModalContent] = useState<ReactElement | string>('');
  const [selectedCars, setSelectedCars] = useState<Car[]>([]);
  const [checked, setChecked] = useState<boolean>(true);
  const [state] = useStore();
  const [modernToggle, setModernToggle] = useState<boolean>(true);
  const [modernToggleLabel, setModernToggleLabel] = useState<string>('');
  const selectedEvent = useSelectedEventContext();
  const cars: Car[] = (state.cars?.cars || []).filter(
    (car: Car) => car.PingStatus === 'Online' && car.Type === 'deepracer'
  );
  const [eventSelectModalVisible, setEventSelectModalVisible] = useState<boolean>(false);

  const [columnConfiguration] = useState(() =>
    ColumnConfiguration(['carName', 'fleetName', 'carIp'])
  );
  const [preferences, setPreferences] = useState<Preferences>({
    ...DefaultPreferences,
    visibleContent: columnConfiguration.defaultVisibleColumns,
  });

  // Initialize modern toggle label on mount
  useEffect(() => {
    setModernToggleLabel(t('carmodelupload.modern'));
  }, [t]);

  // Show event selector modal if no event has been selected
  useEffect(() => {
    if (selectedEvent?.eventId == null) {
      setEventSelectModalVisible(true);
    }
  }, [selectedEvent]);

  // Delete all models from selected cars
  async function carDeleteAllModels(): Promise<void> {
    const InstanceIds = selectedCars.map((i) => i.InstanceId).filter(Boolean);

    await graphqlMutate(mutations.carDeleteAllModels, { resourceIds: InstanceIds });
  }

  const { items, actions, filteredItemsCount, collectionProps, filterProps } =
    useCollection(cars, {
      filtering: {
        empty: (
          <EmptyState
            title={t('carmodelupload.no-cars')}
            subtitle={t('carmodelupload.no-cars-online')}
          />
        ),
        noMatch: (
          <EmptyState
            title={t('common.no-matches')}
            subtitle={t('common.we-cant-find-a-match')}
            action={
              <Button onClick={() => actions.setFiltering('')}>
                {t('carmodelupload.clear-filter')}
              </Button>
            }
          />
        ),
      },
      sorting: { defaultState: { sortingColumn: columnConfiguration.columnDefinitions[1] as any } },
    });

  // Car selection table
  const modalTable = (
    <Table
      {...collectionProps}
      onSelectionChange={({ detail }) => {
        setSelectedCars(detail.selectedItems as Car[]);
      }}
      selectedItems={selectedCars}
      selectionType="single"
      variant="embedded"
      columnDefinitions={columnConfiguration.columnDefinitions as any}
      items={items}
      loadingText={t('carmodelupload.loading-cars')}
      visibleColumns={preferences.visibleContent}
      filter={
        <TextFilter
          {...filterProps}
          countText={MatchesCountText(filteredItemsCount || 0)}
          filteringAriaLabel={t('carmodelupload.filter-cars')}
        />
      }
      resizableColumns
      preferences={
        <TablePreferences
          preferences={preferences}
          setPreferences={setPreferences}
          contentOptions={columnConfiguration.visibleContentOptions}
        />
      }
    />
  );

  return (
    <>
      <EventSelectorModal
        visible={eventSelectModalVisible}
        onDismiss={() => setEventSelectModalVisible(false)}
        onOk={() => setEventSelectModalVisible(false)}
      />

      <Button
        disabled={modelsToUpload.length === 0}
        variant="primary"
        onClick={() => {
          setVisible(true);
        }}
      >
        {t('carmodelupload.upload')}
      </Button>

      {/* Modal 1: Car Selection */}
      <Modal
        size="large"
        onDismiss={() => {
          setVisible(false);
          setChecked(false);
        }}
        visible={visible}
        closeAriaLabel={t('carmodelupload.close-modal-ari-label')}
        footer={
          <div>
            <Box float="left">
              <Badge color="blue">{modernToggleLabel}</Badge>
            </Box>

            <Box float="right">
              <SpaceBetween direction="horizontal" size="xs">
                <Checkbox onChange={({ detail }) => setChecked(detail.checked)} checked={checked}>
                  {t('carmodelupload.clear')}
                </Checkbox>
                <Button
                  variant="link"
                  onClick={() => {
                    setVisible(false);
                    setChecked(false);
                  }}
                >
                  {t('button.cancel')}
                </Button>
                <Button
                  variant="primary"
                  disabled={selectedCars.length === 0}
                  onClick={() => {
                    setVisible(false);

                    if (modernToggle) {
                      // Modern mode
                      if (checked) {
                        setDeleteModalVisibleModern(true);
                        setChecked(false);
                      } else {
                        setStatusModalVisible(true);
                        setModalContent(
                          <UploadModelToCarModern
                            cars={selectedCars}
                            event={selectedEvent as any}
                            models={modelsToUpload}
                            modernToggleLabel={modernToggleLabel}
                          />
                        );
                      }
                    } else {
                      // Legacy mode
                      if (checked) {
                        setDeleteModalVisible(true);
                        setChecked(false);
                      } else {
                        setModalContent(
                          <StatusModelContent
                            selectedModels={modelsToUpload}
                            selectedCars={selectedCars}
                            modelsTotalCount={modelsToUpload.length}
                          />
                        );
                        setStatusModalVisible(true);
                      }
                    }
                  }}
                >
                  {t('button.ok')}
                </Button>
              </SpaceBetween>
            </Box>
          </div>
        }
        header={t('carmodelupload.header')}
      >
        {modalTable}
      </Modal>

      {/* Modal 2: Upload Status */}
      <Modal
        size="max"
        onDismiss={() => {
          setModalContent('');
          setStatusModalVisible(false);
        }}
        visible={statusModalVisible}
        closeAriaLabel={t('carmodelupload.close-modal-ari-label')}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="primary"
                onClick={() => {
                  setModalContent('');
                  setStatusModalVisible(false);
                }}
              >
                {t('button.ok')}
              </Button>
            </SpaceBetween>
          </Box>
        }
        header={t('carmodelupload.header-upload')}
      >
        {modalContent}
      </Modal>

      {/* Modal 3: Delete Confirmation (Legacy) */}
      <Modal
        onDismiss={() => setDeleteModalVisible(false)}
        visible={deleteModalVisible}
        closeAriaLabel={t('carmodelupload.close-modal-ari-label')}
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
                  carDeleteAllModels();
                  setDeleteModalVisible(false);
                  setStatusModalVisible(true);
                  setModalContent(
                    <StatusModelContent
                      selectedModels={modelsToUpload}
                      selectedCars={selectedCars}
                      modelsTotalCount={modelsToUpload.length}
                    />
                  );
                }}
              >
                {t('carmodelupload.header-delete-upload')}
              </Button>
            </SpaceBetween>
          </Box>
        }
        header={t('carmodelupload.header-delete')}
      >
        {t('carmodelupload.header-delete-confirm')}: <br />
        {selectedCars.map((car) => car.ComputerName).join(' ')}
      </Modal>

      {/* Modal 4: Delete Confirmation (Modern) */}
      <Modal
        onDismiss={() => {
          setDeleteModalVisibleModern(false);
        }}
        visible={deleteModalVisibleModern}
        closeAriaLabel={t('carmodelupload.close-modal-ari-label')}
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="link"
                onClick={() => {
                  setDeleteModalVisibleModern(false);
                }}
              >
                {t('button.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  carDeleteAllModels();
                  setDeleteModalVisibleModern(false);
                  setStatusModalVisible(true);
                  setModalContent(
                    <UploadModelToCarModern
                      cars={selectedCars}
                      event={selectedEvent as any}
                      models={modelsToUpload}
                      modernToggleLabel={modernToggleLabel}
                    />
                  );
                }}
              >
                {t('carmodelupload.header-delete-upload')}
              </Button>
            </SpaceBetween>
          </Box>
        }
        header={t('carmodelupload.header-delete')}
      >
        {t('carmodelupload.header-delete-confirm')}: <br />
        {selectedCars.map((car) => car.ComputerName).join(' ')}
      </Modal>
    </>
  );
};
