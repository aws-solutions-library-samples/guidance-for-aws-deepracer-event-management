import { API, graphqlOperation } from 'aws-amplify';
import React, { createContext, useEffect, useRef, useState } from 'react';
import * as mutations from '../../../graphql/mutations';
import * as queries from '../../../graphql/queries';
// import * as subscriptions from '../graphql/subscriptions'
import { useTranslation } from 'react-i18next';
import { EventSelectorModal } from '../../../components/eventSelectorModal';
import { useSelectedEventContext } from '../../../store/contexts/storeProvider';

import { useCollection } from '@cloudscape-design/collection-hooks';
import {
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  Modal,
  ProgressBar,
  SpaceBetween,
  StatusIndicator,
  Table,
  TextFilter,
  Toggle,
} from '@cloudscape-design/components';

import {
  DefaultPreferences,
  EmptyState,
  MatchesCountText,
  TablePreferences
} from '../../../components/tableConfig';

import { ColumnConfiguration } from '../../../components/devices-table/deviceTableConfig';
import { onUploadsToCarCreated, onUploadsToCarUpdated } from '../../../graphql/subscriptions';
import { useStore } from '../../../store/store';

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
          modelKey: model.fileMetaData.key,
          username: model.username,
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

    const modelUser = model.username;
    const modelName = model.modelname;

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
      cell: (item) => t('carmodelupload.status.' + item.Status) || '-',
      sortingField: 'Status',
    },
  ];

  return (
    <div>
      <Badge color="blue">{t('carmodelupload.legacy')}</Badge>
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
              ((props.modelsTotalCount - props.selectedModels.length) / props.modelsTotalCount) *
              100
            }
          />
        }
      />
    </div>
  );
};

export const CarModelUploadModal = ({ modelsToUpload }) => {
  const { t } = useTranslation();

  const [visible, setVisible] = useState(false);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteModalVisibleModern, setDeleteModalVisibleModern] = useState(false);
  const [modalContent, setModalContent] = useState(modalTable);
  const [selectedCars, setSelectedCars] = useState([]);
  const jobIdsContext = createContext();
  const [checked, setChecked] = useState(true);
  const [state] = useStore();
  const [modernToggle, setModernToggle] = useState(true);
  const [modernToggleLabel, setModernToggleLabel] = useState();
  const [modernToggleSelectionType, setModernToggleSelectionType] = useState('single');
  const selectedEvent = useSelectedEventContext();
  const cars = state.cars.cars.filter((car) => car.PingStatus === 'Online');
  const [eventSelectModalVisible, setEventSelectModalVisible] = useState(false);

  const columnConfiguration = ColumnConfiguration();

  const [preferences, setPreferences] = useState({
    ...DefaultPreferences,
    visibleContent: columnConfiguration.defaultVisibleColumns,
  });

  // on mount
  useEffect(() => {
    setModernToggleLabel(t('carmodelupload.modern'));
  }, [t]);

  // Show event selector modal if no event has been selected, timekeeper must have an event selected to work
  useEffect(() => {
    if (selectedEvent.eventId == null) {
      setEventSelectModalVisible(true);
    }
  }, [selectedEvent]);

  // delete models from Cars
  async function carDeleteAllModels() {
    const InstanceIds = selectedCars.map((i) => i.InstanceId);

    const response = await API.graphql({
      query: mutations.carDeleteAllModels,
      variables: { resourceIds: InstanceIds },
    });
  }

  const { items, actions, filteredItemsCount, collectionProps, filterProps, paginationProps } =
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
      // selectionType={modernToggleSelectionType}
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

  function UploadModelToCarModern(params) {
    const cars = params.cars;
    const event = params.event;
    const [jobIds, setJobIds] = useState([]);
    const [jobs, setJobs] = useState([]);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
      var currentProgress = 0;
      if (jobs.length > 0) {
        const jobsSuccess = jobs.filter((job) => job.status === 'Success');
        currentProgress = (jobsSuccess.length / jobs.length) * 100;
      }
      setProgress(currentProgress);
    }, [jobs, event]);

    useEffect(() => {
      const getData = async () => {
        var thisJobIds = [];
        await cars.forEach(async (car) => {
          var variables = {
            carInstanceId: car.InstanceId,
            carName: car.ComputerName,
            carFleetId: car.fleetId,
            carFleetName: car.fleetName,
            carIpAddress: car.IpAddress,
            eventId: event.eventId,
            eventName: event.eventName,
            modelData: modelsToUpload.map((modelToUpload) => {
              return {
                modelKey: modelToUpload.fileMetaData.key,
                username: modelToUpload.username,
              };
            }),
          };
          console.debug('variables', variables);

          var response = await API.graphql({
            query: mutations.startUploadToCar,
            variables: variables,
          });
          console.debug('startUploadToCar', response.data.startUploadToCar.jobId);
          //if (Array.isArray(localJobIds)) {

          //console.log('jobIds2', thisJobIds)
          thisJobIds.push(response.data.startUploadToCar.jobId);
          //console.log('jobIds3', thisJobIds)
          setJobIds(thisJobIds);
          //}
        }, []);
      };
      getData();
    }, [cars, event]);

    useEffect(() => {
      var subscriptions = [];
      jobIds.forEach((jobId) => {
        const filter = {
          jobId: jobId,
        };
        //console.log('subscriptionFilter-1', filter);
        const subscription = API.graphql(graphqlOperation(onUploadsToCarCreated, filter)).subscribe(
          {
            next: (event) => {
              //console.log('onUploadsToCarCreated-event', event)
              console.debug(
                'onUploadsToCarCreated event received',
                event.value.data.onUploadsToCarCreated
              );
              event.value.data.onUploadsToCarCreated.status = 'Created';
              event.value.data.onUploadsToCarCreated.statusIndicator = (
                <StatusIndicator type="info">{t('carmodelupload.status.created')}</StatusIndicator>
              );
              setJobs(jobs.concat(event.value.data.onUploadsToCarCreated));
            },
          }
        );
        subscriptions.push(subscription);
      }, subscriptions);

      return () => {
        subscriptions.forEach((subscription) => {
          if (subscription) subscription.unsubscribe();
        });
      };
    }, [jobs, jobIds]);

    // monitor for updated jobs matching our JobIds
    useEffect(() => {
      var subscriptions = [];
      jobIds.forEach((jobId) => {
        const filter = {
          jobId: jobId,
        };
        //console.log('subscriptionFilter-2', filter);
        const subscription = API.graphql(graphqlOperation(onUploadsToCarUpdated, filter)).subscribe(
          {
            next: (event) => {
              //console.log('onUploadsToCarUpdated-event', event)
              var updatedData = event.value.data.onUploadsToCarUpdated;
              console.debug('onUploadsToCarUpdated event received', updatedData);
              let newJobs = [...jobs];
              var currentData = newJobs.find((value) => value.modelKey === updatedData.modelKey);
              if (currentData === undefined) {
                currentData = {};
                newJobs.push(currentData);
                currentData.modelKey = updatedData.modelKey;
              }

              if (updatedData.status === 'Created') {
                currentData.status = updatedData.status;
                currentData.statusIndicator = (
                  <StatusIndicator type="info">
                    {t('carmodelupload.status.created')}
                  </StatusIndicator>
                );
              } else if (updatedData.status === 'Started') {
                currentData.status = updatedData.status;
                currentData.statusIndicator = (
                  <StatusIndicator type="pending">
                    {t('carmodelupload.status.started')}
                  </StatusIndicator>
                );
              } else if (updatedData.status === 'InProgress') {
                currentData.status = updatedData.status;
                currentData.statusIndicator = (
                  <StatusIndicator type="loading">
                    {t('carmodelupload.status.inprogress')}
                  </StatusIndicator>
                );
              } else if (updatedData.status === 'Success') {
                currentData.status = updatedData.status;
                currentData.statusIndicator = (
                  <StatusIndicator type="success">
                    {t('carmodelupload.status.success')}
                  </StatusIndicator>
                );
              } else if (updatedData.status === 'Failed') {
                currentData.status = updatedData.status;
                currentData.statusIndicator = (
                  <StatusIndicator type="error">{t('carmodelupload.status.error')}</StatusIndicator>
                );
              } else {
                currentData.status = updatedData.status;
                currentData.statusIndicator = updatedData.status;
              }
              if (updatedData.uploadStartTime) {
                currentData.uploadStartTime = updatedData.uploadStartTime;
              }
              if (updatedData.endTime) {
                currentData.endTime = updatedData.endTime;
              }
              setJobs(newJobs);
            },
          }
        );
        subscriptions.push(subscription);
      }, subscriptions);

      return () => {
        subscriptions.forEach((subscription) => {
          if (subscription) subscription.unsubscribe();
        });
      };
    }, [jobs, jobIds]);

    const columnDefinitionsModern = [
      {
        id: 'Status',
        header: t('carmodelupload.status'),
        cell: (item) => item.statusIndicator || '-',
        sortingField: 'Status',
        width: 140,
        minWidth: 140,
      },
      {
        id: 'modelKey',
        header: t('carmodelupload.modelname'),
        cell: (item) => item.modelKey.split('/')[item.modelKey.split('/').length - 1] || '-',
        sortingField: 'modelKey',
        width: 200,
        minWidth: 200,
      },
      {
        id: 'carName',
        header: t('carmodelupload.carName'),
        cell: (item) => item.carName || '-',
        sortingField: 'carName',
        width: 150,
        minWidth: 150,
      },
      {
        id: 'startTime',
        header: t('carmodelupload.startTime'),
        cell: (item) => item.startTime || '-',
        sortingField: 'startTime',
        width: 180,
        minWidth: 180,
      },
      {
        id: 'uploadStartTime',
        header: t('carmodelupload.uploadStartTime'),
        cell: (item) => item.uploadStartTime || '-',
        sortingField: 'uploadStartTime',
        width: 180,
        minWidth: 180,
      },
      {
        id: 'endTime',
        header: t('carmodelupload.endTime'),
        cell: (item) => item.endTime || '-',
        sortingField: 'endTime',
        width: 180,
        minWidth: 180,
      },
    ];

    return (
      <div>
        <Badge color="blue">{modernToggleLabel}</Badge>
        <Table
          columnDefinitions={columnDefinitionsModern}
          items={jobs}
          loadingText={t('carmodelupload.loading')}
          sortingDisabled
          empty={
            <Alert visible={true} dismissAriaLabel="Close alert" header="Starting">
              {t('carmodelupload.please-wait')}
            </Alert>
          }
          header={<ProgressBar value={progress} />}
        />
      </div>
    );
  }

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

      {/* modal 1 */}
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
              <Toggle
                onChange={({ detail }) => {
                  setModernToggle(detail.checked);
                  if (detail.checked) {
                    setModernToggleLabel(t('carmodelupload.modern'));
                    setModernToggleSelectionType('multi');
                  } else {
                    setModernToggleLabel(t('carmodelupload.legacy'));
                    setModernToggleSelectionType('single');
                  }
                }}
                checked={modernToggle}
              >
                <Badge color="blue">{modernToggleLabel}</Badge>
              </Toggle>
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
                      if (checked) {
                        setDeleteModalVisibleModern(true);
                        setChecked(false);
                      } else {
                        setStatusModalVisible(true);
                        setModalContent(
                          <UploadModelToCarModern
                            cars={selectedCars}
                            event={selectedEvent}
                          ></UploadModelToCarModern>
                        );
                      }
                    } else {
                      if (checked) {
                        setDeleteModalVisible(true);
                        setChecked(false);
                      } else {
                        setModalContent(
                          <StatusModelContent
                            selectedModels={modelsToUpload}
                            selectedCars={selectedCars}
                            modelsTotalCount={modelsToUpload.length}
                          ></StatusModelContent>
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

      {/* modal 2 */}
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

      {/* modal 3 - Delete All Models on Car */}
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
                    ></StatusModelContent>
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
        {t('carmodelupload.header-delete-confirm')}: <br></br>{' '}
        {selectedCars.map((selectedCars) => {
          return selectedCars.ComputerName + ' ';
        })}
      </Modal>

      {/* modal 3 (modern) - Delete All Models on Car */}
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
                      event={selectedEvent}
                    ></UploadModelToCarModern>
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
        {t('carmodelupload.header-delete-confirm')}: <br></br>{' '}
        {selectedCars.map((selectedCars) => {
          return selectedCars.ComputerName + ' ';
        })}
      </Modal>
    </>
  );
};
