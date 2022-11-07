import React, { useEffect, useState } from "react";
import { API } from 'aws-amplify';

import {
  Box,
  Button,
  Flashbar,
  Modal,
  SpaceBetween,
} from '@cloudscape-design/components';

export default ({ disabled, selectedItems, variant }) => {
  const [visible, setVisible] = useState(false);
  const [cars, setCars] = useState(false);
  const [msgs, setMsgs] = useState([]);

  useEffect(() => {
    // Delete models on selected cars

    const apiName = 'deepracerEventManager';
    const apiPath = 'cars/delete_all_models';

    async function deleteModels(car) {
      const myInit = {
        body: {
          InstanceId: car.InstanceId,
        }
      };

      return await API.post(apiName, apiPath, myInit)
    }

    for (const i in cars) {
      const car = cars[i]

      const status = deleteModels(car)
      console.log(status);

      setMsgs(msgs => [
        ...msgs,
        {
          header: car.InstanceId + ' - ' + car.Name,
          type: 'success',
          content: 'All models on the car have been removed.',
          dismissible: true,
          dismissLabel: "Dismiss message",
          onDismiss: () =>
            setMsgs(msgs =>
              msgs.filter(msgs => msgs.id !== car.InstanceId)
            ),
          id: car.InstanceId
        }
      ])

    }

    return() => {
      // Unmounting
    }

  },[cars])

  function modalOpen(selectedItems) {
    setVisible(true);
    setCars(selectedItems);
  }

  function modalClose() {
    setVisible(false);
  };

  return (
    <>
      <Button disabled={disabled} variant={variant} onClick={() => {
        modalOpen(selectedItems)
      }}>Delete car models</Button>

      <Modal
        onDismiss={() => modalClose()}
        visible={visible}
        closeAriaLabel="Close Modal"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="primary" onClick={() => modalClose()}>Ok</Button>
            </SpaceBetween>
          </Box>
        }
        header="Delete models"
      >
        Deleting models
        <Flashbar items={msgs} />
      </Modal>
    </>
  )
}
