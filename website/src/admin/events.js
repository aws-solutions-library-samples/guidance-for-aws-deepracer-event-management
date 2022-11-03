import React, { useEffect, useState } from 'react';
import { API, graphqlOperation } from 'aws-amplify';
//import * as queries from '../graphql/queries';
import * as mutations from '../graphql/mutations';
//import * as subscriptions from '../graphql/subscriptions'

import { ContentHeader } from '../components/ContentHeader';
import { ListOfEvents } from '../components/ListOfEvents';

import {
  Button,
  Form,
  Header,
  Grid,
  SpaceBetween,
  FormField,
  Input,
  Container,
  ExpandableSection,
  Table,
  Alert,
} from '@cloudscape-design/components';
import { useCollection } from '@cloudscape-design/collection-hooks';

export function AdminEvents() {
  //const [events, setEvents] = useState([]);
  const [newEvent, setNewEvent] = useState('');
  const [selectedEvent, setSelectedEvent] = useState([]);
  const [addButtonDisabled, setAddButtonDisabled] = useState(true);
  const [deleteButtonDisabled, setDeleteButtonDisabled] = useState(true);
  const events = ListOfEvents();

  // Add Event
  async function addEvent(newEvent) {
    //console.log(newEvent);
    const response = await API.graphql({
      query: mutations.addEvent,
      variables: {
        eventName: newEvent
      }
    });
    //console.log('addEvent');
    //console.log(response.data.addEvent);
    return response;
  } 

  // Delete Event
  async function deleteEvent() {
    //console.log(selectedEvent[0].eventId);
    const response = await API.graphql({
      query: mutations.deleteEvent, 
      variables: {
        eventId: selectedEvent[0].eventId
      }
    });
    //console.log(response.data.deleteEvent);
  }

  const columnDefinitions = [
    {
      id: "eventName",
      header: "eventName",
      cell: item => item.eventName || "-",
      sortingField: "eventName"
    },
    {
      id: "eventId",
      header: "eventId",
      cell: item => item.eventId || "-",
    },
    {
      id: "createdAt",
      header: "createdAt",
      cell: item => item.createdAt || "-",
      sortingField: "createdAt"
    }
  ]

  const { items, actions, filteredItemsCount, collectionProps, filterProps, paginationProps } = useCollection(
    events,
    {
      sorting: { defaultState: { sortingColumn: columnDefinitions[0] } },
    }
  );

  return (
    <>
      <ContentHeader
        header="Events admin"
        description="List of Events."
        breadcrumbs={[
          { text: "Home", href: "/" },
          { text: "Admin", href: "/admin/home" },
          { text: "Groups" }
        ]}
      />
      <Grid gridDefinition={[{ colspan: 1 }, { colspan: 10 }, { colspan: 1 }]}>
        <div></div>
        <SpaceBetween direction="vertical" size="l">

        <Container textAlign='center'>
          <Form
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button disabled={addButtonDisabled} variant='primary' onClick={() => {
                  addEvent(newEvent); 
                }}>Add Event</Button>
              </SpaceBetween>
            }
          >
              <SpaceBetween direction="vertical" size="l">
                <FormField label="New Event">
                  <Input value={newEvent} placeholder='Awesome Event' onChange={event => {
                    setNewEvent(event.detail.value);
                    if (newEvent.length > 0){setAddButtonDisabled(false)};
                  }} />
                </FormField>
              </SpaceBetween>
          </Form>
          </Container>

          <Table
            {...collectionProps}
            onSelectionChange={({ detail }) => {
              setSelectedEvent(detail.selectedItems);
              setDeleteButtonDisabled(false);
            }}
            selectedItems={selectedEvent}
            selectionType="single"
            columnDefinitions={columnDefinitions}
            items={items}
            loadingText="Loading resources"
            empty={
              <Alert
                visible={true}
                dismissAriaLabel="Close alert"
                header="No Events"
              >
                Please create your first event
              </Alert>
            }
            header={
              <Header 
              actions={
                <Button disabled={deleteButtonDisabled} variant='primary' onClick={() => {
                  deleteEvent(); 
                }}>Delete Event</Button>
              }
              >Events</Header>
            } 
          />  
        </SpaceBetween>
        <div></div>
      </Grid>
    </>
  )
}