import React, { useEffect, useState } from 'react';
import { API, graphqlOperation } from 'aws-amplify';
//import * as queries from '../graphql/queries';
import * as mutations from '../graphql/mutations';
//import * as subscriptions from '../graphql/subscriptions'

import { ContentHeader } from '../components/ContentHeader';
import { ListOfFleets } from '../components/ListOfFleets';

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

export function AdminFleets() {
  //const [fleets, setFleets] = useState([]);
  const [newFleet, setNewFleet] = useState('');
  const [newFleetErrorText, setNewFleetErrorText] = useState('');
  const [selectedFleet, setSelectedFleet] = useState([]);
  const [addButtonDisabled, setAddButtonDisabled] = useState(true);
  const [deleteButtonDisabled, setDeleteButtonDisabled] = useState(true);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const fleets = ListOfFleets(setIsLoading);

  // Add Fleet
  async function addFleet(newFleet) {
    if (newFleet.match(/^[a-zA-Z0-9-_]+$/)) {
      if (fleets.map(fleets => { return fleets.fleetName }).includes(newFleet)) {
        //console.log('already exists');
        setNewFleetErrorText('Fleet already exists')
      } else {
        //console.log('match')
        const response = await API.graphql({
          query: mutations.addFleet,
          variables: {
            fleetName: newFleet
          }
        });
        setNewFleetErrorText('')
        setNewFleet('')
        return response;
      }
    } else {
      setNewFleetErrorText('Must match regex: ^[a-zA-Z0-9-_]+$')
    }
  }

  // Delete Fleet
  async function deleteFleet() {
    //console.log(selectedFleet[0].fleetId);
    const response = await API.graphql({
      query: mutations.deleteFleet,
      variables: {
        fleetId: selectedFleet[0].fleetId
      }
    });
    setDeleteButtonDisabled(true);
    //console.log(response.data.deleteFleet);
  }

  const [preferences, setPreferences] = useState({
    ...DefaultPreferences,
    visibleContent: ['fleetName', 'fleetId', 'createdAt'],
  });

  const columnDefinitions = [
    {
      id: "fleetName",
      header: "Fleet name",
      cell: item => item.fleetName || "-",
      sortingField: "fleetName"
    },
    {
      id: "fleetId",
      header: "Fleet ID",
      cell: item => item.fleetId || "-",
    },
    {
      id: "createdAt",
      header: "Created at",
      cell: item => item.createdAt || "-",
      sortingField: "createdAt"
    }
  ]

  const { items, actions, filteredItemsCount, collectionProps, filterProps, paginationProps } = useCollection(
    fleets,
    {
      filtering: {
        empty: (
          <EmptyState
            title="No Fleets"
            subtitle="Please create a fleet."
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

  const fleetsTable = <Table
    {...collectionProps}
    onSelectionChange={({ detail }) => {
      setSelectedFleet(detail.selectedItems);
      setDeleteButtonDisabled(false);
    }}
    selectedItems={selectedFleet}
    selectionType="single"
    columnDefinitions={columnDefinitions}
    items={items}
    loading={isLoading}
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
            }}>Delete Fleet</Button>
          </SpaceBetween>
        }
      >Fleets</Header>
    }
  />

  return (
    <>
      <ContentHeader
        header="Fleets admin"
        description="List of Fleets."
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
                    addFleet(newFleet);
                  }}>Add Fleet</Button>
                </SpaceBetween>
              }
            >
              <SpaceBetween direction="vertical" size="l">
                <FormField
                  label="New Fleet"
                  errorText={newFleetErrorText}
                >
                  <Input value={newFleet} placeholder='AwesomeFleet' onChange={fleet => {
                    setNewFleet(fleet.detail.value);
                    if (newFleet.length > 0) { setAddButtonDisabled(false) };
                  }} />
                </FormField>
              </SpaceBetween>
            </Form>
          </Container>

          {fleetsTable}
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
                deleteFleet();
                setDeleteModalVisible(false);
              }}>Delete</Button>
            </SpaceBetween>
          </Box>
        }
        header="Delete fleet"
      >
        Are you sure you want to delete fleet(s): <br></br> {selectedFleet.map(selectedFleet => { return selectedFleet.fleetName + " " })}
      </Modal>
    </>

  )
}
