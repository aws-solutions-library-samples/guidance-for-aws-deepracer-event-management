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
  Box,
  TextFilter,
  Modal
} from '@cloudscape-design/components';
import { useCollection } from '@cloudscape-design/collection-hooks';

import {
  DefaultPreferences,
  EmptyState,
  MatchesCountText,
  PageSizePreference,
  WrapLines,
} from '../components/TableConfig';

export function AdminEvents() {
  //const [events, setEvents] = useState([]);
  const [newEvent, setNewEvent] = useState('');
  const [newEventErrorText, setNewEventErrorText] = useState('');
  const [selectedEvent, setSelectedEvent] = useState([]);
  const [addButtonDisabled, setAddButtonDisabled] = useState(true);
  const [deleteButtonDisabled, setDeleteButtonDisabled] = useState(true);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const events = ListOfEvents();

  // Add Event
  async function addEvent(newEvent) {
    if (newEvent.match(/^[a-zA-Z0-9-_]+$/)) { 
      console.log('match')   
      const response = await API.graphql({
        query: mutations.addEvent,
        variables: {
          eventName: newEvent
        }
      });
      setNewEventErrorText('')
      return response;
    } else {
      setNewEventErrorText('Must match regex: ^[a-zA-Z0-9-_]+$')
    }
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
    setDeleteButtonDisabled(true);
    //console.log(response.data.deleteEvent);
  }

  const [preferences, setPreferences] = useState({
    ...DefaultPreferences,
    //visibleContent: ['instanceId', 'carName', 'eventName','carIp'],
  });

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
      filtering: {
        empty: (
          <EmptyState
            title="No Events"
            subtitle="Please create an event."
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
      pagination: { pageSize: preferences.pageSize },
      sorting: { defaultState: { sortingColumn: columnDefinitions[0] } },
      selection: {},
    }
  );

  const eventsTable = <Table
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
    filter={
      <TextFilter
        {...filterProps}
        countText={MatchesCountText(filteredItemsCount)}
        filteringAriaLabel='Filter cars'
      />
    }
    header={
      <Header 
      actions={
        <SpaceBetween direction="horizontal" size="xs">
          <Button disabled={deleteButtonDisabled} iconName='status-warning' onClick={() => {
            setDeleteModalVisible(true); 
          }}>Delete Event</Button>
        </SpaceBetween>
      }
      >Events</Header>
    } 
  />

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
                <FormField 
                  label="New Event"
                  errorText={newEventErrorText}
                >
                  <Input value={newEvent} placeholder='Awesome Event' onChange={event => {
                    setNewEvent(event.detail.value);
                    if (newEvent.length > 0){setAddButtonDisabled(false)};
                  }} />
                </FormField>
              </SpaceBetween>
          </Form>
          </Container>

          {eventsTable}
        </SpaceBetween>
        <div></div>
      </Grid>
      
      {/* delete modal */}
      <Modal
        onDismiss={() => setDeleteModalVisible(false)}
        visible={deleteModalVisible}
        closeAriaLabel="Close modal"
        footer={
          <Box float="right">
            <SpaceBetween direction="horizontal" size="xs">
              <Button variant="link" onClick={() => setDeleteModalVisible(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => {
                deleteEvent();
                setDeleteModalVisible(false);
              }}>Delete</Button>
            </SpaceBetween>
          </Box>
        }
        header="Delete event"
      >
        Are you sure you want to delete event(s): {selectedEvent.map(selectedEvent => { return selectedEvent.eventName + " " })}
      </Modal>
    </>
    
  )
}