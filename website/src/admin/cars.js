import React, { useEffect, useState } from 'react';
import { API } from 'aws-amplify';
import { useCollection } from '@cloudscape-design/collection-hooks';
import {
  Button,
  CollectionPreferences,
  Header,
  Grid,
  Pagination,
  SpaceBetween,
  Table,
  TextFilter,
} from '@cloudscape-design/components';

import { ContentHeader } from '../components/ContentHeader';
import {
  DefaultPreferences,
  EmptyState,
  MatchesCountText,
  PageSizePreference,
  WrapLines,
} from '../components/TableConfig';

import DeleteCarModelModal from '../components/DeleteCarModelModal';

import dayjs from 'dayjs';

// day.js
var advancedFormat = require('dayjs/plugin/advancedFormat')
var utc = require('dayjs/plugin/utc')
var timezone = require('dayjs/plugin/timezone') // dependent on utc plugin

dayjs.extend(advancedFormat)
dayjs.extend(utc)
dayjs.extend(timezone)

export function AdminCars() {
  const [allItems, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCarsBtn, setSelectedCarsBtn] = useState(true);
  const [selectedItems, setSelectedItems] = useState([]);

  useEffect(() => {
    // Get Cars
    async function getData() {
      const apiName = 'deepracerEventManager';
      const apiPath = 'cars';

      const response = await API.get(apiName, apiPath);
      setItems(response);
    }
    getData();
    setIsLoading(false);

    return() => {
      // Unmounting
    }
  },[])

  const [preferences, setPreferences] = useState({
    ...DefaultPreferences,
    visibleContent: ['instanceId', 'carName', 'carIp'],
  });

  const columnsConfig = [
    {
      id: 'instanceId',
      header: 'Instance',
      cell: item => item.InstanceId,
      sortingField: 'key',
    },
    {
      id: 'carName',
      header: 'Car name',
      cell: item => item.ComputerName || '-',
      sortingField: 'carName',
    },
    {
      id: 'carIp',
      header: 'IP address',
      cell: item => item.IPAddress || '-',
      sortingField: 'carIp',
    },
    {
      id: 'agentVersion',
      header: 'Agent version',
      cell: item => item.AgentVersion || '-',
      sortingField: 'agentVersion',
    },
    {
      id: 'registrationDate',
      header: 'Registration date',
      cell: item => dayjs(item.RegistrationDate).format('YYYY-MM-DD HH:mm:ss (z)') || '-',
      sortingField: 'registrationDate',
    },
    {
      id: 'lastPingDateTime',
      header: 'Last ping time',
      cell: item => dayjs(item.lastPingDateTime).format('YYYY-MM-DD HH:mm:ss (z)') || '-',
      sortingField: 'lastPingDateTime',
    }
  ];

  const visibleContentOptions = [
    {
      label: 'Model information',
      options: [
        {
          id: 'instanceId',
          label: 'Instance',
          editable: false,
        },
        {
          id: 'carName',
          label: 'Car name',
          editable: false,
        },
        {
          id: 'carIp',
          label: 'Car IP',
        },
        {
          id: 'agentVersion',
          label: 'Agent version',
        },
        {
          id: 'registrationDate',
          label: 'Registration date',
        },
        {
          id: 'lastPingDateTime',
          label: 'Last ping time',
        }
      ]
    }
  ]

  const {items, actions, filteredItemsCount, collectionProps, filterProps, paginationProps } = useCollection(
    allItems,
    {
      filtering: {
        empty: (
          <EmptyState
            title="No cars"
            subtitle="No cars are currently online."
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
      sorting: { defaultState: { sortingColumn: columnsConfig[1] } },
      selection: {},
    }
  );

  return (
    <>
      <ContentHeader
        header="Cars"
        description="List of cars currently online."
        breadcrumbs={[
          { text: "Home", href: "/" },
          { text: "Admin", href: "/admin/home" },
          { text: "Cars" },
        ]}
      />

      <Grid gridDefinition={[{ colspan: 2 }, { colspan: 8 }, { colspan: 2 }]}>
        <div></div>
        <Table
          {...collectionProps}
          header={
            <Header
              counter={selectedItems.length ? `(${selectedItems.length}/${allItems.length})` : `(${allItems.length})`}
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <DeleteCarModelModal disabled={selectedCarsBtn} selectedItems={selectedItems} variant="primary" />
                </SpaceBetween>
              }
            >
              Cars
            </Header>
          }
          columnDefinitions={columnsConfig}
          items={items}
          pagination={
            <Pagination {...paginationProps}
            ariaLabels={{
              nextPageLabel: 'Next page',
              previousPageLabel: 'Previous page',
              pageLabel: pageNumber => `Go to page ${pageNumber}`,
            }}
          />}
          filter={
            <TextFilter
              {...filterProps}
              countText={MatchesCountText(filteredItemsCount)}
              filteringAriaLabel='Filter cars'
            />
          }
          loading={isLoading}
          loadingText='Loading cars'
          visibleColumns={preferences.visibleContent}
          selectionType='multi'
          trackBy='InstanceId'
          selectedItems={selectedItems}
          onSelectionChange={({ detail: { selectedItems } }) => {
            setSelectedItems(selectedItems)
            selectedItems.length ? setSelectedCarsBtn(false) : setSelectedCarsBtn(true)
          }}
          resizableColumns
          preferences={
            <CollectionPreferences
              title='Preferences'
              confirmLabel='Confirm'
              cancelLabel='Cancel'
              onConfirm={({ detail }) => setPreferences(detail)}
              preferences={preferences}
              pageSizePreference={PageSizePreference('cars')}
              visibleContentPreference={{
                title: 'Select visible columns',
                options: visibleContentOptions,
              }}
              wrapLinesPreference={WrapLines}
            />
          }
        />
      </Grid>
    </>
  );
}
