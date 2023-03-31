import { API } from 'aws-amplify';
import React, { useEffect, useRef, useState } from 'react';
// import * as queries from '../graphql/queries';
import * as mutations from '../graphql/mutations';
// import * as subscriptions from '../graphql/subscriptions'
import { useTranslation } from 'react-i18next';

import { useCollection } from '@cloudscape-design/collection-hooks';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CollectionPreferences,
  Modal,
  ProgressBar,
  SpaceBetween,
  Table,
  TextFilter,
} from '@cloudscape-design/components';

import {
  CarColumnsConfig,
  CarVisibleContentOptions,
  DefaultPreferences,
  EmptyState,
  MatchesCountText,
  PageSizePreference,
  WrapLines,
} from '../components/tableConfig';

import dayjs from 'dayjs';

// day.js
var advancedFormat = require('dayjs/plugin/advancedFormat');
var utc = require('dayjs/plugin/utc');
var timezone = require('dayjs/plugin/timezone'); // dependent on utc plugin

dayjs.extend(advancedFormat);
dayjs.extend(utc);
dayjs.extend(timezone);

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
    // console.log(car.InstanceId)
    // console.log(model.key)

    const apiName = 'deepracerEventManager';
    const apiPath = 'cars/upload';
    const myInit = {
      body: {
        InstanceId: car.InstanceId,
        key: model.key,
      },
    };

    const response = await API.post(apiName, apiPath, myInit);
    // console.log(response);
    // console.log(response.CommandId);
    setResult(response);
    setCommandId(response);

    setCurrentInstanceId(car.InstanceId);

    setCurrentModel(model);
    setUploadStatus('InProgress');
    // setDimmerActive(true);
  }

  async function uploadModelToCarStatus(InstanceId, CommandId, model) {
    // console.log("InstanceId: " + InstanceId)
    // console.log("CommandId: " + CommandId)
    // console.log(model)

    if (InstanceId === '' || CommandId === '') {
      return [];
    }

    const apiName = 'deepracerEventManager';
    const apiPath = 'cars/upload/status';
    const myInit = {
      body: {
        InstanceId: InstanceId,
        CommandId: CommandId,
      },
    };

    const response = await API.post(apiName, apiPath, myInit);
    // console.log(response)

    const modelKeyPieces = model.key.split('/');
    const modelUser = modelKeyPieces[modelKeyPieces.length - 3];
    const modelName = modelKeyPieces[modelKeyPieces.length - 1];

    const resultToAdd = {
      ModelName: modelUser + '-' + modelName,
      CommandId: CommandId,
      Status: response,
    };
    const tempResultsArray = [];
    // console.log(resultToAdd);

    let updatedElement = false;
    for (const currentResult in results) {
      if (results[currentResult].CommandId === CommandId) {
        // console.log('update');
        tempResultsArray.push(resultToAdd);
        updatedElement = true;
      } else {
        // console.log('dont update');
        tempResultsArray.push(results[currentResult]);
      }
    }

    // if result hasn't been updated because it doesn't exist, add the element
    if (!updatedElement) {
      tempResultsArray.push(resultToAdd);
    }

    setResult(response);
    setUploadStatus(response);
    setResults(tempResultsArray);

    return response;
  }

  useInterval(() => {
    // Your custom logic here
    setSeconds(seconds + 1);
    // console.log("useInterval seconds: " + seconds)

    const models = props.selectedModels;
    const car = props.selectedCars[0];
    // console.log(models);
    // console.log(car);

    // console.log('Models in array: ' + models.length)
    if (uploadStatus !== 'InProgress') {
      // console.log(uploadStatus + " !== InProgress")
      if (models.length > 0) {
        setUploadStatus('InProgress');
        const model = models.pop();
        // console.log('POP!');
        uploadModelToCar(car, model);
      } else {
        // console.log('uploadStatus: ' + 'Complete');
        // setDimmerActive(false);
      }
    } else {
      uploadModelToCarStatus(currentInstanceId, commandId, currentModel);
    }
  }, 1000);

  // body of ticker code

  return (
    <div>
      <Table
        columnDefinitions={[
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
        ]}
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
              ((props.modelsTotalCount - props.selectedModels.length) / props.modelsTotalCount) *
              100
            }
          />
        }
      />
    </div>
  );
};

export default (props) => {
  const { t } = useTranslation();

  const [visible, setVisible] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [modalContent, setModalContent] = useState(modalTable);
  const [selectedCars, setSelectedCars] = useState([]);
  const [checked, setChecked] = useState(false);

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

  const carColumnsConfig = CarColumnsConfig();

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
      sorting: { defaultState: { sortingColumn: carColumnsConfig[1] } },
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
      columnDefinitions={carColumnsConfig}
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
        <CollectionPreferences
          title={t('table.preferences')}
          confirmLabel={t('button.confirm')}
          cancelLabel={t('button.cancel')}
          onConfirm={({ detail }) => setPreferences(detail)}
          preferences={preferences}
          pageSizePreference={PageSizePreference('cars')}
          visibleContentPreference={{
            title: t('table.select-visible-colunms'),
            options: CarVisibleContentOptions(),
          }}
          wrapLinesPreference={WrapLines}
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
