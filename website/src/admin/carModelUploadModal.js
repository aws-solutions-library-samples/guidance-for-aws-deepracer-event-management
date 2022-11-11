import React, { useState, useEffect, useRef } from 'react';
import { API } from 'aws-amplify';

import {
  Alert,
  Box,
  Button,
  CollectionPreferences,
  Modal,
  ProgressBar,
  SpaceBetween,
  Table,
  TextFilter
} from '@cloudscape-design/components';
import { useCollection } from '@cloudscape-design/collection-hooks';

import {
  CarColumnsConfig,
  CarVisibleContentOptions,
  DefaultPreferences,
  EmptyState,
  MatchesCountText,
  PageSizePreference,
  WrapLines,
} from '../components/TableConfig';

import dayjs from 'dayjs';

// day.js
var advancedFormat = require('dayjs/plugin/advancedFormat')
var utc = require('dayjs/plugin/utc')
var timezone = require('dayjs/plugin/timezone') // dependent on utc plugin

dayjs.extend(advancedFormat)
dayjs.extend(utc)
dayjs.extend(timezone)

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
      let id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}

const StatusModelContent = (props) => {
  const [seconds, setSeconds] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [result, setResult] = useState([]);
  const [results, setResults] = useState([]);
  const [commandId, setCommandId] = useState('');
  const [currentInstanceId, setCurrentInstanceId] = useState('');
  const [currentModel, setCurrentModel] = useState('');

  async function uploadModelToCar(car, model) {
    //console.log(car.InstanceId)
    //console.log(model.key)

    const apiName = 'deepracerEventManager';
    const apiPath = 'cars/upload';
    const myInit = {
      body: {
        InstanceId: car.InstanceId,
        key: model.key
      }
    };

    let response = await API.post(apiName, apiPath, myInit);
    //console.log(response);
    //console.log(response.CommandId);
    setResult(response);
    setCommandId(response);

    setCurrentInstanceId(car.InstanceId);

    setCurrentModel(model);
    setUploadStatus("InProgress");
    //setDimmerActive(true);
  }

  async function uploadModelToCarStatus(InstanceId, CommandId, model) {
    //console.log("InstanceId: " + InstanceId)
    //console.log("CommandId: " + CommandId)
    //console.log(model)

    if (InstanceId === '' || CommandId === '')
    {
      return [];
    }

    const apiName = 'deepracerEventManager';
    const apiPath = 'cars/upload/status';
    const myInit = {
      body: {
        InstanceId: InstanceId,
        CommandId: CommandId
      }
    };

    let response = await API.post(apiName, apiPath, myInit);
    //console.log(response)

    const modelKeyPieces = (model.key.split('/'));
    let modelUser = modelKeyPieces[modelKeyPieces.length - 3];
    let modelName = modelKeyPieces[modelKeyPieces.length - 1];

    let resultToAdd = {"ModelName": (modelUser + '-' + modelName), "CommandId": CommandId, "Status": response};
    let tempResultsArray = [];
    //console.log(resultToAdd);

    let updatedElement = false;
    for (const currentResult in results) {
      if (results[currentResult].CommandId === CommandId) {
        //console.log('update');
        tempResultsArray.push(resultToAdd);
        updatedElement = true;
      } else {
        //console.log('dont update');
        tempResultsArray.push(results[currentResult])
      }
    };

    // if result hasn't been updated because it doesn't exist, add the element
    if(!updatedElement) {
      tempResultsArray.push(resultToAdd)
    };

    setResult(response)
    setUploadStatus(response)
    setResults(tempResultsArray)

    return response;
  }

  useInterval(() => {
    // Your custom logic here
    setSeconds(seconds + 1);
    //console.log("useInterval seconds: " + seconds)

    let models = props.selectedModels;
    let car = props.selectedCars[0];
    //console.log(models);
    //console.log(car);

    //console.log('Models in array: ' + models.length)
    if (uploadStatus !== "InProgress") {
      //console.log(uploadStatus + " !== InProgress")
      if(models.length > 0) {
        setUploadStatus("InProgress");
        let model = models.pop();
        //console.log('POP!');
        uploadModelToCar(car, model);
      }
      else {
        //console.log('uploadStatus: ' + 'Complete');
        //setDimmerActive(false);
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
            id: "ModelName",
            header: "ModelName",
            cell: item => item.ModelName || "-",
            sortingField: "ModelName"
          },
          {
            id: "CommandId",
            header: "CommandId",
            cell: item => item.CommandId || "-",
            sortingField: "CommandId"
          },
          {
            id: "Status",
            header: "Status",
            cell: item => item.Status || "-",
            sortingField: "Status"
          }
        ]}
        items={results}
        loadingText="Loading resources"
        sortingDisabled
        empty={
          <Alert
            visible={true}
            dismissAriaLabel="Close alert"
            header="Starting"
          >
            Please wait whilst model upload jobs are submitted
          </Alert>
        }
        header={
          <ProgressBar value={(((props.modelsTotalCount-props.selectedModels.length)/props.modelsTotalCount)*100)} />
        }
      />

    </div>
  );
};

export default (props) => {
  const [visible, setVisible] = useState(false);
  const [statusModelVisible, setStatusModelVisible] = useState(false);
  const [modalContent, setModalContent] = useState(modalTable);
  const [selectedCars, setSelectedCars] = useState([]);

  var models = [...props.selectedModels]; //clone models array

  const [preferences, setPreferences] = useState({
    ...DefaultPreferences,
    visibleContent: ['carName', 'eventName','carIp'],
  });

  const { items, actions, filteredItemsCount, collectionProps, filterProps, paginationProps } = useCollection(
    props.cars,
    {
      filtering: {
        empty: (
          <EmptyState
            title="No cars"
            subtitle="No cars are currently online."
          />
        ),
        noMatch: (
          <EmptyState
            title="No matches"
            subtitle="We can’t find a match."
            action={<Button onClick={() => actions.setFiltering('')}>Clear filter</Button>}
          />
        ),
      },
      sorting: { defaultState: { sortingColumn: CarColumnsConfig[1] } },
    }
  );

  // default modal content
  var modalTable = <Table
    {...collectionProps}
    onSelectionChange={({ detail }) => {
      setSelectedCars(detail.selectedItems);
    }}
    selectedItems={selectedCars}
    selectionType="single"
    columnDefinitions={CarColumnsConfig}
    items={items}
    loadingText="Loading cars"
    visibleColumns={preferences.visibleContent}
    filter={
      <TextFilter
        {...filterProps}
        countText={MatchesCountText(filteredItemsCount)}
        filteringAriaLabel='Filter cars'
      />
    }
    resizableColumns
    preferences={
      <CollectionPreferences
        title='Preferences'
        confirmLabel='Confirm'
        cancelLabel='Cancel'
        onConfirm={({ detail }) => setPreferences(detail)}
        preferences={preferences}
        pageSizePreference={PageSizePreference('cars')}
        visibleContentPreference={{
          title: 'Select visible columns',
          options: CarVisibleContentOptions,
        }}
        wrapLinesPreference={WrapLines}
      />
    }
/>

  return (
    <>
      <Button disabled={props.disabled} variant="primary" onClick={() => {
        setVisible(true);
      }}>Upload models to car</Button>

      {/* modal 1 */}
      <Modal
        size='large'
        onDismiss={() => {
          setVisible(false);
        }}
        visible={visible}
        closeAriaLabel="Close modal"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => {
                setVisible(false);
              }} >Cancel</Button>
              <Button variant="primary" onClick={() => {
                //uploadModelToCar();
                setVisible(false);
                setModalContent(<StatusModelContent selectedModels={models} selectedCars={selectedCars} modelsTotalCount={props.selectedModels.length} ></StatusModelContent>);
                setStatusModelVisible(true);
              }}>Ok</Button>
            </SpaceBetween>
          </Box>
        }
        header="Select a car"
      >
        {modalTable}
      </Modal>

      {/* modal 2 */}
      <Modal
        size='max'
        onDismiss={() => {
          setModalContent('');
          setStatusModelVisible(false);
        }}
        visible={statusModelVisible}
        closeAriaLabel="Close modal"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="primary" onClick={() => {
                setModalContent('');
                setStatusModelVisible(false);
              }}>Ok</Button>
            </SpaceBetween>
          </Box>
        }
        header="Upload to car status"
      >
        {modalContent}
      </Modal>
    </>
  );
}
