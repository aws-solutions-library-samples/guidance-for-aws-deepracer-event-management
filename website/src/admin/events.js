import React, { useEffect, useState } from 'react';
import { API, graphqlOperation } from 'aws-amplify';
import * as queries from '../graphql/queries';
import * as mutations from '../graphql/mutations';
import * as subscriptions from '../graphql/subscriptions'

import { ContentHeader } from '../components/ContentHeader';

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

export function AdminEvents() {
  const [events, setEvents] = useState([]);
  const [newEvent, setNewEvent] = useState('');

  // initial data load
  useEffect(() => {
    // Get Events
    async function getAllEvents() {
      const response = await API.graphql({
        query: queries.getAllEvents
      });
      //console.log('getAllEvents');
      //console.log(response.data.getAllEvents);
      setEvents([...response.data.getAllEvents]);
    }
    getAllEvents();

    return () => {
      // Unmounting
    }
  },[])

  // subscribe to data changes and append them to local array
  useEffect(() => {
    const subscription = API
      .graphql(graphqlOperation(subscriptions.addedEvent))
      .subscribe({
        next: (event) => {
          console.log(event);
          setEvents([...events,event.value.data.addedEvent]);
        }
      });
    
    return () => {
      subscription.unsubscribe();
    };
  }, [events]); 

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
                <Button variant='primary' onClick={() => {
                  addEvent(newEvent); 
                }}>Add Event</Button>
              </SpaceBetween>
            }
          >
              <SpaceBetween direction="vertical" size="l">
                <FormField label="New Event">
                  <Input value={newEvent} placeholder='Awesome Event' onChange={event => {
                    setNewEvent(event.detail.value)
                  }} />
                </FormField>
              </SpaceBetween>
          </Form>
          </Container>

          <Table
            columnDefinitions={[
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
                sortingField: "eventId"
              },
              {
                id: "createdAt",
                header: "createdAt",
                cell: item => item.createdAt || "-",
                sortingField: "createdAt"
              }
            ]}
            items={events}
            loadingText="Loading resources"
            sortingDisabled
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
              <Header>Events</Header>
            }
          />  
        </SpaceBetween>
        <div></div>
      </Grid>
    </>
  )
}