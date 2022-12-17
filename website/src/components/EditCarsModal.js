import { API } from 'aws-amplify';
import React, { useEffect, useState } from 'react';
import { ListOfFleets } from './ListOfFleets.js';

import * as mutations from '../graphql/mutations';
import * as queries from '../graphql/queries';
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

  const [dropDownColors, setDropDownColors] = useState([{ id: 'blue', text: 'blue' }]);
  const [dropDownSelectedColor, setDropDownSelectedColor] = useState({
    id: 'Select Color',
    text: 'Select Color',
  });

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

  // get color options when component is mounted
  useEffect(() => {
    // Get Colors
    async function getAvailableTaillightColors() {
      const response = await API.graphql({
        query: queries.availableTaillightColors,
      });
      const colors = JSON.parse(response.data.availableTaillightColors);
      setDropDownColors(
        colors.map((thisColor) => {
          return {
            id: thisColor,
            text: thisColor,
          };
        })
      );
    }
    getAvailableTaillightColors();

    return () => {
      // Unmounting
    };
  }, []);

  // Update Tail Light Colors on Cars
  async function carColorUpdates() {
    const InstanceIds = selectedItems.map((i) => i.InstanceId);

    const response = await API.graphql({
      query: mutations.carSetTaillightColor,
      variables: {
        resourceIds: InstanceIds,
        selectedColor: dropDownSelectedColor.id,
      },
    });

    setVisible(false);
    setRefresh(true);
    setDropDownSelectedColor({ id: 'Select Color', text: 'Select Color' });
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
                  Update Fleets
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

          <Container>
            <FormField label="Tail Light">
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
                    carColorUpdates();
                  }}
                >
                  Update Tail lights
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
