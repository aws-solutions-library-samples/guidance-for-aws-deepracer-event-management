import { API } from 'aws-amplify';
import React, { useEffect, useState } from 'react';
import { ListOfFleets } from './ListOfFleets.js';

// import * as queries from '../graphql/queries';
import * as mutations from '../graphql/mutations';
// import * as subscriptions from '../graphql/subscriptions'

import {
  Box,
  Button,
  ButtonDropdown,
  Container,
  FormField,
  Modal,
  SpaceBetween,
} from '@cloudscape-design/components';

export default ({ disabled, setRefresh, selectedItems, online, variant }) => {
  const [visible, setVisible] = useState(false);
  // const [cars, setCars] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  const [dropDownFleets, setDropDownFleets] = useState([{ id: 'none', text: 'none' }]);
  const [dropDownSelectedItem, setDropDownSelectedItem] = useState({ fleetName: 'Select Fleet' });

  const [isLoading, setIsLoading] = useState(true);
  const fleets = ListOfFleets(setIsLoading);

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

  function modalOpen(selectedItems) {
    setVisible(true);
    // setCars(selectedItems);
  }

  function modalClose() {
    setVisible(false);
  }

  // delete models from Cars
  async function carDeleteAllModels() {
    const InstanceIds = selectedItems.map((i) => i.InstanceId);

    const response = await API.graphql({
      query: mutations.carDeleteAllModels,
      variables: { resourceIds: InstanceIds },
    });
  }

  // Update Cars
  async function carUpdates() {
    const InstanceIds = selectedItems.map((i) => i.InstanceId);

    const response = await API.graphql({
      query: mutations.carUpdates,
      variables: {
        resourceIds: InstanceIds,
        fleetName: dropDownSelectedItem.fleetName,
        fleetId: dropDownSelectedItem.fleetId,
      },
    });

    setVisible(false);
    setRefresh(true);
    setDropDownSelectedItem({ fleetName: 'Select Fleet' });
  }

  return (
    <>
      <Button
        disabled={disabled}
        variant={variant}
        onClick={() => {
          modalOpen(selectedItems);
        }}
      >
        Edit Cars
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
                Cancel
              </Button>
            </SpaceBetween>
          </Box>
        }
        header="Edit Cars"
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
                    carUpdates();
                  }}
                >
                  Update Cars
                </Button>
              </SpaceBetween>
            </FormField>
          </Container>

          <Container>
            <FormField label="Models">
              <Button
                disabled={!online}
                variant="primary"
                onClick={() => {
                  setVisible(false);
                  setDeleteModalVisible(true);
                }}
              >
                Delete Models
              </Button>
            </FormField>
          </Container>

          {/* <Container>
            <FormField label='Tail Light'>
              Coming Soon...
            </FormField>
          </Container>

          <Container>
            <FormField label='Labels'>
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
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  carDeleteAllModels();
                  setDeleteModalVisible(false);
                }}
              >
                Delete
              </Button>
            </SpaceBetween>
          </Box>
        }
        header="Delete models on cars"
      >
        Are you sure you want to delete models on Cars(s): <br></br>{' '}
        {selectedItems.map((selectedItems) => {
          return selectedItems.ComputerName + ' ';
        })}
      </Modal>
    </>
  );
};
