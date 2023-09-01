import { API } from 'aws-amplify';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import * as mutations from '../../graphql/mutations';
import * as queries from '../../graphql/queries';

import { useCollection } from '@cloudscape-design/collection-hooks';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Modal,
  ProgressBar,
  SpaceBetween,
  Table,
  TextFilter,
} from '@cloudscape-design/components';

import {
  DefaultPreferences,
  EmptyState,
  MatchesCountText,
  TablePreferences,
} from '../../components/tableConfig';

import { ColumnConfiguration } from '../../components/cars-table/carTableConfig';

// https://overreacted.io/making-setinterval-declarative-with-react-hooks/
function useInterval(callback, delay) {
  const savedCallback = useRef();

  // Remember the latest callback.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval.
  useEffect(() => {
    function tick() {
      savedCallback.current();
    }
    if (delay !== null) {
      const id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}

const StatusModelContent = (props) => {
  const { t } = useTranslation();

  const [seconds, setSeconds] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [result, setResult] = useState([]);
  const [results, setResults] = useState([]);
  const [commandId, setCommandId] = useState('');
  const [currentInstanceId, setCurrentInstanceId] = useState('');
  const [currentModel, setCurrentModel] = useState('');

  async function uploadModelToCar(car, model) {
    const response = await API.graphql({
      query: mutations.uploadModelToCar,
      variables: {
        entry: {
          carInstanceId: car.InstanceId,
          modelKey: model.modelKey,
        },
      },
    });
    setResult(response);
    setCommandId(response.data.uploadModelToCar.ssmCommandId);

    setCurrentInstanceId(car.InstanceId);

    setCurrentModel(model);
    setUploadStatus('InProgress');
  }

  async function uploadModelToCarStatus(InstanceId, CommandId, model) {
    // console.debug("InstanceId: " + InstanceId)
    // console.debug("CommandId: " + CommandId)
    // console.debug(model)

    if (InstanceId === '' || CommandId === '') {
      return [];
    }

    const api_response = await API.graphql({
      query: queries.getUploadModelToCarStatus,
      variables: {
        carInstanceId: InstanceId,
        ssmCommandId: CommandId,
      },
    });
    const ssmCommandStatus = api_response.data.getUploadModelToCarStatus.ssmCommandStatus;

    const modelKeyPieces = model.key.split('/');
    const modelUser = modelKeyPieces[modelKeyPieces.length - 3];
    const modelName = modelKeyPieces[modelKeyPieces.length - 1];

    const resultToAdd = {
      ModelName: modelUser + '-' + modelName,
      CommandId: CommandId,
      Status: ssmCommandStatus,
    };
    const tempResultsArray = [];
    // console.debug(resultToAdd);

    let updatedElement = false;
    for (const currentResult in results) {
      if (results[currentResult].CommandId === CommandId) {
        // console.debug('update');
        tempResultsArray.push(resultToAdd);
        updatedElement = true;
      } else {
        // console.debug('dont update');
        tempResultsArray.push(results[currentResult]);
      }
    }

    // if result hasn't been updated because it doesn't exist, add the element
    if (!updatedElement) {
      tempResultsArray.push(resultToAdd);
    }

    setResult(ssmCommandStatus);
    setUploadStatus(ssmCommandStatus);
    setResults(tempResultsArray);

    return ssmCommandStatus;
  }

  useInterval(() => {
    // Your custom logic here
    setSeconds(seconds + 1);
    // console.debug("useInterval seconds: " + seconds)

    const models = props.selectedModels;
    const car = props.selectedCars[0];
    // console.debug(models);
    // console.debug(car);

    // console.debug('Models in array: ' + models.length)
    if (uploadStatus !== 'InProgress') {
      // console.debug(uploadStatus + " !== InProgress")
      if (models.length > 0) {
        setUploadStatus('InProgress');
        const model = models.pop();
        // console.debug('POP!');
        uploadModelToCar(car, model);
      } else {
        // console.debug('uploadStatus: ' + 'Complete');
        // setDimmerActive(false);
      }
    } else {
      uploadModelToCarStatus(currentInstanceId, commandId, currentModel);
    }
  }, 500);

  // body of ticker code
  const columnDefinitions = [
    {
      id: 'ModelName',
      header: t('carmodelupload.modelname'),
      cell: (item) => item.ModelName || '-',
      sortingField: 'ModelName',
    },
    {
      id: 'CommandId',
      header: t('carmodelupload.commandid'),
      cell: (item) => item.CommandId || '-',
      sortingField: 'CommandId',
    },
    {
      id: 'Status',
      header: t('carmodelupload.status'),
      cell: (item) => item.Status || '-',
      sortingField: 'Status',
    },
  ];

  return (
    <Table
      columnDefinitions={columnDefinitions}
      items={results}
      loadingText={t('carmodelupload.loading')}
      sortingDisabled
      empty={
        <Alert visible={true} dismissAriaLabel="Close alert" header="Starting">
          {t('carmodelupload.please-wait')}
        </Alert>
      }
      header={
        <ProgressBar
          value={
            ((props.modelsTotalCount - props.selectedModels.length) / props.modelsTotalCount) * 100
          }
        />
      }
    />
  );
};

export default (props) => {
  const { t } = useTranslation();

  const [visible, setVisible] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [modalContent, setModalContent] = useState(modalTable);
  const [selectedCars, setSelectedCars] = useState([]);
  const [checked, setChecked] = useState(true);

  var models = [...props.selectedModels]; // clone models array

  const [preferences, setPreferences] = useState({
    ...DefaultPreferences,
    visibleContent: ['carName', 'eventName', 'carIp'],
  });

  // delete models from Cars
  async function carDeleteAllModels() {
    const InstanceIds = selectedCars.map((i) => i.InstanceId);

    const response = await API.graphql({
      query: mutations.carDeleteAllModels,
      variables: { resourceIds: InstanceIds },
    });
    setModalContent(
      <StatusModelContent
        selectedModels={models}
        selectedCars={selectedCars}
        modelsTotalCount={props.selectedModels.length}
      ></StatusModelContent>
    );
  }

  const columnConfiguration = ColumnConfiguration();

  const { items, actions, filteredItemsCount, collectionProps, filterProps, paginationProps } =
    useCollection(props.cars, {
      filtering: {
        empty: (
          <EmptyState title={t('carmodelupload.no-cars')} subtitle={t('carmodelupload.online')} />
        ),
        noMatch: (
          <EmptyState
            title={t('carmodelupload.no-matches')}
            subtitle={t('carmodelupload.we-cant-find-a-match')}
            action={
              <Button onClick={() => actions.setFiltering('')}>
                {t('carmodelupload.clear-filter')}
              </Button>
            }
          />
        ),
      },
      sorting: { defaultState: { sortingColumn: columnConfiguration.columnDefinitions[1] } },
    });

  // default modal content
  var modalTable = (
    <Table
      {...collectionProps}
      onSelectionChange={({ detail }) => {
        setSelectedCars(detail.selectedItems);
      }}
      selectedItems={selectedCars}
      selectionType="single"
      columnDefinitions={columnConfiguration.columnDefinitions}
      items={items}
      loadingText={t('carmodelupload.loading-cars')}
      visibleColumns={preferences.visibleContent}
      filter={
        <TextFilter
          {...filterProps}
          countText={MatchesCountText(filteredItemsCount)}
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
      <Button
        disabled={props.disabled}
        variant="primary"
        onClick={() => {
          setVisible(true);
        }}
      >
        {t('carmodelupload.upload')}
      </Button>

      {/* modal 1 */}
      <Modal
        size="large"
        onDismiss={() => {
          setVisible(false);
          setChecked(false);
        }}
        visible={visible}
        closeAriaLabel="Close modal"
        footer={
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
                onClick={() => {
                  // uploadModelToCar();
                  setVisible(false);

                  if (checked) {
                    setDeleteModalVisible(true);
                    setChecked(false);
                  } else {
                    setModalContent(
                      <StatusModelContent
                        selectedModels={models}
                        selectedCars={selectedCars}
                        modelsTotalCount={props.selectedModels.length}
                      ></StatusModelContent>
                    );
                    setStatusModalVisible(true);
                  }
                }}
              >
                {t('button.ok')}
              </Button>
            </SpaceBetween>
          </Box>
        }
        header={t('carmodelupload.header')}
      >
        {modalTable}
      </Modal>

      {/* modal 2 */}
      <Modal
        size="max"
        onDismiss={() => {
          setModalContent('');
          setStatusModalVisible(false);
        }}
        visible={statusModalVisible}
        closeAriaLabel="Close modal"
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

      {/* modal 3 - Delete All Models on Car */}
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
                  carDeleteAllModels();
                  setDeleteModalVisible(false);
                  setStatusModalVisible(true);
                }}
              >
                {t('carmodelupload.header-delete-upload')}
              </Button>
            </SpaceBetween>
          </Box>
        }
        header={t('carmodelupload.header-delete')}
      >
        {t('carmodelupload.header-delete-confirm')}: <br></br>{' '}
        {selectedCars.map((selectedCars) => {
          return selectedCars.ComputerName + ' ';
        })}
      </Modal>
    </>
  );
};
