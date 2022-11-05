import React, { Component, useState, useEffect, useRef } from 'react';
import { API } from 'aws-amplify';

import {
  Button,
  SpaceBetween,
  Box,
  Modal,
  Alert,
  Table,
  Header,
  ProgressBar
} from '@cloudscape-design/components';

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
  //const [selectedCars, setSelectedCars] = useState([]);
  const [result, setResult] = useState('');
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

    if(InstanceId === '' || CommandId === '')
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

  // default modal content
  var modalTable = <Table
    onSelectionChange={({ detail }) => {
      setSelectedCars(detail.selectedItems);
    }}
    selectedItems={selectedCars}
    selectionType="single"
    columnDefinitions={[
      {
        id: "InstanceId",
        header: "InstanceId",
        cell: item => item.InstanceId || "-",
        sortingField: "InstanceId"
      },
      {
        id: "Name",
        header: "Name",
        cell: item => item.Name || "-",
        sortingField: "Name"
      },
      {
        id: "eventName",
        header: "Event name",
        cell: item => item.eventName || "-",
        sortingField: "eventName"
      }
    ]}
    items={props.cars}
    loadingText="Loading resources"
    sortingDisabled
    empty={
      <Alert
        visible={true}
        dismissAriaLabel="Close alert"
        header="No cars are online"
      >
        Check your cars are registered to DREM and are connected to the internet
      </Alert>
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