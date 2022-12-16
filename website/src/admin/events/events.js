// TODO add so that an existing event can be edited
// TODO change all API call to useMutation custom hook
// TODO add input validation for all input fields

import { API } from 'aws-amplify';
import React, { useContext, useEffect, useRef, useState } from 'react';
import * as mutations from '../../graphql/mutations';

import { useCollection } from '@cloudscape-design/collection-hooks';
import { ContentHeader } from '../../components/ContentHeader';
import useQuery from '../../hooks/useQuery';
import { eventContext } from '../../store/EventProvider';

import {
  Box,
  Button,
  Container,
  Form,
  Grid,
  Header,
  Modal,
  SpaceBetween,
  Table,
  TextFilter,
} from '@cloudscape-design/components';

import { DefaultPreferences, EmptyState, MatchesCountText } from '../../components/TableConfig';
import { EditModal } from './EditModal';
import { EventInputForm } from './EventInputForm';

export function AdminEvents() {
  const [SelectedEventInTable, setSelectedEventInTable] = useState([]);
  const [addButtonDisabled, setAddButtonDisabled] = useState(true);
  const [deleteButtonDisabled, setDeleteButtonDisabled] = useState(true);
  const [editButtonDisabled, setEditButtonDisabled] = useState(true);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);

  const { events, setEvents } = useContext(eventContext);
  const [allEventsFromBackend, loading] = useQuery('getAllEvents');
  const [allFleetsFromBackend] = useQuery('getAllFleets');

  const newEventRef = useRef();

  useEffect(() => {
    if (allEventsFromBackend) {
      setEvents(allEventsFromBackend);
    }
  }, [allEventsFromBackend, setEvents]);

  const addButtonDisabledHandler = (state) => {
    setAddButtonDisabled(state);
  };

  const editEventHandler = async (updatedEvent) => {
    const response = await API.graphql({
      query: mutations.updateEvent,
      variables: { ...updatedEvent },
    });
    if (response.data) {
      const eventId = updatedEvent.eventId;
      const updatedEvents = [...events];
      const index = updatedEvents.findIndex((event) => event.eventId === eventId);
      updatedEvents[index] = response.data.updateEvent;
      setEvents(updatedEvents);
    }
    setEditModalVisible(false);
  };

  // Add Event
  async function addEventHandler() {
    const event = newEventRef.current.getEvent();
    const response = await API.graphql({
      query: mutations.addEvent,
      variables: {
        ...event,
      },
    });
    if (response.data) {
      const addedEvent = response.data.addEvent;
      // console.info(addedEvent);
      setEvents((prevState) => {
        return [...prevState, addedEvent];
      });
    }
  }

  // Delete Event
  async function deleteEvent() {
    await API.graphql({
      query: mutations.deleteEvent,
      variables: {
        eventId: SelectedEventInTable[0].eventId,
      },
    });
    setEvents((prevState) => {
      const index = events.findIndex((event) => event.eventId === SelectedEventInTable[0].eventId);
      if (index > -1) {
        const updatedState = [...prevState];
        updatedState.splice(index, 1);
        return updatedState;
      }
      return prevState;
    });
    setDeleteButtonDisabled(true);
  }

  const [preferences, setPreferences] = useState({
    ...DefaultPreferences,
    visibleContent: ['eventName', 'raceTimeInSec', 'createdAt'],
  });

  const columnDefinitions = [
    {
      id: 'eventName',
      header: 'Event name',
      cell: (item) => item.eventName || '-',
      sortingField: 'eventName',
    },
    {
      id: 'raceTimeInSec',
      header: 'Race time in sec',
      cell: (item) => item.raceTimeInSec || '-',
      sortingField: 'raceTimeInSec',
    },
    {
      id: 'numberOfResets',
      header: 'No. of resets per lap',
      cell: (item) => item.numberOfResets || '-',
      sortingField: 'numberOfResets',
    },
    {
      id: 'fleet',
      header: 'Fleet',
      cell: (item) => {
        if (allFleetsFromBackend) {
          const currentFleet = allFleetsFromBackend.find((fleet) => fleet.fleetId === item.fleetId);
          if (currentFleet) {
            return currentFleet.fleetName;
          }
        }
        return '-';
      },
      sortingField: 'fleet',
    },
    {
      id: 'createdAt',
      header: 'Created at',
      cell: (item) => item.createdAt || '-',
      sortingField: 'createdAt',
    },
    {
      id: 'eventId',
      header: 'Event ID',
      cell: (item) => item.eventId || '-',
    },
  ];

  const { items, actions, filteredItemsCount, collectionProps, filterProps, paginationProps } =
    useCollection(events, {
      filtering: {
        empty: <EmptyState title="No Events" subtitle="Please create an event." />,
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
    });

  const eventsTable = (
    <Table
      {...collectionProps}
      onSelectionChange={({ detail }) => {
        setSelectedEventInTable(detail.selectedItems);
        setDeleteButtonDisabled(false);
        setEditButtonDisabled(false);
      }}
      selectedItems={SelectedEventInTable}
      selectionType="single"
      columnDefinitions={columnDefinitions}
      items={items}
      loading={loading}
      loadingText="Loading resources"
      filter={
        <TextFilter
          {...filterProps}
          countText={MatchesCountText(filteredItemsCount)}
          filteringAriaLabel="Filter cars"
        />
      }
      header={
        <Header
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                disabled={editButtonDisabled}
                // iconName="status-warning"
                onClick={() => {
                  setEditModalVisible(true);
                }}
              >
                Edit Event
              </Button>
              <Button
                disabled={deleteButtonDisabled}
                iconName="status-warning"
                onClick={() => {
                  setDeleteModalVisible(true);
                }}
              >
                Delete Event
              </Button>
            </SpaceBetween>
          }
        >
          Events
        </Header>
      }
    />
  );

  return (
    <>
      <EditModal
        visible={editModalVisible}
        event={SelectedEventInTable[0]}
        onDismiss={() => setEditModalVisible(false)}
        fleets={allFleetsFromBackend}
        onEdit={editEventHandler}
      />
      <ContentHeader
        header="Events admin"
        // description="List of Events."
        breadcrumbs={[
          { text: 'Home', href: '/' },
          { text: 'Admin', href: '/admin/home' },
          { text: 'Events' },
        ]}
      />
      <Grid gridDefinition={[{ colspan: 1 }, { colspan: 10 }, { colspan: 1 }]}>
        <div></div>
        <SpaceBetween direction="vertical" size="l">
          <Container textAlign="center">
            <Form
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <Button disabled={addButtonDisabled} variant="primary" onClick={addEventHandler}>
                    Add Event
                  </Button>
                </SpaceBetween>
              }
            >
              <EventInputForm
                events={events}
                ref={newEventRef}
                fleets={allFleetsFromBackend}
                onButtonDisabled={addButtonDisabledHandler}
              />
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
              <Button variant="link" onClick={() => setDeleteModalVisible(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  deleteEvent();
                  setDeleteModalVisible(false);
                }}
              >
                Delete
              </Button>
            </SpaceBetween>
          </Box>
        }
        header="Delete event"
      >
        Are you sure you want to delete event(s): <br></br>{' '}
        {SelectedEventInTable.map((selectedEvent) => {
          return selectedEvent.eventName + ' ';
        })}
      </Modal>
    </>
  );
}
