import React, { useEffect, useState } from "react";
import { API } from 'aws-amplify';
import { ListOfEvents } from './ListOfEvents.js';

//import * as queries from '../graphql/queries';
import * as mutations from '../graphql/mutations';
//import * as subscriptions from '../graphql/subscriptions'

import {
  Box,
  Button,
  Container,
  Modal,
  SpaceBetween,
  ButtonDropdown,
  FormField,
} from '@cloudscape-design/components';

export default ({ disabled, setRefresh, selectedItems, online, variant }) => {
  const [visible, setVisible] = useState(false);
  //const [cars, setCars] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);


  const [dropDownEvents, setDropDownEvents] = useState([{ id: 'none', text: 'none' }]);
  const [dropDownSelectedItem, setDropDownSelectedItem] = useState({ eventName: 'Select Event' })
  const events = ListOfEvents();

  // convert events data to dropdown format
  useEffect(() => {
    if (events.length > 0) {
      setDropDownEvents(events.map(thisEvent => {
        return {
          id: thisEvent.eventId,
          text: thisEvent.eventName
        };
      }));
    }
    return () => {
      // Unmounting
    }
  }, [events])

  function modalOpen(selectedItems) {
    setVisible(true);
    //setCars(selectedItems);
  }

  function modalClose() {
    setVisible(false);
  };

  // delete models from Cars
  async function carDeleteAllModels() {
    const InstanceIds = selectedItems.map(i => i.InstanceId);

    const response = await API.graphql({
      query: mutations.carDeleteAllModels,
      variables: { resourceIds: InstanceIds }
    });
  }

  // Update Cars
  async function carUpdates() {
    const InstanceIds = selectedItems.map(i => i.InstanceId);

    const response = await API.graphql({
      query: mutations.carUpdates,
      variables: {
        resourceIds: InstanceIds,
        eventName: dropDownSelectedItem.eventName,
        eventId: dropDownSelectedItem.eventId,
      }
    });

    setVisible(false);
    setRefresh(true);
    setDropDownSelectedItem({ eventName: 'Select Event' });
  }

  return (
    <>
      <Button disabled={disabled} variant={variant} onClick={() => {
        modalOpen(selectedItems)
      }}>Edit Cars</Button>

      {/* edit modal */}
      <Modal
        onDismiss={() => modalClose()}
        visible={visible}
        closeAriaLabel="Close Modal"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="secondary" onClick={() => modalClose()}>Cancel</Button>
            </SpaceBetween>
          </Box>
        }
        header="Edit Cars"
      >
        <SpaceBetween direction="vertical" size="xs">

          <Container>
            <FormField label='Events'>
              <SpaceBetween direction="horizontal" size="xs">
                <ButtonDropdown
                  items={dropDownEvents}
                  onItemClick={({ detail }) => {
                    const index = events.map(e => e.eventId).indexOf(detail.id);
                    setDropDownSelectedItem(events[index]);
                  }}
                >
                  {dropDownSelectedItem.eventName}
                </ButtonDropdown>
                <Button variant="primary" onClick={() => {
                  carUpdates();
                }}>Update Cars</Button>
              </SpaceBetween>
            </FormField>
          </Container>

          <Container>
            <FormField label='Models'>
              <Button disabled={!online} variant="primary" onClick={() => {
                setVisible(false);
                setDeleteModalVisible(true);
              }}>Delete Models</Button>
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
              <Button variant="link" onClick={() => {
                setDeleteModalVisible(false);
              }}>Cancel</Button>
              <Button variant="primary" onClick={() => {
                carDeleteAllModels();
                setDeleteModalVisible(false);
              }}>Delete</Button>
            </SpaceBetween>
          </Box>
        }
        header="Delete models on cars"
      >
        Are you sure you want to delete models on Cars(s): <br></br> {selectedItems.map(selectedItems => { return selectedItems.ComputerName + " " })}
      </Modal>
    </>
  )
}
