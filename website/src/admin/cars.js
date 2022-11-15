import React, { useEffect, useState } from 'react';
import { API } from 'aws-amplify';
import * as queries from '../graphql/queries';
//import * as mutations from '../graphql/mutations';
//import * as subscriptions from '../graphql/subscriptions'

import { useCollection } from '@cloudscape-design/collection-hooks';
import {
  Button,
  ButtonDropdown,
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
  CarColumnsConfig,
  CarVisibleContentOptions,
  DefaultPreferences,
  EmptyState,
  MatchesCountText,
  PageSizePreference,
  WrapLines,
} from '../components/TableConfig';

import EditCarModelModal from '../components/EditCarModelModal';

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
  const [selectedCarsBtnDisabled, setSelectedCarsBtnDisabled] = useState(true);
  const [selectedItems, setSelectedItems] = useState([]);
  const [online, setOnline] = useState("Online");
  const [onlineBool, setOnlineBool] = useState(true);
  const [refresh, setRefresh] = useState(false);

  // Get Cars
  async function getCars() {
    var thisOnlineBool = true;
    if (online !== "Online") {
      setOnlineBool(false);
      thisOnlineBool = false;
    } else {
      setOnlineBool(true);
    }
    const response = await API.graphql({
      query: queries.carsOnline,
      variables: { online: thisOnlineBool }
    });
    setSelectedCarsBtnDisabled(true);
    setSelectedItems([]);
    setIsLoading(false);
    setItems(response.data.carsOnline);
  }

  useEffect(() => {
    getCars();
    return () => {
      // Unmounting
    }
  }, [online])

  useEffect(() => {
    if (refresh) {
      setIsLoading(true);
      getCars();
      setRefresh(false);
    }
    return () => {
      // Unmounting
    }
  }, [refresh])



  const [preferences, setPreferences] = useState({
    ...DefaultPreferences,
    visibleContent: ['carName', 'eventName', 'carIp'],
  });

  const { items, actions, filteredItemsCount, collectionProps, filterProps, paginationProps } = useCollection(
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
      sorting: { defaultState: { sortingColumn: CarColumnsConfig[1] } },
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

      <Grid gridDefinition={[{ colspan: 1 }, { colspan: 10 }, { colspan: 1 }]}>
        <div></div>
        <Table
          {...collectionProps}
          header={
            <Header
              counter={selectedItems.length ? `(${selectedItems.length}/${allItems.length})` : `(${allItems.length})`}
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <ButtonDropdown
                    items={[
                      { text: "Online", id: "Online", disabled: false },
                      { text: "Offline", id: "Offline", disabled: false },
                    ]}
                    onItemClick={({ detail }) => {
                      setOnline(detail.id);
                      setIsLoading(true);
                    }}
                  >
                    {online}
                  </ButtonDropdown>
                  <EditCarModelModal disabled={selectedCarsBtnDisabled} setRefresh={setRefresh} selectedItems={selectedItems} online={onlineBool} variant="primary" />
                </SpaceBetween>
              }
            >
              Cars
            </Header>
          }
          columnDefinitions={CarColumnsConfig}
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
          stickyHeader='true'
          trackBy='InstanceId'
          selectedItems={selectedItems}
          onSelectionChange={({ detail: { selectedItems } }) => {
            setSelectedItems(selectedItems)
            selectedItems.length ? setSelectedCarsBtnDisabled(false) : setSelectedCarsBtnDisabled(true)
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
                options: CarVisibleContentOptions,
              }}
              wrapLinesPreference={WrapLines}
            />
          }
        />
      </Grid>
    </>
  );
}
